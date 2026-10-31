import { readFileSync } from "node:fs";
import path from "node:path";

// What you're looking for comes from search_config.md (shared with the
// Telegram bot); who you are comes from .env so it never lands in git.

export type Matcher = { name: string; re: RegExp };

export type SearchConfig = {
  skills: Matcher[];
  roles: Matcher[];
  redFlags: Matcher[];
};

export type Profile = {
  name?: string;
  years: string;
  location: string;
  headline: string;
  cvUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
};

// Checkbox labels → what to look for in a post. Related tools count as a
// match (a WordPress gig is a PHP gig).
const SKILL_PATTERNS: Record<string, RegExp> = {
  php: /\b(php|laravel|symfony|wordpress|woocommerce|codeigniter|magento)\b/gi,
  "go (golang)": /\bgolang\b|(?<![\w.])Go(?=[\s,/)]|$)(?! (to|ahead|live|from|through|for|with|beyond|back|over|in|on)\b)/g,
  "next.js": /\bnext\.?js\b/gi,
  "node.js": /\b(node\.?js|node|express(\.js)?|nestjs)\b/gi,
  react: /\breact(\.js)?\b(?!\s+native)/gi,
  docker: /\b(docker|kubernetes|k8s|containers?)\b/gi,
  mysql: /\b(mysql|mariadb)\b/gi,
  python: /\b(python|django|flask|fastapi)\b/gi,
  flutter: /\bflutter\b/gi,
  "react native": /\breact native\b/gi,
};

const ROLE_PATTERNS: Record<string, RegExp> = {
  "full-stack developer": /\bfull[\s-]?stack\b/i,
  "backend developer": /\bback[\s-]?end\b/i,
  "devops / infrastructure engineer": /\b(devops|sre|site reliability|infrastructure|platform engineer)\b/i,
  "frontend developer": /\bfront[\s-]?end\b/i,
  "mobile developer": /\b(mobile|ios|android)\b/i,
  "data scientist": /\b(data scien|machine learning|ml engineer)\w*/i,
};

const RED_FLAG_PATTERNS: Record<string, RegExp> = {
  "crypto / web3": /\b(crypto|web3|blockchain|nft|defi|solidity|token sale|memecoin)\b/i,
  "commission-only sales": /\bcommission[\s-]only\b|\b(100%|purely|straight) commission\b/i,
  "unpaid trial projects": /\bunpaid\b|\bequity[\s-]only\b|\bno (upfront )?pay\b|\bfor (free|exposure)\b|\brev(enue)?[\s-]share only\b/i,
  '"chat to earn" or low-quality tasks': /\bchat to earn\b|\b(pay|send)( us)? (a |an )?(registration|training|processing|onboarding) fee\b/i,
};

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayName(label: string) {
  return label.replace(/\s*\(.*\)/, "").split(" / ")[0].trim();
}

export function parseSearchConfig(markdown: string): SearchConfig {
  const config: SearchConfig = { skills: [], roles: [], redFlags: [] };
  let section: keyof SearchConfig | null = null;
  for (const line of markdown.split("\n").map((l) => l.trim())) {
    if (line.startsWith("## ")) {
      section = /roles/i.test(line) ? "roles" : /technolog/i.test(line) ? "skills" : /red flags/i.test(line) ? "redFlags" : null;
      continue;
    }
    const checked = line.match(/^[-*]\s+\[[xX]\]\s+(.+)$/);
    if (!checked || !section) continue;
    const label = checked[1].trim();
    const key = label.toLowerCase();
    const known = { skills: SKILL_PATTERNS, roles: ROLE_PATTERNS, redFlags: RED_FLAG_PATTERNS }[section][key];
    const re = known ?? new RegExp(`\\b${escape(displayName(label))}\\b`, section === "skills" ? "gi" : "i");
    config[section].push({ name: displayName(label), re });
  }
  return config;
}

let cached: SearchConfig | undefined;
export function loadSearchConfig(): SearchConfig {
  if (!cached) {
    let md = "";
    try {
      md = readFileSync(path.join(process.cwd(), "search_config.md"), "utf8");
    } catch {
      // Fall back to an empty config; scoring still works on contact/remote signals.
    }
    cached = parseSearchConfig(md);
  }
  return cached;
}

export function loadProfile(env: Record<string, string | undefined> = process.env): Profile {
  const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    name: blank(env.OUTREACH_NAME),
    years: blank(env.OUTREACH_YEARS) ?? "6",
    location: blank(env.OUTREACH_LOCATION) ?? "Dhaka, Bangladesh",
    headline: blank(env.OUTREACH_HEADLINE) ?? "full-stack developer",
    cvUrl: blank(env.OUTREACH_CV_URL),
    portfolioUrl: blank(env.OUTREACH_PORTFOLIO_URL),
    githubUrl: blank(env.OUTREACH_GITHUB_URL),
  };
}
