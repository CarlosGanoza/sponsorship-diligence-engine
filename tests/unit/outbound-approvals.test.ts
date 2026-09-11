import { OutboundApprovalStatus, OutboundApprovalType, SponsorActivityType, SponsorPipelineStage } from "@prisma/client";

import {
  buildOutboundReleaseAssessment,
  requiresOutboundApprovalForActivity,
  requiresOutboundApprovalForStage,
  summarizeOutboundApprovalState,
} from "@/lib/outreach/approvals";

describe("outbound approval guardrails", () => {
  const safetySettings = {
    blindReviewMode: false,
    strictEvidenceMode: true,
    requireOutboundApproval: true,
    blockSponsorFacingPii: true,
  };

  const baseSafetyReport = {
    decision: "advance" as const,
    unsupportedStatements: [],
    potentialContradictions: [],
    missingProof: [],
  };

  it("blocks release when approval is missing", () => {
    const assessment = buildOutboundReleaseAssessment({
      safetySettings,
      safetyReport: baseSafetyReport,
      openProofRequestCount: 0,
      approvals: [],
    });

    expect(assessment.blocked).toBe(true);
    expect(assessment.blockers[0]).toContain("has not been requested");
  });

  it("allows release when evidence is clean and approvals are approved", () => {
    const assessment = buildOutboundReleaseAssessment({
      safetySettings,
      safetyReport: baseSafetyReport,
      openProofRequestCount: 0,
      approvals: [
        {
          id: "approval_1",
          approvalType: OutboundApprovalType.OUTREACH_RELEASE,
          status: OutboundApprovalStatus.APPROVED,
          title: "Sponsor-facing outreach release",
          rationale: "Ready for sponsor-facing movement.",
          decisionNote: "Approved.",
          reviewedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: "approval_2",
          approvalType: OutboundApprovalType.CRM_HANDOFF,
          status: OutboundApprovalStatus.APPROVED,
          title: "CRM handoff release",
          rationale: "Ready for handoff.",
          decisionNote: "Approved.",
          reviewedAt: new Date(),
          createdAt: new Date(),
        },
      ],
      forCrmHandoff: true,
    });

    expect(assessment.blocked).toBe(false);
    expect(assessment.requiredTypes).toHaveLength(2);
  });

  it("requires approval only for external sponsor-path activity types", () => {
    expect(requiresOutboundApprovalForActivity(SponsorActivityType.INTRO_REQUESTED)).toBe(true);
    expect(requiresOutboundApprovalForActivity(SponsorActivityType.OUTCOME_RECORDED)).toBe(false);
    expect(requiresOutboundApprovalForActivity(SponsorActivityType.CRM_SYNCED)).toBe(false);
  });

  it("requires approval only when pipeline movement becomes sponsor-facing", () => {
    expect(requiresOutboundApprovalForStage(SponsorPipelineStage.BRIEF_READY)).toBe(false);
    expect(requiresOutboundApprovalForStage(SponsorPipelineStage.OUTREACH_DRAFTED)).toBe(false);
    expect(requiresOutboundApprovalForStage(SponsorPipelineStage.CONTACTED)).toBe(true);
    expect(requiresOutboundApprovalForStage(SponsorPipelineStage.ADVOCATING)).toBe(true);
  });

  it("blocks sponsor-facing release when recommendations are stale", () => {
    const assessment = buildOutboundReleaseAssessment({
      safetySettings,
      safetyReport: baseSafetyReport,
      openProofRequestCount: 0,
      staleRecommendationCount: 2,
      approvals: [
        {
          id: "approval_1",
          approvalType: OutboundApprovalType.OUTREACH_RELEASE,
          status: OutboundApprovalStatus.APPROVED,
          title: "Sponsor-facing outreach release",
          rationale: "Ready for sponsor-facing movement.",
          decisionNote: "Approved.",
          reviewedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    });

    expect(assessment.blocked).toBe(true);
    expect(assessment.blockers.some((blocker) => blocker.includes("stale"))).toBe(true);
  });

  it("blocks sponsor-facing release during a sponsor timing blackout", () => {
    const assessment = buildOutboundReleaseAssessment({
      safetySettings,
      safetyReport: baseSafetyReport,
      openProofRequestCount: 0,
      approvals: [
        {
          id: "approval_1",
          approvalType: OutboundApprovalType.OUTREACH_RELEASE,
          status: OutboundApprovalStatus.APPROVED,
          title: "Sponsor-facing outreach release",
          rationale: "Ready for sponsor-facing movement.",
          decisionNote: "Approved.",
          reviewedAt: new Date(),
          createdAt: new Date(),
        },
      ],
      sponsorPathHistory: {
        duplicateAskRisk: false,
        duplicateAskReason: null,
        negativeMemory: [],
        blackoutActive: true,
        blackoutReason: "Avoid new outreach until the next board cycle opens.",
        blackoutUntilLabel: "Apr 2, 2026",
      },
    });

    expect(assessment.blocked).toBe(true);
    expect(assessment.blockers.some((blocker) => blocker.includes("timing blackout"))).toBe(true);
  });

  it("blocks sponsor-facing release when contact details are still exposed", () => {
    const assessment = buildOutboundReleaseAssessment({
      safetySettings,
      safetyReport: {
        ...baseSafetyReport,
        sponsorFacingContactDetailCount: 1,
        sponsorFacingContactDetails: ["Executive summary · email · m***@example.com"],
      },
      openProofRequestCount: 0,
      approvals: [
        {
          id: "approval_1",
          approvalType: OutboundApprovalType.OUTREACH_RELEASE,
          status: OutboundApprovalStatus.APPROVED,
          title: "Sponsor-facing outreach release",
          rationale: "Ready for sponsor-facing movement.",
          decisionNote: "Approved.",
          reviewedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    });

    expect(assessment.blocked).toBe(true);
    expect(assessment.blockers.some((blocker) => blocker.includes("contact details"))).toBe(true);
  });

  it("summarizes approval state when the request is approved but the path is still blocked", () => {
    const summary = summarizeOutboundApprovalState({
      approvalType: OutboundApprovalType.OUTREACH_RELEASE,
      approval: {
        id: "approval_1",
        approvalType: OutboundApprovalType.OUTREACH_RELEASE,
        status: OutboundApprovalStatus.APPROVED,
        title: "Sponsor-facing outreach release",
        rationale: "Ready for sponsor-facing movement.",
        decisionNote: "Approved if there is no overlapping motion.",
        reviewedAt: new Date(),
        createdAt: new Date(),
      },
      blocked: true,
      blockers: ["Overlapping sponsor motion is already recorded."],
    });

    expect(summary.label).toBe("Approved, blocked");
    expect(summary.variant).toBe("danger");
    expect(summary.detail).toContain("Overlapping sponsor motion");
  });
});
