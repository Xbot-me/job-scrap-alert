import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { refreshLeads } from "@/app/actions";
import { RefreshButton, ThemeToggle } from "@/components/client-buttons";
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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const view: View = (one("view") as View) in VIEWS ? (one("view") as View) : "inbox";
  const kind = one("kind") === "gig" ? "GIG" : one("kind") === "job" ? "JOB" : undefined;
  const emailOnly = one("email") === "1";

  const where: Prisma.LeadWhereInput = {
    status: VIEWS[view].status,
    ...(kind && { kind }),
    ...(emailOnly && { emails: { isEmpty: false } }),
  };
  const [leads, counts, lastRun] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: view === "contacted" ? [{ contactedAt: "asc" }] : [{ score: "desc" }, { postedAt: "desc" }],
      take: 150,
    }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.syncRun.findFirst({ orderBy: { at: "desc" } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const profile = loadProfile();

  const href = (patch: Record<string, string | undefined>) => {
    const next = { view, kind: kind?.toLowerCase(), email: emailOnly ? "1" : undefined, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    if (qs.get("view") === "inbox") qs.delete("view");
    return qs.size ? `/?${qs}` : "/";
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Small teams and founders hiring remote developers who you can email or message directly. Big names and
            ATS black holes are filtered out.
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
          Add <code className="font-mono text-xs">OUTREACH_CV_URL</code> (a public link to your CV) and{" "}
          <code className="font-mono text-xs">OUTREACH_NAME</code> to <code className="font-mono text-xs">.env</code> so every
          drafted message includes them.
        </p>
      )}

      <nav className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div className="flex gap-5">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              className={cn(
                "-mb-px border-b-2 pb-2 text-sm",
                v === view ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEWS[v].label} <span className="tabular-nums text-muted-foreground">{count(VIEWS[v].status)}</span>
            </Link>
          ))}
        </div>
        <div className="flex gap-3 pb-2 text-sm">
          {[
            ["All", undefined],
            ["Freelance", "gig"],
            ["Jobs", "job"],
          ].map(([label, k]) => (
            <Link key={label} href={href({ kind: k })} className={cn(kind?.toLowerCase() === k ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </Link>
          ))}
          <Link href={href({ email: emailOnly ? undefined : "1" })} className={cn(emailOnly ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {emailOnly ? "✓ " : ""}Has email
          </Link>
        </div>
      </nav>

      {leads.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {view === "inbox" ? "Nothing here yet. Run a search to pull fresh leads." : `No ${VIEWS[view].label.toLowerCase()} leads.`}
        </p>
      ) : (
        <div>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} profile={profile} />
          ))}
        </div>
      )}
    </main>
  );
}
