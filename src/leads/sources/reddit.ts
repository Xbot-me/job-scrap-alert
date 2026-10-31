import type { RawLead } from "../score";
import { decodeEntities, extractApplyUrl, extractEmails, htmlToText } from "../text";
import { get, sleep } from "./http";

// Reddit: small business owners and solo founders asking for help directly.
// The JSON API is blocked without OAuth, but the RSS feeds are open (and
// rate-limited, hence one combined request per feed and a pause between).

const HIRING_SUBS = "forhire+jobbit+hiring+freelance_forhire+remotejs+HireaProgrammer+webdevjobs+PHPjobs+laraveljobs";
const HELP_SUBS = "wordpress+woocommerce+shopify+smallbusiness+Entrepreneur+laravel+PHP+webdev+SaaS+startups";
const HELP_QUERY =
  'title:("looking for a developer" OR "need a developer" OR "hire a developer" OR "looking to hire" OR "need a web developer" OR "looking for a freelancer" OR "need help with my website")';

// Title must read as someone *asking* for help, not offering it.
const HIRING_TITLE = /\[\s*hiring\s*\]|\bhiring\b|\blooking (for|to hire)\b|\bneed(ed|s)? (a|an|someone|help)\b|\bseeking\b|\bwanted\b/i;
const OFFERING_TITLE = /\[\s*for hire\s*\]|\bfor hire\b|\bavailable for\b|\bi('| a)m a\b|\bhire me\b|\bopen to work\b|\bi('ve| have)? (built|build|help)\b|\bmy services\b/i;
// Outside the hiring subs, only clear "I need a developer" posts count, not discussions.
const STRONG_INTENT = /\b(looking for|need|needed|hire|hiring|seeking|want)\b.{0,30}\b(developer|dev|programmer|freelancer|engineer|coder|someone to (build|fix|make|help|set up))\b/i;

/** Is this post someone asking for a developer? Hiring subs get the looser test. */
export function isRequestTitle(sub: string, title: string) {
  const hiringSub = HIRING_SUBS.toLowerCase().split("+").includes(sub.replace(/^r\//, "").toLowerCase());
  return (hiringSub ? HIRING_TITLE : STRONG_INTENT).test(title) && !OFFERING_TITLE.test(title);
}

type Entry = { id: string; title: string; link: string; author?: string; sub: string; published: Date; body: string };

function tag(xml: string, name: string) {
  return xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
}

export function parseRedditFeed(xml: string): Entry[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const content = htmlToText(decodeEntities(tag(e, "content")))
      .replace(/submitted by\s+\/u\/\S+\s+to\s+r\/\S+[\s\S]*$/i, "")
      .trim();
    return {
      id: tag(e, "id"),
      title: decodeEntities(tag(e, "title")).trim(),
      link: e.match(/<link href="([^"]+)"/)?.[1] ?? "",
      author: tag(tag(e, "author"), "name").replace(/^\/u\//, "") || undefined,
      sub: e.match(/<category[^>]*label="(r\/[^"]+)"/)?.[1] ?? "reddit",
      published: new Date(tag(e, "published") || tag(e, "updated")),
      body: content,
    };
  });
}

function toLead(entry: Entry): RawLead {
  const cleanTitle = entry.title.replace(/^\s*\[[^\]]*\]\s*/g, "").replace(/^\s*\[[^\]]*\]\s*/g, "");
  return {
    source: entry.sub,
    externalId: entry.id,
    url: entry.link,
    title: cleanTitle.slice(0, 160) || entry.title,
    company: entry.author ? `u/${entry.author}` : undefined,
    body: entry.body,
    emails: extractEmails(entry.body),
    redditUser: entry.author && entry.author !== "[deleted]" ? entry.author : undefined,
    applyUrl: extractApplyUrl(entry.body),
    kind: /\b(full[\s-]?time|salary|annual|per year|\/yr|benefits)\b/i.test(entry.body) ? "JOB" : "GIG",
    postedAt: entry.published,
  };
}

export async function fetchReddit(): Promise<RawLead[]> {
  const feeds = [
    `https://www.reddit.com/r/${HIRING_SUBS}/new/.rss?limit=100`,
    `https://www.reddit.com/r/${HELP_SUBS}/search.rss?q=${encodeURIComponent(HELP_QUERY)}&restrict_sr=on&sort=new&t=month&limit=100`,
  ];
  const leads: RawLead[] = [];
  for (const [i, url] of feeds.entries()) {
    if (i > 0) await sleep(4000);
    const entries = parseRedditFeed(await get(url, { retries: 3, backoffMs: 10_000 }));
    for (const entry of entries) {
      if (!isRequestTitle(entry.sub, entry.title)) continue;
      leads.push(toLead(entry));
    }
  }
  return leads;
}
