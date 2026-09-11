import {
  ArtifactType,
  AutomationMode,
  CandidateStage,
  DecisionType,
  RecommendationType,
  ReviewStatus,
} from "@prisma/client";

import {
  buildDecisionAuditReport,
  createDecisionAuditRow,
  mapUnderwritingDecisionToDecisionType,
  toPrismaUnderwritingDecision,
} from "@/lib/audits/report";

describe("decision audits", () => {
  const baseCandidate = {
    organizationId: "org_1",
    fullName: "Maya Rios",
    headline: "Climate operator",
    bio: "Builds climate resilience programs.",
    region: "Oakland, CA",
    currentStage: CandidateStage.REVIEW,
    automationMode: AutomationMode.AUTOMATED,
    automationNote: null,
    automationUpdatedAt: null,
    sponsorReadinessScore: 52,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const artifacts = [
    {
      id: "artifact_1",
      candidateId: "candidate_1",
      storedFileId: null,
      supersedesArtifactId: null,
      artifactType: ArtifactType.RESUME,
      title: "Resume",
      rawText: "Led a neighborhood cooling pilot and coordinated city staff across three sites.",
      sourceLabel: "Upload",
      fileName: null,
      versionNumber: 1,
      isCurrentVersion: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const claims = [
    {
      id: "claim_1",
      candidateId: "candidate_1",
      artifactId: "artifact_1",
      category: "LEADERSHIP" as const,
      claim: "Provides evidence of leadership in leading a neighborhood cooling pilot.",
      confidence: 0.82,
      supportingExcerpt: "Led a neighborhood cooling pilot and coordinated city staff across three sites.",
      tags: "",
      reviewStatus: ReviewStatus.PENDING,
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const recommendations = [
    {
      id: "rec_1",
      candidateId: "candidate_1",
      sponsorId: null,
      recommendationType: RecommendationType.NEXT_ACTION,
      score: 52,
      explanation: "Proceed carefully.",
      actionSuggestion: "Advance now.",
      reviewStatus: ReviewStatus.PENDING,
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("flags when the logged human decision is more optimistic than the evidence guardrail", () => {
    const row = createDecisionAuditRow({
      candidate: {
        ...baseCandidate,
        id: "candidate_1",
      },
      displayName: "Maya Rios",
      displayHeadline: baseCandidate.headline,
      displayRegion: baseCandidate.region,
      artifacts,
      claims,
      recommendations,
      candidateDecisions: [
        {
          id: "decision_1",
          decisionType: DecisionType.ADVANCE,
          summary: "Advance now",
          rationale: "The candidate feels ready for sponsor outreach.",
          createdAt: new Date("2026-01-10T00:00:00.000Z"),
          decidedBy: {
            name: "Ada Sponsor",
          },
        },
      ],
      readinessScore: 52,
      reviewState: "pending",
      memoStatus: null,
      memo: {
        executiveSummary: "Maya built a nationally recognized climate network.",
        whyWorthBacking: "The file proves she can lead local climate work.",
        recommendedNextAction: "Advance now.",
      },
    });

    expect(row.systemDecision).toBe("do_not_advance");
    expect(row.humanDecision).toBe("advance");
    expect(row.disagreementDirection).toBe("human_more_optimistic");
    expect(row.hasDisagreement).toBe(true);
  });

  it("summarizes aligned, disagreement, and missing-human-decision cases", () => {
    const disagreement = createDecisionAuditRow({
      candidate: {
        ...baseCandidate,
        id: "candidate_1",
      },
      displayName: "Maya Rios",
      displayHeadline: baseCandidate.headline,
      displayRegion: baseCandidate.region,
      artifacts,
      claims,
      recommendations,
      candidateDecisions: [
        {
          id: "decision_1",
          decisionType: DecisionType.ADVANCE,
          summary: "Advance now",
          rationale: "The candidate feels ready for sponsor outreach.",
          createdAt: new Date("2026-01-10T00:00:00.000Z"),
          decidedBy: {
            name: "Ada Sponsor",
          },
        },
      ],
      readinessScore: 52,
      reviewState: "pending",
      memoStatus: null,
      memo: {
        executiveSummary: "Maya built a nationally recognized climate network.",
        whyWorthBacking: "The file proves she can lead local climate work.",
        recommendedNextAction: "Advance now.",
      },
    });

    const aligned = createDecisionAuditRow({
      candidate: {
        ...baseCandidate,
        id: "candidate_2",
        fullName: "Jonah Park",
      },
      displayName: "Jonah Park",
      displayHeadline: baseCandidate.headline,
      displayRegion: "Seattle, WA",
      artifacts: artifacts.map((artifact) => ({ ...artifact, candidateId: "candidate_2" })),
      claims: claims.map((claim) => ({ ...claim, candidateId: "candidate_2" })),
      recommendations: recommendations.map((recommendation) => ({ ...recommendation, candidateId: "candidate_2" })),
      candidateDecisions: [
        {
          id: "decision_2",
          decisionType: DecisionType.NEED_MORE_PROOF,
          summary: "Hold for stronger proof",
          rationale: "The file still needs stronger corroboration.",
          createdAt: new Date("2026-01-11T00:00:00.000Z"),
          decidedBy: {
            name: "Ada Sponsor",
          },
        },
      ],
      readinessScore: 50,
      reviewState: "pending",
      memoStatus: null,
      memo: {
        executiveSummary: "Jonah led a neighborhood cooling pilot [Resume].",
        whyWorthBacking: "The file shows he coordinated city staff across three sites [Resume].",
        recommendedNextAction: "Hold until the evidence base improves [Resume].",
      },
    });

    const noHumanDecision = createDecisionAuditRow({
      candidate: {
        ...baseCandidate,
        id: "candidate_3",
        fullName: "Leila Mensah",
      },
      displayName: "Leila Mensah",
      displayHeadline: baseCandidate.headline,
      displayRegion: "Accra, Ghana",
      artifacts: artifacts.map((artifact) => ({ ...artifact, candidateId: "candidate_3" })),
      claims: claims.map((claim) => ({ ...claim, candidateId: "candidate_3" })),
      recommendations: recommendations.map((recommendation) => ({ ...recommendation, candidateId: "candidate_3" })),
      candidateDecisions: [],
      readinessScore: 49,
      reviewState: "pending",
      memoStatus: null,
      memo: {
        executiveSummary: "Leila led a neighborhood cooling pilot [Resume].",
        whyWorthBacking: "The file shows she coordinated city staff across three sites [Resume].",
        recommendedNextAction: "Hold until the evidence base improves [Resume].",
      },
    });

    const report = buildDecisionAuditReport([disagreement, aligned, noHumanDecision]);

    expect(report.summary.totalCandidates).toBe(3);
    expect(report.summary.comparedCandidates).toBe(2);
    expect(report.summary.disagreementCount).toBe(1);
    expect(report.summary.noHumanDecisionCount).toBe(1);
    expect(report.summary.humanDecisionCoverage).toBe(67);
    expect(report.patternBreakdowns.evidenceDepth[0]?.label).toBe("Thin proof set");
  });

  it("maps underwriting decisions into persisted workflow enums", () => {
    expect(toPrismaUnderwritingDecision("advance")).toBe("ADVANCE");
    expect(toPrismaUnderwritingDecision("hold")).toBe("HOLD");
    expect(mapUnderwritingDecisionToDecisionType("hold", "request_more_proof")).toBe(DecisionType.NEED_MORE_PROOF);
    expect(mapUnderwritingDecisionToDecisionType("do_not_advance")).toBe(DecisionType.DO_NOT_ADVANCE);
  });
});
