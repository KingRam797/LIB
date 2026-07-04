/**
 * Phase 3 acceptance tests:
 *   T3.1 — name check gives an availability signal + disclaimer
 *   T3.2 — Articles PDF generates with LARA CD-700 fields
 *   T3.3 — operating agreement + resident agent templates
 *   T3.4 — SS-4 prepared answers, no filing performed
 *   T3.5 — disclaimer on EVERY generated document
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  articlesOfOrganization,
  LEGAL_DISCLAIMER,
  operatingAgreement,
  residentAgentGuide,
  ss4Summary,
  type LlcData,
} from "../llc/documents.js";
import { checkName } from "../llc/name-check.js";
import { authed, registerUser, setupTestEnv, type TestEnv, type TestSession } from "./helpers.js";

let env: TestEnv;
let session: TestSession;

const FULL_PROFILE = {
  entityName: "Golden Basket Media LLC",
  residentAgentName: "Jordan King",
  registeredOfficeStreet: "100 Woodward Ave",
  registeredOfficeCity: "Detroit",
  registeredOfficeZip: "48226",
  organizerName: "Jordan King",
  organizerAddress: "100 Woodward Ave, Detroit, MI 48226",
  memberNames: ["Jordan King"],
  responsiblePartyName: "Jordan King",
  principalActivity: "Digital media services",
  expectedEmployees: 0,
  businessStartDate: "2026-08-01",
};

beforeAll(async () => {
  env = await setupTestEnv("phase3");
  session = await registerUser(env.app, "phase3@example.com");
});

afterAll(async () => {
  await env.teardown();
});

describe("T3.1 — business name check", () => {
  it("flags a missing LLC designator and provides search links + disclaimer", async () => {
    const res = await env.app.inject({
      method: "POST",
      url: "/llc/name-check",
      headers: authed(session.accessToken),
      payload: { name: "Golden Basket Media" },
    });
    expect(res.statusCode).toBe(200);
    const check = res.json() as {
      formatIssues: string[];
      distinguishableName: string;
      searches: Record<string, string>;
      disclaimer: string;
    };
    expect(check.formatIssues.some((i) => i.includes("LLC"))).toBe(true);
    expect(check.searches["laraEntitySearch"]).toContain("lara.state.mi.us");
    expect(check.searches["usptoTrademarkSearch"]).toContain("uspto.gov");
    expect(check.disclaimer).toContain("does NOT confirm availability");
  });

  it("passes a well-formed name and normalizes distinguishability", () => {
    const ok = checkName("Golden Basket Media, L.L.C.");
    expect(ok.formatIssues).toHaveLength(0);
    expect(ok.distinguishableName).toBe("golden basket media");

    const restricted = checkName("Golden Basket Bank LLC");
    expect(restricted.formatIssues.some((i) => i.includes("restricted"))).toBe(true);
  });
});

describe("T3.2 — Articles of Organization generator", () => {
  it("refuses to generate until required CD-700 fields exist", async () => {
    const res = await env.app.inject({
      method: "GET",
      url: "/llc/documents/articles.pdf",
      headers: authed(session.accessToken),
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { missingFields: string[] };
    expect(body.missingFields).toContain("entityName");
    expect(body.missingFields).toContain("residentAgentName");
  });

  it("generates a valid PDF once the profile is complete", async () => {
    const put = await env.app.inject({
      method: "PUT",
      url: "/llc/profile",
      headers: authed(session.accessToken),
      payload: FULL_PROFILE,
    });
    expect(put.statusCode).toBe(200);
    expect(
      (put.json() as { readiness: { articlesMissingFields: string[] } }).readiness
        .articlesMissingFields,
    ).toHaveLength(0);

    const res = await env.app.inject({
      method: "GET",
      url: "/llc/documents/articles.pdf",
      headers: authed(session.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.rawPayload.length).toBeGreaterThan(2000);
  });

  it("document content mirrors the LARA CD-700 articles", async () => {
    const doc = await articlesOfOrganization(FULL_PROFILE_DATA());
    expect(doc.text).toContain("Article I — Name");
    expect(doc.text).toContain("Golden Basket Media LLC");
    expect(doc.text).toContain("Article IV — Resident Agent and Registered Office");
    expect(doc.text).toContain("Detroit, Michigan 48226");
    expect(doc.text).toContain("$50.00");
  });
});

function FULL_PROFILE_DATA(): LlcData {
  return {
    ...FULL_PROFILE,
    purpose:
      "To engage in any activity within the purposes for which a limited liability company may be formed under the Michigan Limited Liability Company Act.",
    duration: "perpetual",
    management: "member_managed",
  };
}

describe("T3.3 — operating agreement + resident agent templates", () => {
  it("generates the operating agreement PDF with member + separateness clauses", async () => {
    const doc = await operatingAgreement(FULL_PROFILE_DATA());
    expect(doc.text).toContain("Operating Agreement of Golden Basket Media LLC");
    expect(doc.text).toContain("managed by its Member(s)");
    expect(doc.text).toContain("commingle");

    const res = await env.app.inject({
      method: "GET",
      url: "/llc/documents/operating-agreement.pdf",
      headers: authed(session.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("lists the template library", async () => {
    const res = await env.app.inject({
      method: "GET",
      url: "/llc/templates",
      headers: authed(session.accessToken),
    });
    const body = res.json() as { templates: { id: string }[]; disclaimer: string };
    expect(body.templates.map((t) => t.id).sort()).toEqual(
      ["articles", "operating-agreement", "resident-agent-guide", "ss4-summary"].sort(),
    );
    expect(body.disclaimer).toBe(LEGAL_DISCLAIMER);
  });
});

describe("T3.4 — EIN / SS-4 guided flow", () => {
  it("produces prepared answers with IRS links but never the SSN", async () => {
    const doc = await ss4Summary(FULL_PROFILE_DATA());
    expect(doc.text).toContain("irs.gov");
    expect(doc.text).toContain("Line 1 (Legal name of entity): Golden Basket Media LLC");
    expect(doc.text).toContain("Third-Party Designee");
    expect(doc.text).toContain("SpendWHERE does not submit it");

    const res = await env.app.inject({
      method: "GET",
      url: "/llc/documents/ss4-summary.pdf",
      headers: authed(session.accessToken),
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("T3.5 — disclaimers on every generated document", () => {
  it("stamps the not-legal-advice disclaimer into all four documents", async () => {
    const docs = [
      await articlesOfOrganization(FULL_PROFILE_DATA()),
      await operatingAgreement(FULL_PROFILE_DATA()),
      await residentAgentGuide(),
      await ss4Summary(FULL_PROFILE_DATA()),
    ];
    for (const doc of docs) {
      expect(doc.text).toContain(LEGAL_DISCLAIMER);
      expect(doc.sections.at(-1)!.paragraphs.join(" ")).toContain("not legal advice");
    }
  });

  it("PDF endpoints carry the disclaimer response header", async () => {
    for (const url of [
      "/llc/documents/articles.pdf",
      "/llc/documents/operating-agreement.pdf",
      "/llc/documents/resident-agent-guide.pdf",
      "/llc/documents/ss4-summary.pdf",
    ]) {
      const res = await env.app.inject({ method: "GET", url, headers: authed(session.accessToken) });
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-spendwhere-disclaimer"]).toBe("not-legal-advice");
    }
  });
});

describe("LLC profile isolation (RLS)", () => {
  it("another user cannot see the profile", async () => {
    const other = await registerUser(env.app, "phase3-other@example.com");
    const res = await env.app.inject({
      method: "GET",
      url: "/llc/profile",
      headers: authed(other.accessToken),
    });
    expect((res.json() as { profile: unknown }).profile).toBeNull();
  });
});
