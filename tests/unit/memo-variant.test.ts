import {
  ReviewStatus,
  SeniorityLevel,
  SignalCategory,
  SponsorAvailabilityStatus,
  SponsorStyle,
  type Sponsor,
} from "@prisma/client";

import { buildSponsorMemoVariant } from "@/lib/memo/variant";

const baseMemo = {
  summary: "Base summary.",
  rationale: "Base rationale.",
  strengthsList: ["Base strength."],
  risksList: ["Base risk."],
  recommendedAction: "Base action.",
};

const claims = [
  {
    id: "claim-1",
    category: SignalCategory.FOLLOW_THROUGH,
    claim: "Demonstrates follow-through by delivering multi-quarter work.",
    confidence: 0.89,
    supportingExcerpt: "Delivered work across two quarters",
    artifactTitle: "Resume",
    reviewStatus: ReviewStatus.APPROVED,
    reviewNote: null,
  },
  {
    id: "claim-2",
    category: SignalCategory.COLLABORATION,
    claim: "Demonstrates collaborative execution with cross-functional teams.",
    confidence: 0.84,
    supportingExcerpt: "Coordinated staff and partners",
    artifactTitle: "Mentor Note",
    reviewStatus: ReviewStatus.APPROVED,
    reviewNote: null,
  },
  {
    id: "claim-3",
    category: SignalCategory.MISSION_ALIGNMENT,
    claim: "Suggests mission alignment in public-interest education work.",
    confidence: 0.82,
    supportingExcerpt: "Focused on public-interest education access",
    artifactTitle: "Reflection",
    reviewStatus: ReviewStatus.PENDING,
    reviewNote: null,
  },
  {
    id: "claim-4",
    category: SignalCategory.COMMUNICATION,
    claim: "Signals strong communication through external briefings.",
    confidence: 0.8,
    supportingExcerpt: "Presented external briefings",
    artifactTitle: "Recommendation",
    reviewStatus: ReviewStatus.PENDING,
    reviewNote: null,
  },
];

function createSponsor(style: SponsorStyle): Sponsor {
  return {
    id: `sponsor-${style}`,
    organizationId: "org-1",
    fullName: "Avery Stone",
    title: "Managing Director",
    organization: "North Harbor Network",
    domainExpertise: "education|community|public interest",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: style,
    interestTags: "youth|leadership",
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

describe("sponsor memo variants", () => {
  it("prioritizes sponsor-style-aligned signals in the variant strengths", () => {
    const handsOn = buildSponsorMemoVariant({
      candidate: {
        fullName: "Leila Mensah",
        headline: "Workforce operator",
        region: "Atlanta, GA",
        sponsorReadinessScore: 74,
      },
      sponsor: createSponsor(SponsorStyle.HANDS_ON),
      memo: baseMemo,
      claims,
      bestSponsorRecommendation: {
        explanation: "Fit explanation.",
        actionSuggestion: "Make a scoped introduction.",
      },
      warmPathRecommendation: {
        explanation: "Warm path through operator network.",
        actionSuggestion: "Route through the mentor first.",
      },
      nextActionRecommendation: {
        explanation: "Action explanation.",
        actionSuggestion: "Prepare the brief.",
      },
      matchScore: 82,
      matchBreakdown: {
        domainFit: 20,
        geographyFit: 6,
        interestOverlap: 10,
        sponsorStyleFit: 8,
        warmPathAvailability: 16,
        signalProfile: 12,
        actionRelevance: 10,
        sponsorCapacity: 7,
        sponsorResponsiveness: 7,
      },
      connectionPath: ["Candidate -> mentor -> sponsor"],
    });

    const publicAdvocate = buildSponsorMemoVariant({
      candidate: {
        fullName: "Leila Mensah",
        headline: "Workforce operator",
        region: "Atlanta, GA",
        sponsorReadinessScore: 74,
      },
      sponsor: createSponsor(SponsorStyle.PUBLIC_ADVOCATE),
      memo: baseMemo,
      claims,
      bestSponsorRecommendation: {
        explanation: "Fit explanation.",
        actionSuggestion: "Make a scoped introduction.",
      },
      warmPathRecommendation: {
        explanation: "Warm path through operator network.",
        actionSuggestion: "Route through the mentor first.",
      },
      nextActionRecommendation: {
        explanation: "Action explanation.",
        actionSuggestion: "Prepare the brief.",
      },
      matchScore: 82,
      matchBreakdown: {
        domainFit: 20,
        geographyFit: 6,
        interestOverlap: 10,
        sponsorStyleFit: 8,
        warmPathAvailability: 16,
        signalProfile: 12,
        actionRelevance: 10,
        sponsorCapacity: 7,
        sponsorResponsiveness: 7,
      },
      connectionPath: ["Candidate -> mentor -> sponsor"],
    });

    expect(handsOn.sponsorLabel).toContain("Hands-on");
    expect(handsOn.strengths[0]).toContain("follow-through");
    expect(publicAdvocate.sponsorLabel).toContain("Public-advocate");
    expect(publicAdvocate.summary).toContain("North Harbor Network");
    expect(publicAdvocate.rationale.toLowerCase()).toContain("stand up publicly");
  });
});
