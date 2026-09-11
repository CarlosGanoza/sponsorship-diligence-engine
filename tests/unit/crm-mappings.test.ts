import { CrmSyncMode } from "@prisma/client";

import { buildCrmProviderPayload } from "@/lib/crm/adapters";
import { normalizeCrmFieldMappingInput, remapCrmFields } from "@/lib/crm/mappings";

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

describe("crm field mappings", () => {
  it("falls back to default mappings when the editor value is empty", () => {
    const normalized = normalizeCrmFieldMappingInput("", "hubspot");

    expect(normalized.success).toBe(true);
    if (normalized.success) {
      expect(normalized.entries).toEqual([{ sourceField: "body", destinationField: "hs_note_body" }]);
    }
  });

  it("rejects unsupported source fields for a provider", () => {
    const normalized = normalizeCrmFieldMappingInput(
      JSON.stringify([{ sourceField: "matchScore", destinationField: "Score__c" }]),
      "salesforce",
    );

    expect(normalized.success).toBe(false);
    if (!normalized.success) {
      expect(normalized.error).toMatch(/unsupported source field/i);
    }
  });

  it("remaps provider fields using the configured mapping set", () => {
    expect(
      remapCrmFields("airtable", {
        candidate: "Maya Rios",
        sponsor: "Amina Brooks",
        opportunity: "Pilot partnership",
        matchScore: 82,
        readinessScore: 78,
        nextStep: "Schedule intro",
      }, [
        { sourceField: "candidate", destinationField: "Candidate Name" },
        { sourceField: "nextStep", destinationField: "Next Ask" },
      ]),
    ).toEqual({
      "Candidate Name": "Maya Rios",
      "Next Ask": "Schedule intro",
    });
  });

  it("builds CRM payloads with custom destination field names", () => {
    const payload = buildCrmProviderPayload(CrmSyncMode.SALESFORCE, record, {
      fieldMappings: [
        { sourceField: "subject", destinationField: "Custom_Subject__c" },
        { sourceField: "description", destinationField: "Custom_Description__c" },
      ],
    }) as {
      salesforceRecord: {
        fields: Record<string, string>;
      };
    };

    expect(payload.salesforceRecord.fields.Custom_Subject__c).toBe(record.subjectLine);
    expect(payload.salesforceRecord.fields.Custom_Description__c).toContain(record.whyNow);
  });
});
