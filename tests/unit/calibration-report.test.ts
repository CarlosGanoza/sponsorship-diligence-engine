import {
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorOutcomeVerdict,
  SponsorPipelineStage,
} from "@prisma/client";

import type { DecisionAuditRow } from "@/lib/audits/report";
import {
  buildDecisionQualitySummary,
  buildOutcomeLearningPatterns,
  buildReviewerCalibrationRows,
  buildScoreRecalibrationSuggestions,
  deriveCandidateOutcomeRows,
  getCandidateLearningInsight,
} from "@/lib/calibration/report";

function makeAuditRow(input: Partial<DecisionAuditRow> & Pick<DecisionAuditRow, "candidateId" | "readinessScore" | "evidenceDepth">): DecisionAuditRow {
  return {
    candidateId: input.candidateId,
    displayName: "Candidate",
    displayHeadline: "Headline",
    displayRegion: "Region",
    actualRegion: "Region",
    stage: "REVIEW",
    reviewState: "pending",
    readinessScore: input.readinessScore,
    artifactCount: 3,
    claimCount: 5,
    evidenceDepth: input.evidenceDepth,
    thirdPartyArtifactCount: 1,
    supportCoverage: 80,
    missingProofCount: 2,
    cautionFlagCount: 1,
    memoStatus: null,
    systemDecision: input.systemDecision ?? "hold",
    systemRationale: "System rationale",
    humanDecision: input.humanDecision ?? "advance",
    humanDecisionSummary: "Decision summary",
    humanDecisionRationale: "Decision rationale",
    humanDecidedById: input.humanDecidedById ?? "reviewer-1",
    humanDecidedByName: input.humanDecidedByName ?? "Alex Reviewer",
    humanDecisionAt: new Date("2026-03-20T12:00:00Z"),
    disagreementDirection: input.disagreementDirection ?? "human_more_optimistic",
    hasDisagreement: input.hasDisagreement ?? true,
  };
}

describe("calibration report", () => {
  it("derives positive and negative candidate outcomes from sponsor activity and pipeline state", () => {
    const outcomes = deriveCandidateOutcomeRows({
      candidateIds: ["candidate-positive", "candidate-negative", "candidate-active"],
      activities: [
        {
          candidateId: "candidate-positive",
          activityType: SponsorActivityType.OUTCOME_RECORDED,
          status: SponsorActivityStatus.COMPLETED,
          detail: "Sponsor agreed to advocate for the candidate.",
        },
        {
          candidateId: "candidate-negative",
          activityType: SponsorActivityType.INTRO_REQUESTED,
          status: SponsorActivityStatus.BLOCKED,
          detail: "Outreach was blocked pending stronger proof.",
        },
      ],
      pipelineItems: [
        {
          candidateId: "candidate-active",
          stage: SponsorPipelineStage.MEETING_SCHEDULED,
          outcomeNote: null,
        },
      ],
    });

    expect(outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: "candidate-positive", verdict: "positive" }),
        expect.objectContaining({ candidateId: "candidate-negative", verdict: "negative" }),
        expect.objectContaining({ candidateId: "candidate-active", verdict: "in_progress" }),
      ]),
    );
  });

  it("prefers structured sponsor outcomes when they exist", () => {
    const outcomes = deriveCandidateOutcomeRows({
      candidateIds: ["candidate-1"],
      activities: [
        {
          candidateId: "candidate-1",
          activityType: SponsorActivityType.OUTCOME_RECORDED,
          status: SponsorActivityStatus.BLOCKED,
          detail: "Older blocked signal.",
        },
      ],
      pipelineItems: [
        {
          candidateId: "candidate-1",
          stage: SponsorPipelineStage.PASSED,
          outcomeNote: "Older negative note.",
        },
      ],
      structuredOutcomes: [
        {
          candidateId: "candidate-1",
          verdict: SponsorOutcomeVerdict.POSITIVE,
          detail: "Structured positive outcome recorded after the path closed.",
          occurredAt: new Date("2026-03-21T12:00:00Z"),
        },
      ],
    });

    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        candidateId: "candidate-1",
        verdict: "positive",
      }),
    );
  });

  it("flags reviewer watch status when optimistic overrides repeatedly underperform", () => {
    const rows = [
      makeAuditRow({ candidateId: "c1", readinessScore: 54, evidenceDepth: "Developing proof set" }),
      makeAuditRow({ candidateId: "c2", readinessScore: 58, evidenceDepth: "Developing proof set" }),
      makeAuditRow({
        candidateId: "c3",
        readinessScore: 78,
        evidenceDepth: "Deep proof set",
        disagreementDirection: "aligned",
        hasDisagreement: false,
        humanDecision: "advance",
        systemDecision: "advance",
      }),
    ];
    const outcomes = [
      { candidateId: "c1", verdict: "negative" as const, rationale: "Blocked" },
      { candidateId: "c2", verdict: "negative" as const, rationale: "Passed" },
      { candidateId: "c3", verdict: "positive" as const, rationale: "Advocated" },
    ];

    const reviewers = buildReviewerCalibrationRows({
      rows,
      decisionOwners: rows.map((row) => ({
        candidateId: row.candidateId,
        decidedById: row.humanDecidedById,
        decidedByName: row.humanDecidedByName,
      })),
      outcomes,
    });

    expect(reviewers[0]?.status).toBe("watch");
    expect(reviewers[0]?.optimisticNegativeCount).toBe(2);
  });

  it("builds outcome-learning patterns and candidate insight by bucket", () => {
    const rows = [
      makeAuditRow({ candidateId: "c1", readinessScore: 52, evidenceDepth: "Developing proof set" }),
      makeAuditRow({ candidateId: "c2", readinessScore: 55, evidenceDepth: "Developing proof set" }),
      makeAuditRow({
        candidateId: "c3",
        readinessScore: 82,
        evidenceDepth: "Deep proof set",
        disagreementDirection: "system_more_optimistic",
        systemDecision: "advance",
        humanDecision: "hold",
        humanDecidedById: "reviewer-2",
        humanDecidedByName: "Jordan Reviewer",
      }),
    ];
    const outcomes = [
      { candidateId: "c1", verdict: "negative" as const, rationale: "Blocked" },
      { candidateId: "c2", verdict: "negative" as const, rationale: "Passed" },
      { candidateId: "c3", verdict: "positive" as const, rationale: "Advocated" },
    ];

    const patterns = buildOutcomeLearningPatterns({ rows, outcomes });
    const cautionPattern = patterns.find((pattern) => pattern.bucketLabel === "Developing proof set · Low readiness");

    expect(cautionPattern?.severity).toBe("caution");
    expect(cautionPattern?.humanMoreOptimisticNegative).toBe(2);

    const insight = getCandidateLearningInsight({
      row: rows[0]!,
      patterns,
    });

    expect(insight?.severity).toBe("caution");
    expect(insight?.bucketLabel).toBe("Developing proof set · Low readiness");
  });

  it("builds decision quality summaries and recalibration suggestions from known outcomes", () => {
    const rows = [
      makeAuditRow({
        candidateId: "c1",
        readinessScore: 78,
        evidenceDepth: "Deep proof set",
        systemDecision: "advance",
        humanDecision: "advance",
      }),
      makeAuditRow({
        candidateId: "c2",
        readinessScore: 75,
        evidenceDepth: "Deep proof set",
        systemDecision: "advance",
        humanDecision: "advance",
      }),
      makeAuditRow({
        candidateId: "c3",
        readinessScore: 58,
        evidenceDepth: "Developing proof set",
        systemDecision: "hold",
        humanDecision: "hold",
        disagreementDirection: "aligned",
        hasDisagreement: false,
      }),
    ];
    const outcomes = [
      { candidateId: "c1", verdict: "negative" as const, rationale: "Closed without sponsor movement." },
      { candidateId: "c2", verdict: "negative" as const, rationale: "Declined after review." },
      { candidateId: "c3", verdict: "positive" as const, rationale: "Sponsor still backed the candidate." },
    ];

    const summary = buildDecisionQualitySummary({
      rows,
      outcomes,
    });

    expect(summary.systemFalsePositiveCount).toBe(2);
    expect(summary.systemFalseNegativeCount).toBe(1);

    const suggestions = buildScoreRecalibrationSuggestions({
      rows,
      outcomes,
    });

    expect(suggestions[0]?.direction).toBe("tighten");
    expect(suggestions[0]?.bucketLabel).toBe("Deep proof set · Sponsor-ready");
  });
});
