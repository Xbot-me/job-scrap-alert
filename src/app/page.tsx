import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { refreshLeads } from "@/app/actions";
import { RefreshButton, ThemeToggle } from "@/components/client-buttons";
import { Filters } from "@/components/filters";
import { ago, LeadCard } from "@/components/lead-card";
import { loadProfile } from "@/leads/config";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VIEWS = {
  inbox: { label: "Inbox", status: "NEW" },
  saved: { label: "Saved", status: "SAVED" },
  contacted: { label: "Contacted", status: "CONTACTED" },
  hidden: { label: "Hidden", status: "HIDDEN" },
} as const;
type View = keyof typeof VIEWS;

const PAGE = 50;
const ANYWHERE = "anywhere";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) || undefined;
  const view: View = (one("view") as View) in VIEWS ? (one("view") as View) : "inbox";
  const params = {
    view: view === "inbox" ? undefined : view,
    country: one("country"),
    mode: one("mode"),
    type: one("type"),
    email: one("email"),
    visa: one("visa"),
  };
  const limit = Math.min(500, Math.max(PAGE, Number(one("limit")) || PAGE));

  const filters: Prisma.LeadWhereInput = {
    ...(params.country === ANYWHERE ? { country: null } : params.country ? { country: params.country } : {}),
    ...(params.mode === "remote" && { workMode: "REMOTE" }),
    ...(params.mode === "onsite" && { workMode: { in: ["ONSITE", "HYBRID"] } }),
    ...(params.type === "gig" && { employment: { in: ["FREELANCE", "CONTRACT", "PART_TIME"] } }),
    ...(params.type === "fulltime" && { employment: "FULL_TIME" }),
    ...(params.email === "1" && { emails: { isEmpty: false } }),
    ...(params.visa === "1" && { visa: true }),
  };
  const where: Prisma.LeadWhereInput = { status: VIEWS[view].status, ...filters };

  const [leads, total, counts, byCountry, lastRun] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: view === "contacted" ? [{ contactedAt: "asc" }] : [{ score: "desc" }, { postedAt: "desc" }],
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.groupBy({ by: ["country"], where: { status: VIEWS[view].status }, _count: true }),
    prisma.syncRun.findFirst({ orderBy: { at: "desc" } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const profile = loadProfile();

  const anywhere = byCountry.find((c) => c.country === null)?._count ?? 0;
  const countries = [
    ...(anywhere ? [{ value: ANYWHERE, label: `Remote, anywhere (${anywhere})` }] : []),
    ...byCountry
      .filter((c) => c.country)
      .sort((a, b) => b._count - a._count || a.country!.localeCompare(b.country!))
      .map((c) => ({ value: c.country!, label: `${c.country} (${c._count})` })),
  ];

  const href = (patch: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(Object.entries({ ...params, ...patch }).filter(([, v]) => v) as [string, string][]);
    return qs.size ? `/?${qs}` : "/";
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Dev work in any country, remote or on-site, from small teams you can reach directly, ranked by how well it
            matches {profile.portfolioUrl ? "your portfolio" : "your stack"}. Big names and dead-end postings are filtered out.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={refreshLeads}>
          <RefreshButton />
        </form>
        <span className="text-xs text-muted-foreground">
          {lastRun ? `Last search ${ago(lastRun.at)}: ${lastRun.fetched} posts read, ${lastRun.added} new leads` : "No search yet"}
        </span>
      </div>
      {lastRun && lastRun.errors.length > 0 && (
        <p className="mt-2 text-xs text-warning">Some sources failed last time: {lastRun.errors.join("; ")}</p>
      )}
      {!profile.cvUrl && (
        <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          Add <code className="font-mono text-xs">OUTREACH_CV_URL</code> (a public link to your CV) to{" "}
          <code className="font-mono text-xs">.env</code> so every drafted message includes it.
        </p>
      )}

      <nav className="mt-8 flex gap-5 border-b border-border">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={href({ view: v === "inbox" ? undefined : v, limit: undefined })}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm",
              v === view ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {VIEWS[v].label} <span className="tabular-nums text-muted-foreground">{count(VIEWS[v].status)}</span>
          </Link>
        ))}
      </nav>
      <Filters params={params} countries={countries} />

      {leads.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {count(VIEWS[view].status) === 0 && view === "inbox"
            ? "Nothing here yet. Run a search to pull fresh leads."
            : "No leads match these filters."}
        </p>
      ) : (
        <>
          <p className="pb-1 text-xs text-muted-foreground">
            {total} {total === 1 ? "lead" : "leads"}
            {total > leads.length ? `, showing the best ${leads.length}` : ""}
          </p>
          <div>
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} profile={profile} />
            ))}
          </div>
          {total > leads.length && (
            <div className="pt-6 text-center">
              <Link href={href({ limit: String(limit + PAGE) })} scroll={false} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Show {Math.min(PAGE, total - leads.length)} more
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
