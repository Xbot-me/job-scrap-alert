import type { PrismaClient } from "@prisma/client";
import { loadSearchConfig } from "./config";
import { evaluate, MAX_AGE_DAYS, type RawLead } from "./score";
import { boardSources } from "./sources/boards";
import { fetchHnFreelance, fetchHnHiring, isJobSeeker } from "./sources/hn";
import { fetchReddit, isRequestTitle } from "./sources/reddit";

export type SyncResult = { fetched: number; kept: number; added: number; errors: string[] };

const SOURCES: Record<string, () => Promise<RawLead[]>> = {
  "HN hiring": fetchHnHiring,
  "HN freelance": fetchHnFreelance,
  Reddit: fetchReddit,
  ...boardSources,
};

const BOARD_NAMES = new Set(["Remotive", "RemoteOK", "Jobicy", "We Work Remotely"]);

function dedupKey(lead: RawLead) {
  return `${lead.company ?? ""}|${lead.title}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
}

/** Fetch every source, score, store what's worth contacting. Never touches your statuses. */
export async function syncLeads(prisma: PrismaClient, log: (msg: string) => void = () => {}): Promise<SyncResult> {
  const config = loadSearchConfig();
  const errors: string[] = [];
  const settled = await Promise.all(
    Object.entries(SOURCES).map(async ([name, fetchSource]) => {
      try {
        const leads = await fetchSource();
        log(`${name}: ${leads.length} posts`);
        return leads;
      } catch (e) {
        const msg = `${name}: ${e instanceof Error ? e.message : String(e)}`;
        errors.push(msg);
        log(msg);
        return [];
      }
    }),
  );
  const raw = settled.flat().filter((l) => !Number.isNaN(l.postedAt.getTime()));

  const fetchedIds = new Set(raw.map((l) => `${l.source}|${l.externalId}`));
  const keptIds = new Set<string>();
  const seen = new Set<string>();
  const rejected: Record<string, number> = {};
  let kept = 0;
  let added = 0;
  for (const lead of raw) {
    const key = dedupKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);

    const verdict = evaluate(lead, config);
    if (!verdict.keep) {
      rejected[verdict.reason] = (rejected[verdict.reason] ?? 0) + 1;
      continue;
    }
    kept++;
    keptIds.add(`${lead.source}|${lead.externalId}`);
    const data = {
      url: lead.url, title: lead.title, company: lead.company ?? null, body: lead.body.slice(0, 20_000),
      emails: lead.emails, redditUser: lead.redditUser ?? null, applyUrl: lead.applyUrl ?? null,
      pay: verdict.pay ?? null, kind: lead.kind, remote: verdict.remote, skills: verdict.skills,
      score: verdict.score, reasons: verdict.reasons, postedAt: lead.postedAt,
    };
    const where = { source_externalId: { source: lead.source, externalId: lead.externalId } };
    const existing = await prisma.lead.findUnique({ where, select: { id: true } });
    if (existing) await prisma.lead.update({ where, data });
    else {
      await prisma.lead.create({ data: { ...data, source: lead.source, externalId: lead.externalId } });
      added++;
    }
  }

  // Re-check untouched inbox leads against today's rules, so tightening
  // search_config.md or the scoring also cleans out what's already stored.
  for (const stored of await prisma.lead.findMany({ where: { status: "NEW" } })) {
    const verdict = evaluate(
      { ...stored, company: stored.company ?? undefined, redditUser: stored.redditUser ?? undefined, applyUrl: stored.applyUrl ?? undefined, fromBoard: BOARD_NAMES.has(stored.source) },
      config,
    );
    const id = `${stored.source}|${stored.externalId}`;
    const droppedThisRun = fetchedIds.has(id) && !keptIds.has(id);
    const wrongPost =
      droppedThisRun ||
      (stored.source.startsWith("r/") && !isRequestTitle(stored.source, stored.title)) ||
      (stored.source.startsWith("HN") && isJobSeeker(stored.body));
    if (!verdict.keep || wrongPost) await prisma.lead.delete({ where: { id: stored.id } });
    else if (verdict.score !== stored.score) await prisma.lead.update({ where: { id: stored.id }, data: { score: verdict.score, reasons: verdict.reasons } });
  }

  // Stale leads you never acted on just add noise.
  const cutoff = new Date(Date.now() - (MAX_AGE_DAYS + 15) * 86_400_000);
  await prisma.lead.deleteMany({ where: { status: { in: ["NEW", "HIDDEN"] }, postedAt: { lt: cutoff } } });

  log(`Skipped: ${Object.entries(rejected).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} (${n})`).join(", ")}`);
  await prisma.syncRun.create({ data: { fetched: raw.length, kept, added, errors } });
  return { fetched: raw.length, kept, added, errors };
}
