import type { RawLead } from "../score";
import { decodeEntities, extractApplyEmails, extractApplyUrl, htmlToText } from "../text";
import { get, getJson } from "./http";

// The big remote boards are crowded: posts with a person's email rank high,
// apply-form-only posts must be a strong match to be kept at all.

export function boardLead(fields: Omit<RawLead, "emails" | "applyUrl" | "fromBoard"> & { applyUrl?: string }): RawLead {
  return {
    workMode: "REMOTE",
    ...fields,
    emails: extractApplyEmails(fields.body),
    applyUrl: fields.applyUrl ?? extractApplyUrl(fields.body),
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

async function himalayas(): Promise<RawLead[]> {
  type J = { title: string; companyName: string; employmentType: string; locationRestrictions: string[]; description: string; pubDate: number; applicationLink: string; guid: string; minSalary?: number; maxSalary?: number; currency?: string };
  const leads: RawLead[] = [];
  for (let offset = 0; offset < 100; offset += 20) {
    const { jobs } = await getJson<{ jobs: J[] }>(`https://himalayas.app/jobs/api?limit=20&offset=${offset}`);
    for (const j of jobs) {
      const where = j.locationRestrictions?.length ? j.locationRestrictions.join(", ") : "Worldwide";
      leads.push(
        boardLead({
          source: "Himalayas", externalId: j.guid, url: j.guid, title: j.title, company: j.companyName,
          header: `Remote (${where})${j.locationRestrictions?.length ? ` must be based in ${where}` : ""}`,
          body: htmlToText(j.description), postedAt: new Date(j.pubDate * 1000), applyUrl: j.applicationLink,
          employment: /contract/i.test(j.employmentType) ? "CONTRACT" : /part/i.test(j.employmentType) ? "PART_TIME" : /full/i.test(j.employmentType) ? "FULL_TIME" : undefined,
        }),
      );
    }
    if (jobs.length < 20) break;
  }
  return leads;
}

async function workingNomads(): Promise<RawLead[]> {
  type J = { url: string; title: string; description: string; company_name: string; category_name: string; tags: string; location: string; pub_date: string };
  const jobs = await getJson<J[]>("https://www.workingnomads.com/api/exposed_jobs/");
  return jobs
    .filter((j) => /development|devops|sysadmin/i.test(j.category_name))
    .map((j) =>
      boardLead({
        source: "Working Nomads", externalId: j.url, url: j.url, title: j.title, company: j.company_name,
        header: `Remote (${j.location || "Worldwide"})`, body: `${htmlToText(j.description)}\nTags: ${j.tags}`, postedAt: new Date(j.pub_date),
      }),
    );
}

export const boardSources = { remotive, remoteOk, jobicy, weWorkRemotely, himalayas, workingNomads };
export const BOARD_SOURCE_NAMES = ["Remotive", "RemoteOK", "Jobicy", "We Work Remotely", "Himalayas", "Working Nomads"];
