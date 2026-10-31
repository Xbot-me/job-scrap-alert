import type { PrismaClient } from "@prisma/client";
import { loadProfile, loadSearchConfig } from "./config";
import { loadPortfolioSkills } from "./portfolio";
import { evaluate, MAX_AGE_DAYS, type RawLead, type Verdict } from "./score";
import { BOARD_SOURCE_NAMES, boardSources } from "./sources/boards";
import { COUNTRY_SOURCE_NAMES, countrySources } from "./sources/countries";
import { fetchHnFreelance, fetchHnHiring, isJobSeeker } from "./sources/hn";
import { fetchReddit, isRequestTitle } from "./sources/reddit";

export type SyncResult = { fetched: number; kept: number; added: number; errors: string[] };

const SOURCES: Record<string, () => Promise<RawLead[]>> = {
  "HN hiring": fetchHnHiring,
  "HN freelance": fetchHnFreelance,
  Reddit: fetchReddit,
  ...boardSources,
  ...countrySources,
};

const BOARD_NAMES = new Set([...BOARD_SOURCE_NAMES, ...COUNTRY_SOURCE_NAMES]);

function verdictFields(v: Extract<Verdict, { keep: true }>) {
  return {
    score: v.score, reasons: v.reasons, skills: v.skills, remote: v.remote, workMode: v.workMode,
    employment: v.employment, country: v.country, language: v.language, visa: v.visa, pay: v.pay ?? null,
  };
}

function dedupKey(lead: RawLead) {
  return `${lead.company ?? ""}|${lead.title}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
}

/** Fetch every source, score, store what's worth contacting. Never touches your statuses. */
export async function syncLeads(prisma: PrismaClient, log: (msg: string) => void = () => {}): Promise<SyncResult> {
  const portfolio = await loadPortfolioSkills(loadProfile().portfolioUrl);
  const config = { ...loadSearchConfig(), portfolio };
  log(portfolio.length ? `Portfolio skills: ${portfolio.map((p) => p.name).join(", ")}` : "No portfolio skills loaded (set OUTREACH_PORTFOLIO_URL)");
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
      postedAt: lead.postedAt, ...verdictFields(verdict),
    };
    const where = { source_externalId: { source: lead.source, externalId: lead.externalId } };
    const existing = await prisma.lead.findUnique({ where, select: { id: true } });
    if (existing) await prisma.lead.update({ where, data });
    else {
      await prisma.lead.create({ data: { ...data, source: lead.source, externalId: lead.externalId } });
      added++;
    }
  }

  // Re-check inbox leads that weren't in this run's feeds (Reddit rolls over
  // fast) against today's rules, so rule changes also clean out what's stored.
  for (const stored of await prisma.lead.findMany({ where: { status: "NEW" } })) {
    const id = `${stored.source}|${stored.externalId}`;
    if (keptIds.has(id)) continue;
    const wrongPost =
      fetchedIds.has(id) ||
      (stored.source.startsWith("r/") && !isRequestTitle(stored.source, stored.title)) ||
      (stored.source.startsWith("HN") && isJobSeeker(stored.body));
    const verdict = wrongPost
      ? null
      : evaluate(
          {
            ...stored, company: stored.company ?? undefined, redditUser: stored.redditUser ?? undefined, applyUrl: stored.applyUrl ?? undefined,
            country: stored.country ?? undefined, workMode: stored.workMode, employment: stored.employment, fromBoard: BOARD_NAMES.has(stored.source),
          },
          config,
        );
    if (!verdict?.keep) await prisma.lead.delete({ where: { id: stored.id } });
    else await prisma.lead.update({ where: { id: stored.id }, data: verdictFields(verdict) });
  }

  // Stale leads you never acted on just add noise.
  const cutoff = new Date(Date.now() - (MAX_AGE_DAYS + 15) * 86_400_000);
  await prisma.lead.deleteMany({ where: { status: { in: ["NEW", "HIDDEN"] }, postedAt: { lt: cutoff } } });

  log(`Skipped: ${Object.entries(rejected).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} (${n})`).join(", ")}`);
  await prisma.syncRun.create({ data: { fetched: raw.length, kept, added, errors } });
  return { fetched: raw.length, kept, added, errors };
}
