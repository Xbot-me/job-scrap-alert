import type { RawLead } from "../score";
import { extractApplyUrl, extractEmails, htmlToText } from "../text";
import { getJson } from "./http";

// Hacker News monthly threads. "Who is hiring?" is mostly small startups
// posting themselves, often with a founder's email. "Seeking freelancer"
// posts are people with a concrete project and no team to build it.

type Hit = { objectID: string; title: string; created_at: string; num_comments: number | null };
type Item = { id: number; created_at: string; text: string | null; author: string | null; children: Item[] };

const ALGOLIA = "https://hn.algolia.com/api/v1";

async function latestThreads(query: string, titleRe: RegExp, count: number): Promise<Hit[]> {
  const { hits } = await getJson<{ hits: Hit[] }>(`${ALGOLIA}/search_by_date?${query}&hitsPerPage=20`);
  return hits.filter((h) => titleRe.test(h.title) && (h.num_comments ?? 0) >= 5).slice(0, count);
}

async function topLevelComments(threadId: string): Promise<Item[]> {
  const thread = await getJson<Item>(`${ALGOLIA}/items/${threadId}`);
  return thread.children.filter((c) => c.text);
}

function firstLine(text: string) {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

const ROLE_WORD = /\b(engineer\w*|developer\w*|dev|programmer\w*|full[\s-]?stack|back[\s-]?end|front[\s-]?end|devops|sre|cto|architect\w*)\b/i;
const NOT_A_NAME = /^(location|remote|onsite|on-site|hybrid|full[\s-]?time|part[\s-]?time|contract|visa|salary|https?:)|[$€£]\d|\b(remote|onsite)\b/i;

export function isJobSeeker(body: string) {
  return /^\s*seeking work\b/i.test(body) || /^\s*willing to relocate\s*:/im.test(body) || /^\s*r[ée]sum[ée](\/cv)?\s*:/im.test(body);
}

/** "Company | Role | Location | ..." is the convention, but plenty of posts use "Company: X" lines instead. */
export function parseHiringHeader(body: string): { header: string; company?: string; role: string } {
  const header = firstLine(body);
  const labelled = (label: string) => body.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"))?.[1]?.trim();
  const parts = header.split(/\s+[|·•]\s+|\s+[–—-]\s+/).map((p) => p.trim()).filter(Boolean);
  const company =
    labelled("company") ?? parts.find((p) => !NOT_A_NAME.test(p) && !ROLE_WORD.test(p)) ?? parts[0];
  const role =
    labelled("(?:role|roles|position|positions|title)") ?? parts.find((p) => ROLE_WORD.test(p) && p !== company) ?? "Several roles (see post)";
  return { header, company: company?.replace(/\s*\(.*\)$/, "").slice(0, 80), role };
}

export async function fetchHnHiring(): Promise<RawLead[]> {
  const threads = await latestThreads("tags=story,author_whoishiring", /who is hiring/i, 2);
  const leads: RawLead[] = [];
  for (const thread of threads) {
    for (const c of await topLevelComments(thread.objectID)) {
      const body = htmlToText(c.text!);
      if (isJobSeeker(body)) continue; // résumés posted in the wrong thread
      const { header, company, role } = parseHiringHeader(body);
      leads.push({
        source: "HN Who's Hiring",
        externalId: String(c.id),
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        title: role.slice(0, 140),
        company,
        header,
        body,
        emails: extractEmails(`${c.text} ${body}`),
        applyUrl: extractApplyUrl(body),
        postedAt: new Date(c.created_at),
      });
    }
  }
  return leads;
}

export async function fetchHnFreelance(): Promise<RawLead[]> {
  const threads = await latestThreads(
    `query=${encodeURIComponent('"Seeking freelancer"')}&tags=story`,
    /freelancer\? seeking freelancer\?/i,
    2,
  );
  const leads: RawLead[] = [];
  for (const thread of threads) {
    for (const c of await topLevelComments(thread.objectID)) {
      const body = htmlToText(c.text!);
      if (!/^\s*seeking freelancer/i.test(body)) continue; // the rest are people offering services
      const header = firstLine(body).replace(/^seeking freelancers?\s*[:|-]?\s*/i, "");
      const title = header.split("|").map((p) => p.trim()).find((p) => p.length > 3 && !/^remote$/i.test(p)) ?? "Freelance project";
      leads.push({
        source: "HN Seeking Freelancer",
        externalId: String(c.id),
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        title: title.slice(0, 140),
        company: c.author ? `HN user ${c.author}` : undefined,
        header,
        body,
        emails: extractEmails(`${c.text} ${body}`),
        applyUrl: extractApplyUrl(body),
        gigByDefault: true,
        postedAt: new Date(c.created_at),
      });
    }
  }
  return leads;
}
