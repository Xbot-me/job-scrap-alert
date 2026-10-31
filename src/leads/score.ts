import type { SearchConfig } from "./config";
import { daysSince } from "./text";

// One pure function decides whether a post is worth your time and why.
// Every point it gives or takes comes with a human-readable reason, so the
// board can show *why* a lead ranks where it does.

export type Kind = "GIG" | "JOB";
export type Remote = "WORLDWIDE" | "ASIA_OK" | "TIMEZONE" | "UNSTATED";

export type RawLead = {
  source: string;
  externalId: string;
  url: string;
  title: string;
  company?: string;
  /** Location / header line, where restrictions usually live. */
  header?: string;
  body: string;
  emails: string[];
  redditUser?: string;
  applyUrl?: string;
  kind: Kind;
  postedAt: Date;
  /** Big aggregator boards: only worth it when they expose a direct email. */
  fromBoard?: boolean;
};

export type Verdict =
  | { keep: false; reason: string }
  | { keep: true; score: number; reasons: string[]; skills: string[]; remote: Remote; pay?: string };

export const MAX_AGE_DAYS = 60;

// Household names: thousands of applicants, ATS black holes. Not who you're after.
const FAMOUS = new Set(
  `google alphabet meta facebook amazon aws microsoft apple netflix stripe shopify airbnb uber lyft coinbase openai anthropic
  datadog cloudflare gitlab github atlassian salesforce oracle ibm sap spotify canonical mozilla vercel twilio dropbox slack
  zoom notion figma linear doordash instacart robinhood palantir snowflake databricks mongodb elastic hashicorp okta
  adobe intel nvidia amd tesla spacex samsung sony bytedance tiktok alibaba tencent booking.com expedia paypal block square
  klarna revolut wise n26 monzo deel remote.com toptal turing crossover andela epam globant accenture deloitte infosys
  wipro tcs cognizant capgemini hubspot zendesk intercom asana miro canva grammarly duolingo reddit pinterest snap x twitter
  linkedin indeed glassdoor upwork fiverr pagerduty duckduckgo launchdarkly singlestore
  carrot maven upstart gusto rippling brex ramp plaid chime affirm`.split(/\s+/).filter(Boolean),
);

const RESTRICTED = [
  // "US" stays case-sensitive so "contact us only by email" doesn't trip it.
  /\b(US|U\.S\.|USA)[\s/-]*([Oo]nly|ONLY|[Cc]itizens?|[Rr]esidents?)\b/,
  /\b(usa|uk|eu|canada|europe|emea|latam|india|germany|united states)[\s/-]*(only|citizens?|residents?)\b/i,
  /\bmust (be (based|located)|live|reside) (in|within)\b/i,
  /\b(authori[sz]ed|eligible|permitted) to work in\b/i,
  /\b(security clearance|w-?2 only|no (international|offshore|overseas))\b/i,
  /\b(candidates|applicants|you) (must|should) be (based|located|residing) in\b/i,
  /\bcurrently (based|located|residing) in\b/i,
  /\bremote[^.\n|;]{0,4}?[(\-–,:]\s*(only\s+)?(in\s+)?(the\s+)?(us|u\.s\.|usa|united states|north america|americas|canada|uk|united kingdom|eu|europe|emea|latam|latin america|germany|france|spain|netherlands|india|australia)\b(?!\s*(\w+\s+)?(time ?zones?|tz|hours|preferred|overlap))(?![^)\n]{0,40}\b(worldwide|anywhere|asia|apac|global))/i,
  /\b(no remote|on-?site only|in[- ]office only|not remote|hybrid only)\b/i,
];
const WORLDWIDE = /\b(worldwide|anywhere in the world|work from anywhere|remote[^.\n]{0,12}\b(anywhere|global(ly)?)|any country|all time ?zones|any time ?zone|fully distributed)\b/i;
const ASIA = /\b(asia|apac|bangladesh|south asia|gmt ?\+ ?[5-7]|utc ?\+ ?[5-7])\b/i;
const TIMEZONE = /\b((us|est|pst|cet|eu|european|american|pacific|eastern|central) (time ?zones?|tz|hours|business hours)|overlap with)/i;
const MENTIONS_REMOTE = /\b(remote|remotely|distributed|work from home|wfh)\b/i;

const DEV = /\b(developer|dev|engineer|engineering|programmer|coder|full[\s-]?stack|back[\s-]?end|website|web ?site|web ?app|web development|wordpress|woocommerce|shopify|laravel|php|node|react|next\.?js|api|devops|saas|software|plugin|database|scraper|automation|integration)\b/i;
const NON_DEV_TITLE = /\b(sales|closer|cold call|writer|copywriter|editor|video|voice|ugc|creator|model|tutor|assistant|\bva\b|marketing|seo specialist|social media|recruiter|designer|illustrator|artist|accountant|bookkeep|customer (support|service)|data entry|transcri|translat|photograph|caller|setter)\w*/i;
// Job titles that aren't hands-on engineering, however many skills the body mentions.
const NOT_IC_TITLE = /\b(director|vp|vice president|head of|manager|chief|marketing|sales|recruit\w*|account executive|designer|analyst|scientist|legal|counsel|finance|support|success|operations|enablement)\b/i;
const MOBILE_ONLY = /\b(ios|android|flutter|react native|swift|kotlin|mobile)\b/i;

const SMALL = /\b(pre-?seed|seed[- ]stage|seed round|bootstrapped|small team|tiny team|small (business|company|agency|startup)|solo founder|co-?founder|founder|family[- ]owned|team of (\d|one|two|three|four|five|six|seven|eight|nine|ten)\b|\d[- ]person|first (engineer|hire|developer)|founding engineer|my (website|site|store|shop|business|app|startup)|our (small|little))\b/i;
const BIG = /\b(series [c-h]\b|ipo\b|publicly traded|nasdaq|nyse|fortune 500|\d{1,3},\d{3}\+? (employees|people)|unicorn|\$\d+(\.\d+)?\s?b(illion)?\b)/i;
const NEEDS_FIX = /\b(fix|broken|bug|slow|migrat\w*|rescue|take over|maintain|existing (site|app|codebase|website)|previous (dev|developer)|help with my|speed up|not working)\b/i;
const PAY = /(?:[$€£]\s?\d[\d,.]*\s?k?|\b\d[\d,.]*\s?k?\s?(?:usd|eur|gbp)\b)(?:\s?(?:-|–|to)\s?[$€£]?\s?\d[\d,.]*\s?k?)?(?:\s?(?:\/|per\s)\s?(?:hr|hour|h|month|mo|year|yr|project|week|wk|day))?/i;

function companyKey(name?: string) {
  return (name ?? "").toLowerCase().replace(/\b(inc|llc|ltd|gmbh|corp|co|sa|bv|ag)\b\.?/g, "").replace(/[^a-z0-9.]/g, "");
}

export function isFamous(company?: string) {
  const key = companyKey(company);
  return key.length > 0 && (FAMOUS.has(key) || FAMOUS.has(key.replace(/\.(com|io|ai|co)$/, "")));
}

export function classifyRemote(text: string, kind: Kind, impliedRemote: boolean): Remote | { reject: string } {
  if (ASIA.test(text)) return "ASIA_OK";
  if (WORLDWIDE.test(text)) return "WORLDWIDE";
  if (RESTRICTED.some((re) => re.test(text))) return { reject: "Restricted to a country/region you're not in" };
  if (TIMEZONE.test(text)) return "TIMEZONE";
  if (impliedRemote || kind === "GIG" || MENTIONS_REMOTE.test(text)) return "UNSTATED";
  return { reject: "Not remote" };
}

function matchSkills(text: string, config: SearchConfig): string[] {
  const hits: string[] = [];
  for (const skill of config.skills) {
    for (const m of text.matchAll(skill.re)) {
      const word = m[0].toLowerCase() === m[0] && m[0].length <= 3 ? m[0].toUpperCase() : m[0];
      const pretty = /^(php|node|react|docker|mysql|golang|go)$/i.test(word) ? skill.name : word.replace(/^\w/, (c) => c.toUpperCase());
      if (!hits.some((h) => h.toLowerCase() === pretty.toLowerCase())) hits.push(pretty);
    }
  }
  return hits;
}

export function evaluate(lead: RawLead, config: SearchConfig, now = new Date()): Verdict {
  const headline = `${lead.title}\n${lead.header ?? ""}`;
  const text = `${headline}\n${lead.body}`;
  const age = daysSince(lead.postedAt, now);

  if (age > MAX_AGE_DAYS) return { keep: false, reason: "Too old" };
  if (isFamous(lead.company)) return { keep: false, reason: "Well-known company" };
  if (lead.fromBoard && lead.emails.length === 0) return { keep: false, reason: "Job board post with no direct contact" };
  const flag = config.redFlags.find((f) => f.re.test(text));
  if (flag) return { keep: false, reason: `Red flag: ${flag.name}` };

  if (lead.kind === "GIG") {
    if (!DEV.test(text)) return { keep: false, reason: "Not a dev gig" };
    if (NON_DEV_TITLE.test(lead.title) && !DEV.test(lead.title)) return { keep: false, reason: "Not a dev gig" };
  }

  const skills = matchSkills(text, config);
  const roles = config.roles.filter((r) => r.re.test(text)).map((r) => r.name);
  if (lead.kind === "JOB") {
    if (NOT_IC_TITLE.test(lead.title)) return { keep: false, reason: "Not a hands-on dev role" };
    // A stack keyword buried in a long body isn't enough; it has to be in the headline or repeated.
    const headlineFit = matchSkills(headline, config).length > 0 || config.roles.some((r) => r.re.test(headline));
    if (!headlineFit && skills.length < 2) return { keep: false, reason: "Outside your stack" };
  }
  if (MOBILE_ONLY.test(lead.title) && matchSkills(lead.title, config).length === 0 && !/web|full[\s-]?stack|back[\s-]?end/i.test(lead.title)) {
    return { keep: false, reason: "Mobile-only role" };
  }

  const remote = classifyRemote(text, lead.kind, Boolean(lead.fromBoard));
  if (typeof remote === "object") return { keep: false, reason: remote.reject };

  let score = 20;
  const reasons: string[] = [];
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(why);
  };

  if (lead.emails.length > 0) add(30, "Direct email");
  else if (lead.redditUser) add(22, "Message the poster");
  else if (lead.applyUrl) add(5, "Apply link only");
  else add(0, "Reply on the thread");

  if (remote === "ASIA_OK") add(18, "Open to Asia");
  else if (remote === "WORLDWIDE") add(15, "Open worldwide");
  else if (remote === "UNSTATED") add(5, "Remote, no location limits stated");
  else add(-5, "Wants US/EU hours overlap");

  if (skills.length > 0) add(Math.min(skills.length, 4) * 5, `Uses ${skills.slice(0, 4).join(", ")}`);
  if (roles.length > 0) add(5, `${roles[0]} role`);
  if (SMALL.test(text)) add(12, "Small team / founder");
  if (BIG.test(text)) add(-15, "Larger, well-funded company");
  if (NEEDS_FIX.test(text)) add(8, "Has a concrete problem to fix");
  if (lead.kind === "GIG") add(5, "Freelance: can start fast");

  const pay = text.match(PAY)?.[0]?.trim();
  if (pay) add(3, "Pay mentioned");

  const agePenalty = Math.min(20, Math.floor(age / 3));
  if (agePenalty > 0) add(-agePenalty, `Posted ${Math.floor(age)}d ago`);

  return { keep: true, score: Math.max(0, Math.min(100, score)), reasons, skills, remote, pay };
}
