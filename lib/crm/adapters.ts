import { CrmSyncMode } from "@prisma/client";

import { remapCrmFields } from "@/lib/crm/mappings";
import type { CrmHandoffRecord } from "@/lib/outreach/handoff";

export function buildCrmProviderPayload(
  mode: CrmSyncMode,
  record: CrmHandoffRecord,
  options?: {
    fieldMappings?: Array<{
      sourceField: string;
      destinationField: string;
    }>;
  },
) {
  const base = {
    contractVersion: "v1",
    providerMode: mode,
    handoff: record,
  };

  if (mode === CrmSyncMode.HUBSPOT) {
    const properties = remapCrmFields(
      "hubspot",
      {
        body: [
          `Candidate: ${record.candidateName}`,
          `Sponsor: ${record.sponsorName}`,
          `Opportunity: ${record.opportunityType}`,
          `Why now: ${record.whyNow}`,
          `Next step: ${record.nextStep}`,
        ].join("\n"),
      },
      options?.fieldMappings,
    );

    return {
      ...base,
      hubspotObject: {
        objectType: "notes",
        properties,
      },
    };
  }

  if (mode === CrmSyncMode.SALESFORCE) {
    const fields = remapCrmFields(
      "salesforce",
      {
        subject: record.subjectLine,
        description: `${record.whyNow}\n\nWarm path: ${record.warmPath}\n\nNext step: ${record.nextStep}`,
        status: "Not Started",
        priority: "Normal",
      },
      options?.fieldMappings,
    );

    return {
      ...base,
      salesforceRecord: {
        object: "Task",
        fields,
      },
    };
  }

  if (mode === CrmSyncMode.AIRTABLE) {
    const fields = remapCrmFields(
      "airtable",
      {
        candidate: record.candidateName,
        sponsor: record.sponsorName,
        opportunity: record.opportunityType,
        matchScore: record.sponsorMatchScore,
        readinessScore: record.sponsorReadinessScore,
        nextStep: record.nextStep,
      },
      options?.fieldMappings,
    );

    return {
      ...base,
      airtableRecord: {
        table: "Sponsor Handoffs",
        fields,
      },
    };
  }

  return base;
}
