import { CrmSyncMode } from "@prisma/client";

import { buildCrmProviderPayload } from "@/lib/crm/adapters";

const record = {
  candidateId: "candidate-1",
  candidateName: "Maya Rios",
  candidateHeadline: "Climate resilience operator",
  candidateRegion: "Oakland, CA",
  sponsorId: "sponsor-1",
  sponsorName: "Amina Brooks",
  sponsorTitle: "Partner",
  sponsorOrganization: "Northline Foundation",
  sponsorStyle: "PUBLIC_ADVOCATE",
  opportunityType: "PILOT_PARTNERSHIP",
  briefTitle: "Pilot partnership ask",
  briefStatus: "READY",
  outreachMode: "WARM_INTRO" as const,
  sponsorMatchScore: 82,
  sponsorReadinessScore: 78,
  subjectLine: "Targeted pilot path for Maya Rios",
  sponsorAsk: "Warm pilot conversation",
  whyNow: "The candidate now has quantified delivery proof.",
  warmPath: "Operator -> Mentor -> Sponsor",
  proofToBring: "Outcome note|mentor corroboration",
  risks: "Still needs board-facing example",
  nextStep: "Set a 20 minute meeting",
};

describe("crm provider payload adapters", () => {
  it("builds a versioned HubSpot payload", () => {
    const payload = buildCrmProviderPayload(CrmSyncMode.HUBSPOT, record);
    expect(payload.contractVersion).toBe("v1");
    expect(payload.providerMode).toBe(CrmSyncMode.HUBSPOT);
    expect("hubspotObject" in payload).toBe(true);
  });

  it("builds a versioned Salesforce payload", () => {
    const payload = buildCrmProviderPayload(CrmSyncMode.SALESFORCE, record);
    expect(payload.contractVersion).toBe("v1");
    expect(payload.providerMode).toBe(CrmSyncMode.SALESFORCE);
    expect("salesforceRecord" in payload).toBe(true);
  });

  it("builds a versioned Airtable payload", () => {
    const payload = buildCrmProviderPayload(CrmSyncMode.AIRTABLE, record);
    expect(payload.contractVersion).toBe("v1");
    expect(payload.providerMode).toBe(CrmSyncMode.AIRTABLE);
    expect("airtableRecord" in payload).toBe(true);
  });
});
