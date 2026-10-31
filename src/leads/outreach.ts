import { HOME_COUNTRY } from "./classify";
import type { Profile } from "./config";

// Turns a lead into a short, specific first message. Links open your mail
// client (or Gmail / Reddit) with everything filled in; you just attach and send.

type LeadLike = {
  title: string; source: string; employment: string; workMode: string; country: string | null;
  skills: string[]; emails: string[]; redditUser: string | null;
};

export function draftMessage(lead: LeadLike, me: Profile): { subject: string; body: string } {
  const stack = lead.skills.length > 0 ? lead.skills.slice(0, 4).join(", ") : "PHP/Laravel, Node.js/Next.js, React, Go and Docker";
  const where = `your post on ${lead.source}`;
  const gig = lead.employment !== "FULL_TIME" && lead.employment !== "UNKNOWN";
  const base =
    lead.workMode === "REMOTE"
      ? `I work remotely from ${me.location} and I'm used to overlapping with US and European hours.`
      : `I'm based in ${me.location} and open to relocating${lead.country && lead.country !== HOME_COUNTRY ? ` to ${lead.country}` : ""}.`;
  const offer =
    gig
      ? "I can start right away. If it helps, I'm happy to begin with a small paid piece of the work so you can see how I work before committing to more."
      : "I'd be glad to do a short call, or a small paid test task if you prefer to see real work first.";
  const links = [
    me.cvUrl && `CV: ${me.cvUrl}`,
    me.portfolioUrl && `Portfolio: ${me.portfolioUrl}`,
    me.githubUrl && `GitHub: ${me.githubUrl}`,
  ].filter(Boolean);

  const body = [
    "Hi,",
    "",
    `I saw ${where} ("${lead.title}"). I'm a ${me.headline} with ${me.years}+ years of experience, mostly with ${stack}. ${base}`,
    ...(me.proof ? ["", me.proof] : []),
    "",
    offer,
    ...(links.length ? ["", ...links] : []),
    "",
    "Thanks,",
    me.name ?? "",
  ].join("\n").trim();

  return { subject: `Re: ${lead.title}`.slice(0, 120), body };
}

export function contactLinks(lead: LeadLike, me: Profile) {
  const { subject, body } = draftMessage(lead, me);
  const q = (params: Record<string, string>) => new URLSearchParams(params).toString().replace(/\+/g, "%20");
  const email = lead.emails[0];
  return {
    mailto: email ? `mailto:${email}?${q({ subject, body })}` : undefined,
    gmail: email ? `https://mail.google.com/mail/?${q({ view: "cm", fs: "1", to: email, su: subject, body })}` : undefined,
    redditDm: lead.redditUser
      ? `https://www.reddit.com/message/compose/?${q({ to: lead.redditUser, subject: subject.slice(0, 100), message: body })}`
      : undefined,
    draft: `${subject}\n\n${body}`,
  };
}
