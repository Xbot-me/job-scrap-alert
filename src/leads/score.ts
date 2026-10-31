import type { Matcher, SearchConfig } from "./config";
import {
  detectEmployment, detectLanguage, detectWorkMode, findCountries, findRegion, HOME_COUNTRY, isGig, offersVisa,
  type Employment, type WorkMode,
} from "./classify";
import { daysSince } from "./text";

// One pure function decides whether a post is worth your time and why.
// Every point it gives or takes comes with a human-readable reason, so the
// board can show *why* a lead ranks where it does.

export type Remote = "WORLDWIDE" | "ASIA_OK" | "TIMEZONE" | "REGION" | "UNSTATED";

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
  postedAt: Date;
  /** What the source itself says, when it says it. */
  employment?: Employment;
  workMode?: WorkMode;
  country?: string;
  /** Freelance threads and Reddit hiring posts are gigs unless they say otherwise. */
  gigByDefault?: boolean;
  /** Big aggregator boards: crowded, so they need a strong match to be kept. */
  fromBoard?: boolean;
};

export type Verdict =
  | { keep: false; reason: string }
  | {
      keep: true; score: number; reasons: string[]; skills: string[]; remote: Remote | null; workMode: WorkMode;
      employment: Employment; country: string | null; language: string; visa: boolean; pay?: string;
    };

export const MAX_AGE_DAYS = 60;
/** Leads you can only reach through an apply form must clear this bar. */
export const MIN_SCORE_APPLY_ONLY = 50;

// Household names: thousands of applicants, ATS black holes. Not who you're after.
const FAMOUS = new Set(
  `google alphabet meta facebook amazon aws microsoft apple netflix stripe shopify airbnb uber lyft coinbase openai anthropic
  datadog cloudflare gitlab github atlassian salesforce oracle ibm sap spotify canonical mozilla vercel twilio dropbox slack
  zoom notion figma linear doordash instacart robinhood palantir snowflake databricks mongodb elastic hashicorp okta
  adobe intel nvidia amd tesla spacex samsung sony bytedance tiktok alibaba tencent booking.com expedia paypal block square
  klarna revolut wise n26 monzo deel remote.com toptal turing crossover andela epam globant accenture deloitte infosys
  wipro tcs cognizant capgemini hubspot zendesk intercom asana miro canva grammarly duolingo reddit pinterest snap x twitter
  linkedin indeed glassdoor upwork fiverr pagerduty duckduckgo launchdarkly singlestore
  carrot maven upstart gusto rippling brex ramp plaid chime affirm yandex sber sberbank vk ozon avito kaspersky tinkoff
  t-bank ozontech mts mtswebservices wildberries mercadolibre nubank ifood zalando siemens bosch`.split(/\s+/).filter(Boolean),
);

// Rules that make a job impossible from Bangladesh, whatever the work mode.
const HARD_RESTRICTED = [
  // "US" stays case-sensitive so "contact us only by email" doesn't trip it.
  /\b(US|U\.S\.|USA)[\s/-]*([Oo]nly|ONLY|[Cc]itizens?|[Rr]esidents?)\b/,
  /\b(usa|uk|eu|canada|europe|emea|latam|india|germany|united states)[\s/-]*(only|citizens?|residents?)\b/i,
  /\b(authori[sz]ed|eligible|permitted) to work in\b/i,
  /\b(security clearance|w-?2 only|no (international|offshore|overseas))\b/i,
  /\bsingaporeans?( citizens?)?( and| or|\/)? ?(only|prs?\b)|\bsingapore citizens?\b/i,
  /\b(only|exclusively) (citizens|nationals)\b/i,
  /только (граждане|резиденты) (рф|россии)/i,
];
// Remote, but only for people living somewhere specific.
const REGION_LOCKED = [
  /\bmust (be (based|located)|live|reside) (in|within)\b/i,
  /\b(candidates|applicants|you) (must|should) be (based|located|residing) in\b/i,
  /\bcurrently (based|located|residing) in\b/i,
  /\bremote[^.\n|;]{0,4}?[(\-–,:]\s*(only\s+)?(in\s+)?(the\s+)?(us|u\.s\.|usa|united states|north america|americas|canada|uk|united kingdom|eu|europe|emea|latam|latin america|germany|france|spain|netherlands|india|australia|brazil|brasil)\b(?!\s*(\w+\s+)?(time ?zones?|tz|hours|preferred|overlap))(?![^)\n]{0,40}\b(worldwide|anywhere|asia|apac|global))/i,
];
const WORLDWIDE = /\b(worldwide|anywhere in the world|work from anywhere|remote[^.\n]{0,12}\b(anywhere|global(ly)?)|any country|all time ?zones|any time ?zone|fully distributed|internacional|international candidates)\b/i;
const ASIA = /\b(asia|apac|bangladesh|south asia|gmt ?\+ ?[5-7]|utc ?\+ ?[5-7])\b/i;
const TIMEZONE = /\b((us|est|pst|cet|eu|european|american|pacific|eastern|central) (time ?zones?|tz|hours|business hours)|overlap with)/i;
const NO_SPONSORSHIP = /\b(no|not able to|unable to|cannot|can't|do not|don't|won't) (offer |provide )?(visa )?sponsor|without (visa )?sponsorship\b/i;

const DEV =
  /(?<![\p{L}])(developer|dev|engineer|engineering|programmer|coder|full[\s-]?stack|back[\s-]?end|front[\s-]?end|website|web ?site|web ?app|web development|wordpress|woocommerce|shopify|laravel|php|node|react|next\.?js|api|devops|saas|software|plugin|database|scraper|automation|integration|entwickler\p{L}*|desarrollador\p{L}*|programador\p{L}*|desenvolvedor\p{L}*|développeur\p{L}*|ingénieur|sviluppatore|programista|разработчик\p{L}*|программист\p{L}*|инженер\p{L}*|エンジニア|開発|开发|工程师)(?![\p{L}])/iu;
const NON_DEV_TITLE = /\b(sales|closer|cold call|writer|copywriter|editor|video|voice|ugc|creator|model|tutor|assistant|\bva\b|marketing|seo specialist|social media|recruiter|designer|illustrator|artist|accountant|bookkeep|customer (support|service)|data entry|transcri|translat|photograph|caller|setter)\w*/i;
// Job titles that aren't hands-on engineering, however many skills the body mentions.
const NOT_IC_TITLE =
  /(?<![\p{L}])(director|vp|vice president|head of|manager|chief|marketing|sales|recruit\p{L}*|account executive|designer|analyst|scientist|legal|counsel|finance|support|success|operations|enablement|leiter\p{L}*|vertrieb\p{L}*|gerente|vendas|ventas|руководител\p{L}*|менеджер\p{L}*|директор\p{L}*|продаж\p{L}*|аналитик\p{L}*|дизайнер\p{L}*|тестировщик\p{L}*|qa)(?![\p{L}])/iu;
const MOBILE_ONLY = /\b(ios|android|flutter|react native|swift|kotlin|mobile)\b/i;

const SMALL = /\b(pre-?seed|seed[- ]stage|seed round|bootstrapped|small team|tiny team|small (business|company|agency|startup)|solo founder|co-?founder|founder|family[- ]owned|team of (\d|one|two|three|four|five|six|seven|eight|nine|ten)\b|\d[- ]person|first (engineer|hire|developer)|founding engineer|my (website|site|store|shop|business|app|startup)|our (small|little)|startup)\b/i;
const BIG = /\b(series [c-h]\b|ipo\b|publicly traded|nasdaq|nyse|fortune 500|\d{1,3},\d{3}\+? (employees|people)|unicorn|\$\d+(\.\d+)?\s?b(illion)?\b)/i;
const NEEDS_FIX = /\b(fix|broken|bug|slow|migrat\w*|rescue|take over|maintain|existing (site|app|codebase|website)|previous (dev|developer)|help with my|speed up|not working)\b/i;
const PAY =
  /(?:[$€£₽]\s?\d[\d,.]*\s?k?|\b\d[\d,.]*\s?k?\s?(?:usd|eur|gbp|sgd|brl|rub|руб\.?)(?![\p{L}]))(?:\s?(?:-|–|to|до)\s?[$€£₽]?\s?\d[\d,.]*\s?k?)?(?:\s?(?:\/|per\s)\s?(?:hr|hour|h|month|mo|year|yr|project|week|wk|day))?/iu;

function companyKey(name?: string) {
  return (name ?? "").toLowerCase().replace(/\b(inc|llc|ltd|gmbh|corp|co|sa|bv|ag|ltda)\b\.?/g, "").replace(/[^a-z0-9.-]/g, "");
}

export function isFamous(company?: string) {
  const key = companyKey(company);
  return key.length > 0 && (FAMOUS.has(key) || FAMOUS.has(key.replace(/\.(com|io|ai|co|ru)$/, "")));
}

/** Who a remote job is open to. Only meaningful for remote work. */
export function classifyRemote(text: string): Remote {
  if (ASIA.test(text)) return "ASIA_OK";
  if (WORLDWIDE.test(text)) return "WORLDWIDE";
  if (REGION_LOCKED.some((re) => re.test(text))) return "REGION";
  if (TIMEZONE.test(text)) return "TIMEZONE";
  return "UNSTATED";
}

export function isHardRestricted(text: string) {
  return HARD_RESTRICTED.some((re) => re.test(text));
}

function allSkills(config: SearchConfig): (Matcher & { portfolio: boolean })[] {
  const portfolio = (config.portfolio ?? []).map((m) => ({ ...m, portfolio: true }));
  const names = new Set(portfolio.map((m) => m.name.toLowerCase()));
  return [...portfolio, ...config.skills.filter((m) => !names.has(m.name.toLowerCase())).map((m) => ({ ...m, portfolio: false }))];
}

function matchSkills(text: string, config: SearchConfig) {
  return allSkills(config).filter((s) => text.match(s.re));
}

function modeLabel(mode: WorkMode) {
  return mode === "HYBRID" ? "Hybrid" : mode === "ONSITE" ? "On-site" : "Remote";
}

export function evaluate(lead: RawLead, config: SearchConfig, now = new Date()): Verdict {
  const headline = `${lead.title}\n${lead.header ?? ""}`;
  const text = `${headline}\n${lead.body}`;
  const age = daysSince(lead.postedAt, now);

  if (age > MAX_AGE_DAYS) return { keep: false, reason: "Too old" };
  if (isFamous(lead.company)) return { keep: false, reason: "Well-known company" };
  const flag = config.redFlags.find((f) => f.re.test(text));
  if (flag) return { keep: false, reason: `Red flag: ${flag.name}` };
  if (isHardRestricted(text)) return { keep: false, reason: "Citizens/residents only" };

  const detected = lead.employment ?? detectEmployment(headline, lead.body);
  const employment: Employment = detected === "UNKNOWN" && lead.gigByDefault ? "FREELANCE" : detected;
  const gig = isGig(employment);

  if (gig) {
    if (!DEV.test(text)) return { keep: false, reason: "Not a dev gig" };
    if (NON_DEV_TITLE.test(lead.title) && !DEV.test(lead.title)) return { keep: false, reason: "Not a dev gig" };
  }
  if (!lead.gigByDefault && NOT_IC_TITLE.test(lead.title)) return { keep: false, reason: "Not a hands-on dev role" };

  const skills = matchSkills(text, config);
  const roles = config.roles.filter((r) => r.re.test(text)).map((r) => r.name);
  if (!gig) {
    // A stack keyword buried in a long body isn't enough; it has to be in the headline or repeated.
    // Local-language titles ("Softwareentwickler (m/w/d)") rarely name a stack, so a dev title plus a stack hit in the body counts.
    const headlineFit =
      matchSkills(headline, config).length > 0 || config.roles.some((r) => r.re.test(headline)) || (DEV.test(lead.title) && skills.length > 0);
    if (!headlineFit && skills.length < 2) return { keep: false, reason: "Outside your stack" };
  }
  if (MOBILE_ONLY.test(lead.title) && matchSkills(lead.title, config).length === 0 && !/web|full[\s-]?stack|back[\s-]?end/i.test(lead.title)) {
    return { keep: false, reason: "Mobile-only role" };
  }

  // The headline is the most reliable place for work mode; fall back to the body, then the source.
  const headMode = detectWorkMode(headline);
  const workMode: WorkMode = headMode !== "ONSITE" ? headMode : lead.workMode ?? detectWorkMode(text);
  const visa = offersVisa(text);
  const remote = workMode === "REMOTE" ? classifyRemote(text) : null;
  const country =
    lead.country ??
    (lead.header ? findCountries(lead.header)[0] : undefined) ??
    (workMode !== "REMOTE" || remote === "REGION"
      ? findCountries(`${lead.title}\n${lead.body.slice(0, 400)}`)[0] ?? findRegion(headline) ?? null
      : null);
  if (workMode !== "REMOTE" && country !== HOME_COUNTRY && NO_SPONSORSHIP.test(text)) {
    return { keep: false, reason: "On-site abroad, no visa sponsorship" };
  }

  let score = 20;
  const reasons: string[] = [];
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(why);
  };

  if (lead.emails.length > 0) add(30, "Direct email");
  else if (lead.redditUser) add(22, "Message the poster");
  else if (lead.applyUrl || lead.fromBoard) add(5, "Apply link only");
  else add(0, "Reply on the thread");

  const where = country ? ` in ${country}` : "";
  if (workMode === "REMOTE") {
    if (remote === "ASIA_OK") add(18, "Remote, open to Asia");
    else if (remote === "WORLDWIDE") add(15, "Remote, open worldwide");
    else if (remote === "UNSTATED") add(8, "Remote, no location limits stated");
    else if (remote === "TIMEZONE") add(-3, "Remote, wants US/EU hours overlap");
    else add(-20, `Remote, but only for people${where || " in a specific region"}`);
    if (visa) add(3, "Mentions visa/relocation");
  } else if (country === HOME_COUNTRY) {
    add(12, `${modeLabel(workMode)} in ${HOME_COUNTRY}`);
  } else if (visa) {
    add(8, `${modeLabel(workMode)}${where}, visa/relocation offered`);
  } else {
    add(-18, `${modeLabel(workMode)}${where}, no visa help mentioned`);
  }

  const fromPortfolio = skills.filter((s) => s.portfolio).map((s) => s.name);
  const other = skills.filter((s) => !s.portfolio).map((s) => s.name);
  if (fromPortfolio.length > 0) add(Math.min(fromPortfolio.length, 5) * 4, `Matches your portfolio: ${fromPortfolio.slice(0, 5).join(", ")}`);
  if (other.length > 0) add(Math.min(other.length, 2) * 3, `Also uses ${other.slice(0, 3).join(", ")}`);
  if (roles.length > 0) add(5, `${roles[0]} role`);
  if (SMALL.test(text)) add(12, "Small team / founder");
  if (BIG.test(text)) add(-15, "Larger, well-funded company");
  if (NEEDS_FIX.test(text)) add(8, "Has a concrete problem to fix");
  if (gig) add(5, `${employment === "CONTRACT" ? "Contract" : employment === "PART_TIME" ? "Part-time" : "Freelance"}: can start fast`);

  const pay = text.match(PAY)?.[0]?.trim();
  if (pay) add(3, "Pay mentioned");

  const agePenalty = Math.min(20, Math.floor(age / 3));
  if (agePenalty > 0) add(-agePenalty, `Posted ${Math.floor(age)}d ago`);

  score = Math.max(0, Math.min(100, score));
  if (lead.emails.length === 0 && !lead.redditUser && score < MIN_SCORE_APPLY_ONLY) {
    return { keep: false, reason: "Weak match with only an apply form" };
  }

  return {
    keep: true, score, reasons, skills: skills.map((s) => s.name), remote, workMode, employment, country,
    language: detectLanguage(`${lead.title}\n${lead.body}`), visa, pay,
  };
}
