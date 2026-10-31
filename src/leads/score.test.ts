import { describe, expect, it } from "vitest";
import { parseSearchConfig } from "./config";
import { classifyRemote, evaluate, type RawLead } from "./score";

const config = parseSearchConfig(`
## Roles
- [x] Full-Stack Developer
- [x] Backend Developer
## Technologies to Include
- [x] PHP
- [x] Go (Golang)
- [x] Node.js
- [x] React
- [ ] Flutter
## Red Flags (Avoid these)
- [x] Crypto / Web3
- [x] Unpaid trial projects
`);

const now = new Date("2026-11-01T00:00:00Z");
const lead = (over: Partial<RawLead>): RawLead => ({
  source: "test", externalId: "1", url: "https://x", title: "Full-stack developer", body: "", emails: [],
  kind: "JOB", postedAt: new Date("2026-10-30T00:00:00Z"), ...over,
});

describe("parseSearchConfig", () => {
  it("only reads checked items", () => {
    expect(config.skills.map((s) => s.name)).toEqual(["PHP", "Go", "Node.js", "React"]);
    expect(config.roles).toHaveLength(2);
  });
});

describe("classifyRemote", () => {
  it.each([
    ["Acme | Backend | REMOTE (US)", "reject"],
    ["Acme | Backend | Remote (US, Canada)", "reject"],
    ["Remote. Must be based in the EU.", "reject"],
    ["US citizens only", "reject"],
    ["Acme | Backend | REMOTE (US Timezones)", "TIMEZONE"],
    ["Remote worldwide, async team", "WORLDWIDE"],
    ["Remote (US, Europe, Asia)", "ASIA_OK"],
    ["Fully remote", "UNSTATED"],
    ["Contact us only by email. Remote.", "UNSTATED"],
    ["Onsite in Berlin", "reject"],
  ])("%s → %s", (text, expected) => {
    const result = classifyRemote(text, "JOB", false);
    expect(typeof result === "object" ? "reject" : result).toBe(expected);
  });
});

describe("evaluate", () => {
  it("ranks a small team with a direct email above a bare apply link", () => {
    const email = evaluate(lead({ body: "Small team, remote worldwide. PHP and React. Email jobs@acme.io", emails: ["jobs@acme.io"] }), config, now);
    const link = evaluate(lead({ body: "Remote worldwide. PHP and React.", applyUrl: "https://acme.io/apply" }), config, now);
    expect(email.keep && link.keep).toBe(true);
    if (email.keep && link.keep) expect(email.score).toBeGreaterThan(link.score + 25);
  });

  it("drops famous companies, red flags, and job-board posts without an email", () => {
    expect(evaluate(lead({ company: "Stripe", body: "remote worldwide php" }), config, now)).toMatchObject({ keep: false });
    expect(evaluate(lead({ body: "remote. Build our web3 dapp in React" }), config, now)).toMatchObject({ keep: false, reason: "Red flag: Crypto" });
    expect(evaluate(lead({ body: "remote php react", fromBoard: true }), config, now)).toMatchObject({ keep: false });
  });

  it("drops jobs outside the stack and non-engineering titles", () => {
    expect(evaluate(lead({ title: "Rust engineer", body: "remote. Rust only" }), config, now)).toMatchObject({ reason: "Outside your stack" });
    expect(evaluate(lead({ title: "Director of Marketing", body: "remote. php react" }), config, now)).toMatchObject({ reason: "Not a hands-on dev role" });
  });

  it("drops non-dev gigs but keeps website fixes", () => {
    expect(evaluate(lead({ kind: "GIG", title: "Video editor for YouTube", body: "paid $20" }), config, now)).toMatchObject({ keep: false });
    const fix = evaluate(lead({ kind: "GIG", title: "Need someone to fix my WordPress site", body: "checkout is broken. $300", redditUser: "bob" }), config, now);
    expect(fix).toMatchObject({ keep: true, pay: "$300" });
  });

  it("drops posts older than 60 days", () => {
    expect(evaluate(lead({ body: "remote php", postedAt: new Date("2026-08-01") }), config, now)).toMatchObject({ reason: "Too old" });
  });
});
