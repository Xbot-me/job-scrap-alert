# Leads

Finds remote developer work you can apply to **directly**: a founder's email, a Reddit DM, a small team posting
for itself. Big household-name companies, ATS black holes, and region-locked roles are filtered out, so the inbox
stays short and every item is someone you can actually write to today.

## Where leads come from

| Source | Why it's here |
| --- | --- |
| HN "Who is hiring?" (last 2 months) | Mostly small startups posting themselves, often with a founder's email |
| HN "Freelancer? Seeking freelancer?" | People with a concrete project and no one to build it |
| Reddit hiring subs (r/forhire, r/jobbit, r/hiring, r/remotejs, …) | Small business owners hiring directly; you can DM them |
| Reddit small-business / dev subs (r/wordpress, r/shopify, r/smallbusiness, …) | "I need a developer for my site" posts |
| Remotive, RemoteOK, Jobicy, We Work Remotely | **Only** when the post gives a real person's email |

## How a lead is judged (`src/leads/score.ts`)

Dropped outright: older than 60 days, well-known company, red flags from `search_config.md`, restricted to a
country/region (e.g. "Remote (US)", "must be based in the EU"), not remote, not a hands-on dev role, or outside the
stack you ticked in `search_config.md`.

Everything else is scored 0–100, and each point comes with a reason you can read on the card: direct email beats a
Reddit DM, and both beat an apply link. Being open to Asia or worldwide, matching your stack, a small team or founder,
a concrete thing to fix, freelance (quick to start), and stated pay all add points. Wanting US/EU-hours overlap,
signs of a big well-funded company, and age all take points away.

## Using it

```bash
npm install
npm run db:migrate     # creates the Lead table in DATABASE_URL
npm run leads:sync     # or press "Find new leads" in the app
npm run dev            # http://localhost:3000
```

Fill in the `OUTREACH_*` values in `.env` (see `.env.example`), especially `OUTREACH_CV_URL`, a public link to your CV.
Every **Email** / **Gmail** / **Message u/…** button then opens a short, specific draft that names the post and the
stack it matched. Attach your CV if you like, send it, then press **Sent**. Contacted leads show a follow-up nudge after 5 days.

What you're looking for (roles, technologies, red flags) lives in `search_config.md`, which is shared with the Telegram bot
(`job_alert.py`). Edit the checkboxes and the next sync re-judges everything still in your inbox.

```bash
npm test               # scoring, remote-restriction and email-extraction rules
```
