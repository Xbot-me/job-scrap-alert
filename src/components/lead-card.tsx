import type { Lead } from "@prisma/client";
import { Archive, Bookmark, ExternalLink, Mail, MessageSquare, Send, Undo2 } from "lucide-react";
import { setStatus } from "@/app/actions";
import { CopyButton } from "@/components/client-buttons";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/leads/config";
import { contactLinks } from "@/leads/outreach";
import { cn } from "@/lib/utils";

const REMOTE_LABEL: Record<Lead["remote"], string> = {
  WORLDWIDE: "Worldwide",
  ASIA_OK: "Open to Asia",
  TIMEZONE: "US/EU hours",
  UNSTATED: "Remote",
};

export function ago(date: Date, now = Date.now()) {
  const hours = Math.max(0, (now - date.getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Server-rendered per request, so "now" is the request time.
function olderThanDays(date: Date, days: number) {
  return Date.now() - date.getTime() > days * 86_400_000;
}

function StatusButton({ id, status, children, title }: { id: string; status: Lead["status"]; children: React.ReactNode; title: string }) {
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" title={title}>
        {children}
      </Button>
    </form>
  );
}

export function LeadCard({ lead, profile }: { lead: Lead; profile: Profile }) {
  const links = contactLinks(lead, profile);
  const excerpt = lead.body.split("\n").slice(1).join(" ").trim() || lead.body;
  const followUp = lead.status === "CONTACTED" && lead.contactedAt && olderThanDays(lead.contactedAt, 5);

  return (
    <article className="border-b border-border px-1 py-5 first:pt-2">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "mt-0.5 w-10 shrink-0 rounded-md py-1 text-center text-sm font-semibold tabular-nums",
            lead.score >= 70 ? "bg-success/12 text-success" : lead.score >= 50 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
          title="Fit score"
        >
          {lead.score}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-snug text-foreground">
            <a href={lead.url} target="_blank" rel="noreferrer" className="hover:underline">
              {lead.title}
            </a>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[lead.company, lead.source, ago(lead.postedAt)].filter(Boolean).join(" · ")}
          </p>

          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{lead.kind === "GIG" ? "Freelance" : "Job"}</span>
            <span>{REMOTE_LABEL[lead.remote]}</span>
            {lead.pay && <span className="text-foreground">{lead.pay}</span>}
            {lead.skills.length > 0 && <span>{lead.skills.slice(0, 5).join(", ")}</span>}
          </p>

          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-sm text-muted-foreground">
              <span className="line-clamp-2 group-open:hidden">{excerpt}</span>
              <span className="hidden text-xs underline group-open:inline">Hide post</span>
            </summary>
            <div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary/60 p-3 text-sm leading-relaxed text-foreground">
              {lead.body}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Why it&apos;s here: {lead.reasons.join(" · ")}</p>
          </details>

          {lead.status === "CONTACTED" && lead.contactedAt && (
            <p className={cn("mt-2 text-xs", followUp ? "font-medium text-warning" : "text-muted-foreground")}>
              Contacted {ago(lead.contactedAt)}
              {followUp && ": send a short follow-up"}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1">
            {links.mailto && (
              <Button asChild size="sm">
                <a href={links.mailto}>
                  <Mail /> Email {lead.emails[0]}
                </a>
              </Button>
            )}
            {links.gmail && (
              <Button asChild variant="outline" size="sm">
                <a href={links.gmail} target="_blank" rel="noreferrer">Gmail</a>
              </Button>
            )}
            {links.redditDm && (
              <Button asChild size="sm" variant={links.mailto ? "outline" : "default"}>
                <a href={links.redditDm} target="_blank" rel="noreferrer">
                  <MessageSquare /> Message u/{lead.redditUser}
                </a>
              </Button>
            )}
            {!links.mailto && !links.redditDm && lead.applyUrl && (
              <Button asChild size="sm">
                <a href={lead.applyUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Apply
                </a>
              </Button>
            )}
            <CopyButton text={links.draft} />

            <div className="ml-auto flex items-center gap-0.5">
              {lead.status !== "CONTACTED" && (
                <StatusButton id={lead.id} status="CONTACTED" title="I sent a message">
                  <Send /> Sent
                </StatusButton>
              )}
              {lead.status === "NEW" && (
                <StatusButton id={lead.id} status="SAVED" title="Save for later">
                  <Bookmark /> Save
                </StatusButton>
              )}
              {lead.status === "NEW" ? (
                <StatusButton id={lead.id} status="HIDDEN" title="Not interested">
                  <Archive /> Hide
                </StatusButton>
              ) : (
                <StatusButton id={lead.id} status="NEW" title="Back to inbox">
                  <Undo2 /> Inbox
                </StatusButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
