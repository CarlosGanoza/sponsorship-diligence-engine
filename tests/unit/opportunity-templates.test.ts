import {
  OpportunityType,
  SeniorityLevel,
  SponsorAvailabilityStatus,
  SponsorStyle,
  type Sponsor,
} from "@prisma/client";

import { getOpportunityTemplate, selectOpportunityType } from "@/lib/opportunities/templates";

function createSponsor(style: SponsorStyle): Sponsor {
  return {
    id: `sponsor-${style}`,
    organizationId: "org-1",
    fullName: "Dorian Hale",
    title: "Managing Partner",
    organization: "Northline Civic Fund",
    domainExpertise: "civic|policy|education",
    seniorityLevel: SeniorityLevel.PARTNER,
    sponsorStyle: style,
    interestTags: "leadership|systems",
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

describe("opportunity templates", () => {
  it("maps sponsor archetypes to the expected opportunity type", () => {
    expect(
      selectOpportunityType({
        sponsor: createSponsor(SponsorStyle.PUBLIC_ADVOCATE),
        candidateKeywords: ["education"],
        hasLeadershipSignal: true,
      }),
    ).toBe(OpportunityType.PUBLIC_ADVOCACY);

    expect(
      selectOpportunityType({
        sponsor: createSponsor(SponsorStyle.SYSTEMS_BUILDER),
        candidateKeywords: ["operations"],
        hasLeadershipSignal: false,
      }),
    ).toBe(OpportunityType.SYSTEMS_RESIDENCY);

    expect(
      selectOpportunityType({
        sponsor: createSponsor(SponsorStyle.SELECTIVE_DOOR_OPENER),
        candidateKeywords: ["community"],
        hasLeadershipSignal: false,
      }),
    ).toBe(OpportunityType.BOARD_OBSERVER);

    expect(
      selectOpportunityType({
        sponsor: createSponsor(SponsorStyle.SELECTIVE_DOOR_OPENER),
        candidateKeywords: ["community"],
        hasLeadershipSignal: true,
      }),
    ).toBe(OpportunityType.REGIONAL_SCALE_INTRO);
  });

  it("falls back to keyword-driven and default templates when sponsor style is not decisive", () => {
    expect(
      selectOpportunityType({
        sponsor: createSponsor(SponsorStyle.HANDS_ON),
        candidateKeywords: ["climate", "delivery"],
        hasLeadershipSignal: false,
      }),
    ).toBe(OpportunityType.PILOT_PARTNERSHIP);

    expect(
      selectOpportunityType({
        sponsor: createSponsor(SponsorStyle.HANDS_ON),
        candidateKeywords: ["community", "delivery"],
        hasLeadershipSignal: false,
      }),
    ).toBe(OpportunityType.STRETCH_ROLE);
  });

  it("exposes stable copy for downstream brief generation", () => {
    const template = getOpportunityTemplate(OpportunityType.TRUSTED_INTRO);

    expect(template.label).toContain("Trusted intro");
    expect(template.askStyle.toLowerCase()).toContain("introduction");
    expect(template.successFrame.toLowerCase()).toContain("second conversation");
  });
});
