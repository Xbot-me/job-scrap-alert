import { describe, expect, it } from "vitest";
import { parseSearchConfig } from "./config";
import { classifyRemote, evaluate, isHardRestricted, type RawLead } from "./score";

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
  postedAt: new Date("2026-10-30T00:00:00Z"), ...over,
});

describe("parseSearchConfig", () => {
  it("only reads checked items", () => {
    expect(config.skills.map((s) => s.name)).toEqual(["PHP", "Go", "Node.js", "React"]);
    expect(config.roles).toHaveLength(2);
  });
});

describe("classifyRemote", () => {
  it.each([
    ["Acme | Backend | REMOTE (US)", "REGION"],
    ["Acme | Backend | Remote (US, Canada)", "REGION"],
    ["Remote. Must be based in the EU.", "REGION"],
    ["Acme | Backend | REMOTE (US Timezones)", "TIMEZONE"],
    ["Remote worldwide, async team", "WORLDWIDE"],
    ["Remote (US, Europe, Asia)", "ASIA_OK"],
    ["Fully remote", "UNSTATED"],
    ["Contact us only by email. Remote.", "UNSTATED"],
  ])("%s → %s", (text, expected) => {
    expect(classifyRemote(text)).toBe(expected);
  });

  it("treats citizenship rules as impossible, but not 'contact us only'", () => {
    expect(isHardRestricted("US citizens only")).toBe(true);
    expect(isHardRestricted("Remote - US Only")).toBe(true);
    expect(isHardRestricted("Singaporeans only")).toBe(true);
    expect(isHardRestricted("Contact us only by email")).toBe(false);
  });
});

describe("evaluate", () => {
  it("ranks a small team with a direct email above a bare apply link", () => {
    const email = evaluate(lead({ body: "Small team, remote worldwide. PHP and React. Email jobs@acme.io", emails: ["jobs@acme.io"] }), config, now);
    const link = evaluate(lead({ body: "Remote worldwide. PHP and React.", applyUrl: "https://acme.io/apply" }), config, now);
    expect(email.keep && link.keep).toBe(true);
    if (email.keep && link.keep) expect(email.score).toBeGreaterThan(link.score + 25);
  });

  it("drops famous companies, red flags, and weak apply-form-only board posts", () => {
    expect(evaluate(lead({ company: "Stripe", body: "remote worldwide php" }), config, now)).toMatchObject({ keep: false });
    expect(evaluate(lead({ body: "remote. Build our web3 dapp in React" }), config, now)).toMatchObject({ keep: false, reason: "Red flag: Crypto" });
    expect(evaluate(lead({ body: "remote php react", fromBoard: true }), config, now)).toMatchObject({ keep: false });
  });

  it("keeps on-site jobs, preferring home country and visa support", () => {
    const home = evaluate(lead({ title: "PHP developer", header: "Dhaka, Bangladesh | Onsite", applyUrl: "https://a", emails: ["hr@a.com"] }), config, now);
    const visa = evaluate(lead({ title: "PHP developer", header: "Berlin | Onsite", body: "We offer visa sponsorship and relocation support.", emails: ["hr@a.com"] }), config, now);
    const plain = evaluate(lead({ title: "PHP developer", header: "Berlin | Onsite", emails: ["hr@a.com"] }), config, now);
    expect(home).toMatchObject({ keep: true, workMode: "ONSITE", country: "Bangladesh" });
    expect(visa).toMatchObject({ keep: true, country: "Germany", visa: true });
    if (home.keep && visa.keep && plain.keep) {
      expect(home.score).toBeGreaterThan(plain.score);
      expect(visa.score).toBeGreaterThan(plain.score);
    }
    expect(evaluate(lead({ title: "PHP developer", header: "Paris | Onsite", body: "We cannot sponsor visas." }), config, now)).toMatchObject({ keep: false });
  });

  it("ranks portfolio skills above checkbox-only skills", () => {
    const withPortfolio = { ...config, portfolio: [{ name: "WooCommerce", re: /woocommerce/gi }] };
    const woo = evaluate(lead({ title: "WooCommerce developer", body: "remote", emails: ["a@b.co"] }), withPortfolio, now);
    expect(woo).toMatchObject({ keep: true });
    if (woo.keep) expect(woo.reasons.join(" ")).toContain("Matches your portfolio: WooCommerce");
  });

  it("drops jobs outside the stack and non-engineering titles", () => {
    expect(evaluate(lead({ title: "Rust engineer", body: "remote. Rust only", emails: ["a@b.co"] }), config, now)).toMatchObject({ reason: "Outside your stack" });
    expect(evaluate(lead({ title: "Director of Marketing", body: "remote. php react" }), config, now)).toMatchObject({ reason: "Not a hands-on dev role" });
  });

  it("drops non-dev gigs but keeps website fixes", () => {
    expect(evaluate(lead({ gigByDefault: true, title: "Video editor for YouTube", body: "paid $20" }), config, now)).toMatchObject({ keep: false });
    const fix = evaluate(lead({ gigByDefault: true, title: "Need someone to fix my WordPress site", body: "checkout is broken. $300", redditUser: "bob" }), config, now);
    expect(fix).toMatchObject({ keep: true, pay: "$300", employment: "FREELANCE" });
  });

  it("drops posts older than 60 days", () => {
    expect(evaluate(lead({ body: "remote php", postedAt: new Date("2026-08-01") }), config, now)).toMatchObject({ reason: "Too old" });
  });
});
