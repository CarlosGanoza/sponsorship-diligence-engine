import { type Candidate, type OpportunityBrief, type Sponsor } from "@prisma/client";

import type { OutreachMode } from "@/lib/outreach/plan";
import { serializeDelimitedList } from "@/lib/utils/strings";

export type CrmHandoffRecord = {
  candidateId: string;
  candidateName: string;
  candidateHeadline: string;
  candidateRegion: string;
  sponsorId: string;
  sponsorName: string;
  sponsorTitle: string;
  sponsorOrganization: string;
  sponsorStyle: string;
  opportunityType: string;
  briefTitle: string;
  briefStatus: string;
  outreachMode: OutreachMode;
  sponsorMatchScore: number;
  sponsorReadinessScore: number;
  subjectLine: string;
  sponsorAsk: string;
  whyNow: string;
  warmPath: string;
  proofToBring: string;
  risks: string;
  nextStep: string;
};

export function buildCrmHandoffRecord({
  candidate,
  sponsor,
  brief,
  outreachMode,
  sponsorMatchScore,
  sponsorReadinessScore,
  subjectLine,
  connectionPath,
  risks,
  nextStep,
}: {
  candidate: Pick<Candidate, "id" | "fullName" | "headline" | "region">;
  sponsor: Pick<Sponsor, "id" | "fullName" | "title" | "organization" | "sponsorStyle">;
  brief: Pick<OpportunityBrief, "title" | "status" | "opportunityType" | "sponsorAsk" | "whyNow"> & {
    proofToBringList: string[];
  };
  outreachMode: OutreachMode;
  sponsorMatchScore: number;
  sponsorReadinessScore: number;
  subjectLine: string;
  connectionPath: string[];
  risks: string[];
  nextStep: string;
}) {
  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    candidateHeadline: candidate.headline,
    candidateRegion: candidate.region,
    sponsorId: sponsor.id,
    sponsorName: sponsor.fullName,
    sponsorTitle: sponsor.title,
    sponsorOrganization: sponsor.organization,
    sponsorStyle: sponsor.sponsorStyle,
    opportunityType: brief.opportunityType,
    briefTitle: brief.title,
    briefStatus: brief.status,
    outreachMode,
    sponsorMatchScore,
    sponsorReadinessScore,
    subjectLine,
    sponsorAsk: brief.sponsorAsk,
    whyNow: brief.whyNow,
    warmPath: connectionPath.join(" -> "),
    proofToBring: serializeDelimitedList(brief.proofToBringList),
    risks: serializeDelimitedList(risks),
    nextStep,
  };
}

export function serializeCrmHandoffCsv(record: CrmHandoffRecord) {
  const headers = Object.keys(record);
  const values = Object.values(record).map((value) => {
    const normalized = String(value ?? "");
    return `"${normalized.replaceAll('"', '""')}"`;
  });

  return `${headers.join(",")}\n${values.join(",")}\n`;
}
