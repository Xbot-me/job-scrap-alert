import type { Matcher } from "./config";
import { htmlToText } from "./text";

// Reads your portfolio page and turns the tech it mentions into skill
// matchers, so leads are ranked by what you've actually shipped, not just the
// checkboxes in search_config.md.

const TECH: [string, RegExp][] = [
  ["PHP", /\bphp\s?\d?\b/gi],
  ["Laravel", /\blaravel\b/gi],
  ["Symfony", /\bsymfony\b/gi],
  ["WordPress", /\bwordpress\b|\bwp\b(?= (plugin|theme|developer))/gi],
  ["WooCommerce", /\bwoo\s?commerce\b/gi],
  ["Magento", /\bmagento\b/gi],
  ["Shopify", /\bshopify\b/gi],
  ["Python", /\bpython\b/gi],
  ["FastAPI", /\bfast\s?api\b/gi],
  ["Django", /\bdjango\b/gi],
  ["Go", /\bgolang\b|(?<![\w.])Go(?=[\s,/)]|$)(?! (to|ahead|live|from|through|for|with|beyond|back|over|in|on)\b)/g],
  ["Node.js", /\bnode(\.?js)?\b/gi],
  ["TypeScript", /\btypescript\b/gi],
  ["JavaScript", /\bjavascript\b/gi],
  ["React", /\breact(\.js)?\b(?!\s+native)/gi],
  ["Next.js", /\bnext\.?js\b/gi],
  ["Vue", /\bvue(\.js)?\b/gi],
  ["Tailwind", /\btailwind\b/gi],
  ["PostgreSQL", /\bpostgres(ql)?\b/gi],
  ["MySQL", /\b(mysql|mariadb)\b/gi],
  ["Redis", /\bredis\b/gi],
  ["MongoDB", /\bmongo(db)?\b/gi],
  ["Elasticsearch", /\b(elasticsearch|opensearch)\b/gi],
  ["Docker", /\bdocker\b/gi],
  ["Kubernetes", /\b(kubernetes|k8s)\b/gi],
  ["Linux", /\blinux\b/gi],
  ["Bash", /\b(bash|shell scripting)\b/gi],
  ["Nginx", /\bnginx\b/gi],
  ["AWS", /\b(aws|ec2|lambda|s3)\b/g],
  ["GCP", /\b(gcp|google cloud)\b/gi],
  ["Terraform", /\bterraform\b/gi],
  ["CI/CD", /\b(ci\/cd|github actions|gitlab ci)\b/gi],
  ["Prometheus", /\bprometheus\b/gi],
  ["Grafana", /\bgrafana\b/gi],
  ["Microservices", /\bmicro-?services?\b/gi],
  ["WebSockets", /\bweb-?sockets?\b/gi],
  ["LLM / AI agents", /\b(llms?|langgraph|langchain|ai agents?|agentic|openai|rag)\b/gi],
  ["OCR", /\bocr\b/gi],
  ["Scraping", /\b(scraping|scraper|crawler)\b/gi],
  ["E-commerce", /\b(e-?commerce|online store|webshop|checkout)\b/gi],
  ["Payments", /\b(payment gateway|payments?|stripe|paypal)\b/gi],
  ["Anti-fraud", /\b(fraud|anti-fraud|card testing)\b/gi],
  ["Performance", /\b(performance optimi[sz]ation|slow quer(y|ies)|query optimi[sz]ation|page speed|core web vitals)\b/gi],
  ["Security", /\b(application security|web security|security hardening|malware|magecart)\b/gi],
];

export function skillsFromText(text: string): Matcher[] {
  return TECH.filter(([, re]) => text.match(re)).map(([name, re]) => ({ name, re }));
}

/** Fetch the portfolio and return the skills it demonstrates. Empty on failure. */
export async function loadPortfolioSkills(url: string | undefined): Promise<Matcher[]> {
  if (!url) return [];
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    return skillsFromText(htmlToText(await res.text()));
  } catch {
    return [];
  }
}
