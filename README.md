# Leads

Finds developer work in **any country, remote or on-site, freelance, contract or full-time**, from teams you can
reach directly: a founder's email, a Reddit DM, a small team posting for itself. Leads are ranked by how well they
match the tech on your portfolio. Household-name companies, citizens-only roles and weak apply-form-only postings
are filtered out.

## Where leads come from

| Source | Country / language | Why it's here |
| --- | --- | --- |
| HN "Who is hiring?" (last 2 months) | Global, English | Small startups posting themselves, often with a founder's email |
| HN "Freelancer? Seeking freelancer?" | Global, English | People with a concrete project and no one to build it |
| Reddit hiring + small-business subs | Global, English | Owners hiring directly; you can DM them |
| Arbeitnow | Germany / EU, German + English | Remote, hybrid and on-site roles, often with relocation |
| Habr Career | Russia / CIS, Russian | Searched for PHP, Python, Go, DevOps, WordPress, full-stack |
| backend-br/vagas, frontendbr/vagas (GitHub) | Brazil, Portuguese | Community job boards, often with an email for your CV |
| MyCareersFuture | Singapore | Government job board, salaries always listed |
| Remotive, RemoteOK, Jobicy, We Work Remotely, Himalayas, Working Nomads | Global remote | Kept when there's a direct email or a strong match |

## How a lead is judged

`src/leads/classify.ts` reads each post in English, German, Spanish, Portuguese, French, Polish, Russian or Japanese
to work out its **country**, **work mode** (remote / hybrid / on-site), **type** (freelance / contract / part-time /
full-time), **visa or relocation support**, and **language**.

`src/leads/score.ts` then drops posts that can't work: older than 60 days, well-known company, citizens/residents only,
on-site abroad with "no visa sponsorship", red flags from `search_config.md`, non-engineering roles, or outside your
stack. Everything else is scored 0–100, and each point comes with a reason shown on the card:

- **Contact:** direct email beats a Reddit DM, which beats an apply link.
- **Where:** remote and open to Asia or worldwide scores best. On-site in Bangladesh, or abroad with visa/relocation, is good. On-site abroad without visa help, or remote only for residents of one country, scores low.
- **Fit:** skills found on your portfolio (`OUTREACH_PORTFOLIO_URL`) count most; checked items in `search_config.md` add a little.
- **Bonuses and penalties:** small team or founder, a concrete problem to fix, freelance/contract (can start fast) and stated pay all add points; signs of a big well-funded company and age take points away.

## Using it

```bash
npm install
npm run db:migrate     # creates the Lead table in DATABASE_URL
npm run leads:sync     # or press "Find new leads" in the app
npm run dev            # http://localhost:3000
```

Fill in the `OUTREACH_*` values in `.env` (see `.env.example`), especially `OUTREACH_CV_URL` (a public link to your
CV) and `OUTREACH_PORTFOLIO_URL` (its tech stack drives the ranking). Filter the inbox by country, work mode, type,
"has email" and "visa / relocation".
Every **Email** / **Gmail** / **Message u/…** button then opens a short, specific draft that names the post and the
stack it matched. Attach your CV if you like, send it, then press **Sent**. Contacted leads show a follow-up nudge after 5 days.

What you're looking for (roles, technologies, red flags) lives in `search_config.md`, which is shared with the Telegram bot
(`job_alert.py`). Edit the checkboxes and the next sync re-judges everything still in your inbox.

```bash
npm test               # scoring, remote-restriction and email-extraction rules
```
