import { describe, expect, it } from "vitest";
import { parseHiringHeader } from "./sources/hn";
import { extractApplyEmails, extractEmails, htmlToText } from "./text";

describe("extractEmails", () => {
  it("finds plain and obfuscated addresses", () => {
    expect(extractEmails("mail jobs@acme.io or hiring [at] beta [dot] dev or founders at gamma dot com")).toEqual([
      "jobs@acme.io", "hiring@beta.dev", "founders@gamma.com",
    ]);
  });

  it("ignores ordinary uses of 'at' and boilerplate mailboxes", () => {
    expect(extractEmails("We're at acme.com. Questions: privacy@acme.com, accommodations@acme.com")).toEqual([]);
  });

  it("keeps only emails offered as a way to apply", () => {
    const body = "Send your CV to dana@acme.io. ... lots of text ... ".padEnd(400, ".") + " Our office: office@acme.io";
    expect(extractApplyEmails(body)).toEqual(["dana@acme.io"]);
  });
});

describe("htmlToText", () => {
  it("keeps mailto targets and paragraph breaks", () => {
    expect(htmlToText('Acme | Dev<p>Email <a href="mailto:a@b.co">me</a>')).toBe("Acme | Dev\nEmail a@b.co");
  });
});

describe("parseHiringHeader", () => {
  it("reads the pipe convention", () => {
    expect(parseHiringHeader("Acme | Full-stack Engineer | REMOTE | $120k\nbody")).toMatchObject({ company: "Acme", role: "Full-stack Engineer" });
  });
  it("doesn't mistake a company name containing 'cto' for a role", () => {
    expect(parseHiringHeader("CVector | Software Engineers | New York City | ONSITE")).toMatchObject({ company: "CVector", role: "Software Engineers" });
  });
  it("reads labelled lines", () => {
    expect(parseHiringHeader("Location: Dubrovnik\nCompany: Beta Labs\nRole: Backend developer")).toMatchObject({ company: "Beta Labs", role: "Backend developer" });
  });
});
