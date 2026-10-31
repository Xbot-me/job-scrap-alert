// Text helpers shared by every source: HTML → plain text, contact extraction.

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([\da-f]+);/gi, (_, x: string) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** HTML → readable plain text. Keeps paragraph breaks and link targets. */
export function htmlToText(html: string): string {
  return decodeEntities(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      if (href.startsWith("mailto:")) return href.slice(7).split("?")[0];
      return text && !text.endsWith("...") && !href.includes(text.replace(/^https?:\/\//, "")) ? `${text} (${href})` : href;
    })
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<\s*(p|li)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PLAIN_EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// "jobs [at] acme [dot] com", "hi (at) acme.io", "jobs at acme dot com"
const OBFUSCATED_EMAIL =
  /([a-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*([a-z0-9-]+(?:(?:\s*(?:\[dot\]|\(dot\)|\{dot\})\s*|\s+dot\s+|\.)[a-z0-9-]+)+)/gi;
// A bare " at " is a normal English word, so only trust it for mailbox-like local parts.
const MAILBOX_WORDS =
  /^(jobs|job|hiring|hire|careers|career|hello|hi|hey|contact|work|team|founders?|cto|ceo|apply|recruiting|talent|info|eng|engineering|people|hr|join|dev|devs)$/i;
const JUNK_EMAIL = /(accommodat|accessib|eeo|benefits|payroll|press@|media@|support@|billing@|noreply|no-reply|donotreply|example\.(com|org)|sentry|wixpress|privacy@|legal@|abuse@|security@|\.(png|jpe?g|gif|svg|webp)$)/i;

export function extractEmails(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(PLAIN_EMAIL)) found.add(m[0]);
  for (const m of text.matchAll(OBFUSCATED_EMAIL)) {
    const [whole, local, domainRaw] = m;
    const bracketed = /[[({]at[\])}]/i.test(whole);
    const spelledDot = /\bdot\b/i.test(domainRaw);
    if (!bracketed && !spelledDot && !MAILBOX_WORDS.test(local)) continue;
    const domain = domainRaw.replace(/\s*(?:\[dot\]|\(dot\)|\{dot\})\s*|\s+dot\s+/gi, ".");
    if (!/\.[a-z]{2,}$/i.test(domain)) continue;
    found.add(`${local}@${domain}`);
  }
  return [...found]
    .map((e) => e.toLowerCase().replace(/[.,;:]+$/, ""))
    .filter((e, i, all) => !JUNK_EMAIL.test(e) && all.indexOf(e) === i);
}

const APPLY_WORDS = /\b(apply|send|email|e-mail|reach out|contact|cv|resume|résumé|portfolio|write to|drop (us|me) a)\b/i;

/** Emails that sit next to an invitation to apply, not footers and policy boilerplate. */
export function extractApplyEmails(text: string): string[] {
  return extractEmails(text).filter((email) => {
    const at = text.toLowerCase().indexOf(email.split("@")[0]);
    const window = at < 0 ? text : text.slice(Math.max(0, at - 160), at + email.length + 40);
    return APPLY_WORDS.test(window);
  });
}

/** First external link that isn't the post itself — usually the apply page. */
export function extractApplyUrl(text: string): string | undefined {
  for (const m of text.matchAll(/https?:\/\/[^\s)<>"']+/g)) {
    const url = m[0].replace(/[.,;:]+$/, "");
    if (!/(news\.ycombinator\.com|reddit\.com|redd\.it|imgur\.com|i\.redd)/.test(url)) return url;
  }
  return undefined;
}

export function daysSince(date: Date, now = new Date()): number {
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}
