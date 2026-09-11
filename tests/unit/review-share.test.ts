import { ReviewStatus } from "@prisma/client";

import {
  buildMemoReviewSharePayload,
  buildPacketReviewSharePayload,
  parseReviewSharePayload,
  serializeReviewSharePayload,
} from "@/lib/review/share";

describe("review share payloads", () => {
  it("serializes and parses memo share snapshots", () => {
    const payload = buildMemoReviewSharePayload({
      kind: "memo",
      candidateName: "Maya Rios",
      summary: "Evidence-backed summary.",
      rationale: "Grounded rationale.",
      strengths: ["Strong follow-through."],
      risks: ["Needs more quantified scale proof."],
      recommendedAction: "Request a sponsor-backed pilot intro.",
      status: "READY",
      sponsorLabel: "Elena Hart",
      sponsorMeta: "Partner · Northstone Foundation",
    });

    expect(parseReviewSharePayload(serializeReviewSharePayload(payload))).toEqual(payload);
  });

  it("serializes and parses packet share snapshots", () => {
    const payload = buildPacketReviewSharePayload({
      kind: "packet",
      candidateName: "Jonah Park",
      candidateHeadline: "Community systems operator",
      candidateRegion: "Chicago, IL",
      sponsorName: "Amira Sloan",
      sponsorTitle: "Director",
      sponsorOrganization: "Civic Spring",
      readinessScore: 76,
      matchScore: 82,
      fitBreakdown: {
        domainFit: 18,
        sponsorStyleFit: 14,
      },
      memoSummary: "Packet summary.",
      sponsorAngle: "Why this sponsor now.",
      recommendedAsk: "Make the intro.",
      recommendedAction: "Open the first diligence conversation.",
      warmPath: ["Operator knows sponsor"],
      warmPathNote: "Warm path available through current operator.",
      strengths: ["Strong operating ownership."],
      risks: ["Still needs more board-level proof."],
      evidence: [
        {
          id: "claim-1",
          category: "LEADERSHIP",
          claim: "Led the pilot rollout.",
          supportingExcerpt: "She led the rollout across three sites.",
          artifactTitle: "Mentor note",
          confidence: 0.82,
          reviewStatus: ReviewStatus.APPROVED,
          reviewNote: "Confirmed by operator review.",
        },
      ],
      flaggedItems: [
        {
          id: "flag-1",
          kind: "risk",
          label: "Needs stronger quantified scale proof.",
          note: "Requested a follow-up artifact.",
        },
      ],
    });

    expect(parseReviewSharePayload(serializeReviewSharePayload(payload))).toEqual(payload);
  });
});
