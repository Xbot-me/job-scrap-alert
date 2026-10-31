import type { RawLead } from "../score";
import { decodeEntities, extractApplyEmails, extractApplyUrl, htmlToText } from "../text";
import { get, getJson } from "./http";

// The big remote boards are crowded, so their posts are only kept when the
// description hands you a person's email (scoring drops the rest).

function boardLead(fields: Omit<RawLead, "emails" | "applyUrl" | "kind" | "fromBoard"> & { applyUrl?: string }): RawLead {
  return {
    ...fields,
    emails: extractApplyEmails(fields.body),
    applyUrl: fields.applyUrl ?? extractApplyUrl(fields.body),
    kind: /\b(contract|freelance|part[\s-]?time)\b/i.test(fields.title) ? "GIG" : "JOB",
    fromBoard: true,
  };
}

async function remotive(): Promise<RawLead[]> {
  type J = { id: number; title: string; company_name: string; url: string; description: string; candidate_required_location: string; publication_date: string };
  const { jobs } = await getJson<{ jobs: J[] }>("https://remotive.com/api/remote-jobs?category=software-dev");
  return jobs.map((j) =>
    boardLead({
      source: "Remotive", externalId: String(j.id), url: j.url, title: j.title, company: j.company_name,
      header: `Remote (${j.candidate_required_location})`, body: htmlToText(j.description), postedAt: new Date(j.publication_date),
    }),
  );
}

async function remoteOk(): Promise<RawLead[]> {
  type J = { id?: string; position: string; company: string; url: string; description: string; location: string; date: string };
  const jobs = await getJson<J[]>("https://remoteok.com/api");
  return jobs.filter((j) => j.id).map((j) =>
    boardLead({
      source: "RemoteOK", externalId: String(j.id), url: j.url, title: j.position, company: j.company,
      header: `Remote (${j.location || "unspecified"})`, body: htmlToText(j.description ?? ""), postedAt: new Date(j.date),
    }),
  );
}

async function jobicy(): Promise<RawLead[]> {
  type J = { id: number; url: string; jobTitle: string; companyName: string; jobGeo: string; pubDate: string; jobDescription: string };
  const { jobs } = await getJson<{ jobs: J[] }>("https://jobicy.com/api/v2/remote-jobs?count=100&industry=dev");
  return jobs.map((j) =>
    boardLead({
      source: "Jobicy", externalId: String(j.id), url: j.url, title: decodeEntities(j.jobTitle), company: decodeEntities(j.companyName),
      header: `Remote (${j.jobGeo})`, body: htmlToText(j.jobDescription), postedAt: new Date(j.pubDate),
    }),
  );
}

async function weWorkRemotely(): Promise<RawLead[]> {
  const feeds = ["remote-full-stack-programming-jobs", "remote-back-end-programming-jobs", "remote-devops-sysadmin-jobs"];
  const leads: RawLead[] = [];
  for (const feed of feeds) {
    const xml = await get(`https://weworkremotely.com/categories/${feed}.rss`);
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const field = (n: string) => decodeEntities(item.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1] ?? "").trim();
      const [company, ...rest] = field("title").split(":");
      leads.push(
        boardLead({
          source: "We Work Remotely", externalId: field("guid") || field("link"), url: field("link"),
          title: rest.join(":").trim() || company, company: company.trim(),
          header: `Remote (${field("region") || "unspecified"})`, body: htmlToText(field("description")), postedAt: new Date(field("pubDate")),
        }),
      );
    }
  }
  return leads;
}

export const boardSources = { remotive, remoteOk, jobicy, weWorkRemotely };
