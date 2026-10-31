import type { Employment, WorkMode } from "../classify";
import type { RawLead } from "../score";
import { decodeEntities, extractApplyEmails, extractApplyUrl, htmlToText } from "../text";
import { get, getJson, sleep } from "./http";

// Country job boards in their own languages: Germany (German), Russia
// (Russian), Brazil (Portuguese), Singapore. On-site and hybrid roles are kept;
// scoring weighs them by visa/relocation support.

const SEARCH_TERMS = ["php", "python", "golang", "devops", "wordpress", "full stack"];

async function arbeitnow(): Promise<RawLead[]> {
  type J = { slug: string; company_name: string; title: string; description: string; remote: boolean; url: string; tags: string[]; job_types: string[]; location: string; created_at: number };
  const leads: RawLead[] = [];
  for (let page = 1; page <= 3; page++) {
    const { data } = await getJson<{ data: J[] }>(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    for (const j of data) {
      const body = htmlToText(j.description);
      const types = j.job_types.join(" ");
      leads.push({
        source: "Arbeitnow", externalId: j.slug, url: j.url, title: j.title, company: j.company_name,
        header: `${j.location}, Germany | ${types} | ${j.tags.join(", ")}`,
        body, emails: extractApplyEmails(body), applyUrl: j.url, postedAt: new Date(j.created_at * 1000),
        workMode: j.remote ? "REMOTE" : undefined, fromBoard: true,
      });
    }
    if (data.length < 100) break;
  }
  return leads;
}

async function habrCareer(): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  for (const [i, q] of SEARCH_TERMS.entries()) {
    if (i > 0) await sleep(800);
    const xml = await get(`https://career.habr.com/vacancies/rss?q=${encodeURIComponent(q)}&type=all`);
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const field = (n: string) => decodeEntities(item.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1] ?? "").trim();
      const title = field("title");
      const body = field("description");
      leads.push({
        source: "Habr Career", externalId: field("guid"), url: field("link"),
        title: title.match(/«(.+)»/)?.[1] ?? title, company: field("author"),
        header: "Russia", body, emails: extractApplyEmails(body), applyUrl: field("link"),
        postedAt: new Date(field("pubDate")), country: "Russia", fromBoard: true,
      });
    }
  }
  return leads;
}

const BR_LABELS: Record<string, { workMode?: WorkMode; employment?: Employment }> = {
  remoto: { workMode: "REMOTE" }, "híbrido": { workMode: "HYBRID" }, hibrido: { workMode: "HYBRID" }, presencial: { workMode: "ONSITE" },
  pj: { employment: "CONTRACT" }, clt: { employment: "FULL_TIME" }, freela: { employment: "FREELANCE" }, freelancer: { employment: "FREELANCE" },
};

// Brazilian dev communities post jobs as GitHub issues, often with an email to send your CV to.
async function brazilGithub(): Promise<RawLead[]> {
  type Issue = { number: number; title: string; body: string | null; html_url: string; created_at: string; labels: { name: string }[]; pull_request?: unknown };
  const leads: RawLead[] = [];
  for (const repo of ["backend-br/vagas", "frontendbr/vagas"]) {
    const issues = await getJson<Issue[]>(`https://api.github.com/repos/${repo}/issues?state=open&sort=created&per_page=60`);
    for (const issue of issues.filter((i) => !i.pull_request)) {
      const hints = issue.labels.map((l) => BR_LABELS[l.name.toLowerCase()]).filter(Boolean);
      const body = issue.body ?? "";
      const international = /internacional|international|worldwide|anywhere/i.test(`${issue.title} ${body.slice(0, 600)}`);
      const company = issue.title.match(/\bn[ao]s? ([A-Z][\w.&-]*(?: [A-Z][\w.&-]*)*)/)?.[1];
      leads.push({
        source: "Brazil dev jobs (GitHub)", externalId: `${repo}#${issue.number}`, url: issue.html_url,
        title: issue.title.replace(/^(\s*\[[^\]]*\])+\s*/, "").slice(0, 160) || issue.title, company,
        header: `${issue.title} | ${issue.labels.map((l) => l.name).join(", ")}${international ? "" : " | Remote (Brazil)"}`,
        body, emails: extractApplyEmails(body), applyUrl: extractApplyUrl(body), postedAt: new Date(issue.created_at),
        workMode: hints.find((h) => h.workMode)?.workMode, employment: hints.find((h) => h.employment)?.employment,
        country: international ? undefined : "Brazil",
      });
    }
  }
  return leads;
}

async function singapore(): Promise<RawLead[]> {
  type J = {
    uuid: string; title: string; description: string; postedCompany: { name: string }; employmentTypes: { employmentType: string }[];
    flexibleWorkArrangements: { flexibleWorkArrangement?: string }[]; salary?: { minimum: number; maximum: number; type?: { salaryType: string } };
    metadata: { createdAt: string; jobDetailsUrl: string };
  };
  const leads: RawLead[] = [];
  for (const q of SEARCH_TERMS) {
    const { results } = await getJson<{ results: J[] }>(`https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(q)}&limit=30&page=0`);
    for (const j of results) {
      const types = j.employmentTypes.map((t) => t.employmentType).join(" ");
      const flexible = JSON.stringify(j.flexibleWorkArrangements);
      const salary = j.salary ? `S$${j.salary.minimum}-${j.salary.maximum} ${j.salary.type?.salaryType ?? ""}` : "";
      const body = `${htmlToText(j.description)}\n${salary}`;
      leads.push({
        source: "MyCareersFuture", externalId: j.uuid, url: j.metadata.jobDetailsUrl, title: j.title, company: j.postedCompany?.name,
        header: `Singapore | ${types}`, body, emails: extractApplyEmails(body), applyUrl: j.metadata.jobDetailsUrl,
        postedAt: new Date(j.metadata.createdAt), country: "Singapore",
        workMode: /remote|work from home/i.test(flexible) ? "HYBRID" : "ONSITE",
        employment: /freelance/i.test(types) ? "FREELANCE" : /contract|temporary/i.test(types) ? "CONTRACT" : /part/i.test(types) ? "PART_TIME" : /full|permanent/i.test(types) ? "FULL_TIME" : undefined,
        fromBoard: true,
      });
    }
  }
  return leads;
}

export const countrySources = { arbeitnow, habrCareer, brazilGithub, singapore };
export const COUNTRY_SOURCE_NAMES = ["Arbeitnow", "Habr Career", "MyCareersFuture"];
