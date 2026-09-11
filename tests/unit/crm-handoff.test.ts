import { BriefStatus, OpportunityType, SeniorityLevel, SponsorAvailabilityStatus, SponsorStyle, type Sponsor } from "@prisma/client";

import { buildCrmHandoffRecord, serializeCrmHandoffCsv } from "@/lib/outreach/handoff";

function createSponsor(): Sponsor {
  return {
    id: "sponsor-1",
    organizationId: "org-1",
    fullName: "Nadia Voss",
    title: "Executive Director",
    organization: "Bridgepoint Network",
    domainExpertise: "education|workforce",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: SponsorStyle.SELECTIVE_DOOR_OPENER,
    interestTags: "leadership|talent",
    geography: "United States",
    warmIntroAvailable: true,
    availabilityStatus: SponsorAvailabilityStatus.OPEN,
    maxConcurrentPaths: 4,
    availabilityNote: null,
    blackoutUntil: null,
    blackoutReason: null,
    bio: "Sponsor bio",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("crm handoff export", () => {
  it("builds a structured handoff record", () => {
    const record = buildCrmHandoffRecord({
      brief: {
        title: "Regional scale introduction · Maya Rios × Nadia Voss",
        status: BriefStatus.READY,
        opportunityType: OpportunityType.REGIONAL_SCALE_INTRO,
        sponsorAsk: "Ask for one strategic regional introduction.",
        whyNow: "The candidate has local proof and is ready for larger scope.",
        proofToBringList: ["Resume: Led a 12-site program.", "Mentor note: Trusted by city partners."],
      },
      candidate: {
        id: "candidate-1",
        fullName: "Maya Rios",
        headline: "Regional workforce operator",
        region: "Phoenix, AZ",
      },
      sponsor: createSponsor(),
      connectionPath: ["Candidate -> operator -> sponsor"],
      nextStep: "Secure a second diligence meeting.",
      outreachMode: "WARM_INTRO",
      risks: ["Cross-region operating proof is still emerging."],
      sponsorMatchScore: 84,
      sponsorReadinessScore: 78,
      subjectLine: "Maya Rios · Regional Scale Intro via Bridgepoint Network",
    });

    expect(record.candidateName).toBe("Maya Rios");
    expect(record.warmPath).toContain("operator");
    expect(record.proofToBring).toContain("Resume");
    expect(record.outreachMode).toBe("WARM_INTRO");
  });

  it("serializes the handoff record as csv", () => {
    const csv = serializeCrmHandoffCsv({
      candidateId: "candidate-1",
      candidateName: "Maya Rios",
      candidateHeadline: "Regional workforce operator",
      candidateRegion: "Phoenix, AZ",
      sponsorId: "sponsor-1",
      sponsorName: "Nadia Voss",
      sponsorTitle: "Executive Director",
      sponsorOrganization: "Bridgepoint Network",
      sponsorStyle: "SELECTIVE_DOOR_OPENER",
      opportunityType: "REGIONAL_SCALE_INTRO",
      briefTitle: "Regional scale introduction · Maya Rios × Nadia Voss",
      briefStatus: "READY",
      outreachMode: "WARM_INTRO",
      sponsorMatchScore: 84,
      sponsorReadinessScore: 78,
      subjectLine: "Maya Rios · Regional Scale Intro via Bridgepoint Network",
      sponsorAsk: "Ask for one strategic regional introduction.",
      whyNow: "The candidate has local proof and is ready for larger scope.",
      warmPath: "Candidate -> operator -> sponsor",
      proofToBring: "Resume: Led a 12-site program.",
      risks: "Cross-region operating proof is still emerging.",
      nextStep: "Secure a second diligence meeting.",
    });

    expect(csv).toContain("candidateId");
    expect(csv).toContain("\"Maya Rios\"");
    expect(csv.split("\n")).toHaveLength(3);
  });
});
