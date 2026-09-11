import {
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorOutcomeVerdict,
  SponsorPipelineStage,
  type SponsorActivity,
  type SponsorPipelineItem,
} from "@prisma/client";

import type { DecisionAuditRow } from "@/lib/audits/report";

export type OutcomeVerdict = "positive" | "negative" | "in_progress" | "none";
export type CalibrationStatus = "well_calibrated" | "watch" | "mixed" | "needs_data";
export type LearningSeverity = "caution" | "watch" | "positive" | "neutral";

type OutcomeActivityRecord = Pick<SponsorActivity, "candidateId" | "activityType" | "status" | "detail">;
type OutcomePipelineRecord = Pick<SponsorPipelineItem, "candidateId" | "stage" | "outcomeNote">;
type StructuredOutcomeRecord = {
  candidateId: string;
  verdict: SponsorOutcomeVerdict;
  detail: string;
  occurredAt: Date;
};

type DecisionOwnerRecord = {
  candidateId: string;
  decidedById: string | null;
  decidedByName: string | null;
};

export type CandidateOutcomeRow = {
  candidateId: string;
  verdict: OutcomeVerdict;
  rationale: string;
};

export type ReviewerCalibrationRow = {
  reviewerId: string;
  reviewerName: string;
  comparedFiles: number;
  alignedCount: number;
  disagreementCount: number;
  disagreementRate: number;
  alignmentRate: number;
  humanMoreOptimisticCount: number;
  systemMoreOptimisticCount: number;
  knownOutcomeCount: number;
  optimisticPositiveCount: number;
  optimisticNegativeCount: number;
  conservativePositiveCount: number;
  conservativeNegativeCount: number;
  status: CalibrationStatus;
  recommendation: string;
};

export type OutcomeLearningPattern = {
  bucketLabel: string;
  comparedFiles: number;
  knownOutcomeCount: number;
  humanMoreOptimisticPositive: number;
  humanMoreOptimisticNegative: number;
  systemMoreOptimisticPositive: number;
  systemMoreOptimisticNegative: number;
  severity: LearningSeverity;
  recommendation: string;
};

export type CandidateLearningInsight = {
  bucketLabel: string;
  severity: LearningSeverity;
  recommendation: string;
  knownOutcomeCount: number;
} | null;

export type DecisionQualitySummary = {
  knownOutcomeCount: number;
  systemAdvanceKnownCount: number;
  systemNonAdvanceKnownCount: number;
  humanAdvanceKnownCount: number;
  humanNonAdvanceKnownCount: number;
  systemFalsePositiveCount: number;
  systemFalseNegativeCount: number;
  humanFalsePositiveCount: number;
  humanFalseNegativeCount: number;
  systemFalsePositiveRate: number;
  systemFalseNegativeRate: number;
  humanFalsePositiveRate: number;
  humanFalseNegativeRate: number;
};

export type ScoreRecalibrationSuggestion = {
  bucketLabel: string;
  direction: "tighten" | "loosen" | "hold";
  priority: "high" | "medium" | "low";
  knownOutcomeCount: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  recommendation: string;
};

function hasNegativeLanguage(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /\b(blocked|passed|declined|did not move|didn't move|closed without|no movement|not proceeding|stalled)\b/i.test(
    value,
  );
}

function hasPositiveLanguage(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /\b(advocat|champion|selected|funded|moved forward|progressed|intro confirmed|backed|sponsor agreed)\b/i.test(
    value,
  );
}

function getReadinessBand(score: number) {
  if (score < 60) {
    return "Low readiness";
  }

  if (score < 75) {
    return "Emerging readiness";
  }

  return "Sponsor-ready";
}

function buildRate(count: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((count / denominator) * 100);
}

function isAdvanceDecision(decision: DecisionAuditRow["systemDecision"] | DecisionAuditRow["humanDecision"]) {
  return decision === "advance";
}

function isKnownOutcomeVerdict(verdict: CandidateOutcomeRow["verdict"]) {
  return verdict === "positive" || verdict === "negative";
}

function getPatternSeverity(input: {
  humanMoreOptimisticPositive: number;
  humanMoreOptimisticNegative: number;
  systemMoreOptimisticPositive: number;
  systemMoreOptimisticNegative: number;
  knownOutcomeCount: number;
}): LearningSeverity {
  if (input.knownOutcomeCount < 2) {
    return "neutral";
  }

  if (
    input.humanMoreOptimisticNegative >= 2 &&
    input.humanMoreOptimisticNegative > input.humanMoreOptimisticPositive
  ) {
    return "caution";
  }

  if (
    input.systemMoreOptimisticPositive >= 1 &&
    input.systemMoreOptimisticPositive >= input.systemMoreOptimisticNegative + 1
  ) {
    return "positive";
  }

  if (
    input.systemMoreOptimisticNegative >= 1 &&
    input.systemMoreOptimisticNegative > input.systemMoreOptimisticPositive
  ) {
    return "watch";
  }

  return "neutral";
}

function getPatternRecommendation(input: {
  severity: LearningSeverity;
  knownOutcomeCount: number;
  humanMoreOptimisticPositive: number;
  humanMoreOptimisticNegative: number;
  systemMoreOptimisticPositive: number;
  systemMoreOptimisticNegative: number;
}) {
  if (input.knownOutcomeCount < 2) {
    return "Not enough outcome-backed disagreement history yet.";
  }

  if (input.severity === "caution") {
    return "Human overrides above the guardrail are underperforming here. Raise the evidence threshold before sponsor-facing movement.";
  }

  if (input.severity === "positive") {
    return "This bucket has produced positive outcomes even when operators were more cautious than the guardrail. Review whether the local threshold is too conservative.";
  }

  if (input.severity === "watch") {
    return "The guardrail has been too permissive in this bucket often enough to justify closer review before outreach.";
  }

  return "Override outcomes are mixed. Keep the current threshold and inspect the file directly.";
}

export function deriveCandidateOutcomeRows(input: {
  candidateIds: string[];
  activities: OutcomeActivityRecord[];
  pipelineItems: OutcomePipelineRecord[];
  structuredOutcomes?: StructuredOutcomeRecord[];
}) {
  const latestStructuredOutcomeByCandidate = new Map<string, StructuredOutcomeRecord>();

  for (const outcome of (input.structuredOutcomes ?? []).slice().sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())) {
    if (!latestStructuredOutcomeByCandidate.has(outcome.candidateId)) {
      latestStructuredOutcomeByCandidate.set(outcome.candidateId, outcome);
    }
  }

  return input.candidateIds.map((candidateId) => {
    const structuredOutcome = latestStructuredOutcomeByCandidate.get(candidateId);

    if (structuredOutcome) {
      if (structuredOutcome.verdict === SponsorOutcomeVerdict.POSITIVE) {
        return {
          candidateId,
          verdict: "positive",
          rationale: structuredOutcome.detail || "Positive sponsor outcome recorded.",
        } satisfies CandidateOutcomeRow;
      }

      if (structuredOutcome.verdict === SponsorOutcomeVerdict.NEGATIVE) {
        return {
          candidateId,
          verdict: "negative",
          rationale: structuredOutcome.detail || "Negative sponsor outcome recorded.",
        } satisfies CandidateOutcomeRow;
      }

      return {
        candidateId,
        verdict: "in_progress",
        rationale: structuredOutcome.detail || "Outcome is mixed or still being pressure-tested.",
      } satisfies CandidateOutcomeRow;
    }

    const candidateActivities = input.activities.filter((activity) => activity.candidateId === candidateId);
    const candidatePipeline = input.pipelineItems.filter((item) => item.candidateId === candidateId);

    const explicitOutcome = candidateActivities.find(
      (activity) => activity.activityType === SponsorActivityType.OUTCOME_RECORDED,
    );

    if (explicitOutcome?.status === SponsorActivityStatus.COMPLETED) {
      return {
        candidateId,
        verdict: hasNegativeLanguage(explicitOutcome.detail) ? "negative" : "positive",
        rationale: explicitOutcome.detail,
      } satisfies CandidateOutcomeRow;
    }

    if (explicitOutcome?.status === SponsorActivityStatus.BLOCKED) {
      return {
        candidateId,
        verdict: "negative",
        rationale: explicitOutcome.detail,
      } satisfies CandidateOutcomeRow;
    }

    const blockedActivity = candidateActivities.find((activity) => activity.status === SponsorActivityStatus.BLOCKED);

    if (blockedActivity) {
      return {
        candidateId,
        verdict: "negative",
        rationale: blockedActivity.detail,
      } satisfies CandidateOutcomeRow;
    }

    const positivePipeline = candidatePipeline.find(
      (item) => item.stage === SponsorPipelineStage.CLOSED && hasPositiveLanguage(item.outcomeNote),
    );

    if (positivePipeline) {
      return {
        candidateId,
        verdict: "positive",
        rationale: positivePipeline.outcomeNote ?? "Positive sponsor outcome recorded.",
      } satisfies CandidateOutcomeRow;
    }

    const negativePipeline = candidatePipeline.find(
      (item) =>
        item.stage === SponsorPipelineStage.PASSED ||
        (item.stage === SponsorPipelineStage.CLOSED && hasNegativeLanguage(item.outcomeNote)),
    );

    if (negativePipeline) {
      return {
        candidateId,
        verdict: "negative",
        rationale: negativePipeline.outcomeNote ?? "Sponsor path closed without movement.",
      } satisfies CandidateOutcomeRow;
    }

    const activeSignals =
      candidateActivities.some((activity) => activity.status === SponsorActivityStatus.COMPLETED) ||
      candidateActivities.some((activity) => activity.status === SponsorActivityStatus.PENDING) ||
      candidatePipeline.some(
        (item) => item.stage !== SponsorPipelineStage.PASSED && item.stage !== SponsorPipelineStage.CLOSED,
      );

    if (activeSignals) {
      return {
        candidateId,
        verdict: "in_progress",
        rationale: "Sponsor path is active, but the outcome is not final yet.",
      } satisfies CandidateOutcomeRow;
    }

    return {
      candidateId,
      verdict: "none",
      rationale: "No sponsor outcome signal recorded yet.",
    } satisfies CandidateOutcomeRow;
  });
}

export function buildReviewerCalibrationRows(input: {
  rows: DecisionAuditRow[];
  decisionOwners: DecisionOwnerRecord[];
  outcomes: CandidateOutcomeRow[];
}) {
  const outcomeByCandidateId = new Map(input.outcomes.map((item) => [item.candidateId, item]));
  const ownerByCandidateId = new Map(input.decisionOwners.map((item) => [item.candidateId, item]));
  const grouped = new Map<string, { reviewerName: string; rows: DecisionAuditRow[] }>();

  for (const row of input.rows) {
    if (!row.humanDecision) {
      continue;
    }

    const owner = ownerByCandidateId.get(row.candidateId);

    if (!owner?.decidedById) {
      continue;
    }

    const existing = grouped.get(owner.decidedById) ?? {
      reviewerName: owner.decidedByName ?? "Unknown reviewer",
      rows: [],
    };
    existing.rows.push(row);
    grouped.set(owner.decidedById, existing);
  }

  return Array.from(grouped.entries())
    .map(([reviewerId, group]) => {
      let optimisticPositiveCount = 0;
      let optimisticNegativeCount = 0;
      let conservativePositiveCount = 0;
      let conservativeNegativeCount = 0;
      let knownOutcomeCount = 0;

      for (const row of group.rows) {
        const outcome = outcomeByCandidateId.get(row.candidateId);
        const isKnownOutcome = outcome?.verdict === "positive" || outcome?.verdict === "negative";

        if (!isKnownOutcome) {
          continue;
        }

        knownOutcomeCount += 1;

        if (row.disagreementDirection === "human_more_optimistic") {
          if (outcome?.verdict === "positive") {
            optimisticPositiveCount += 1;
          } else {
            optimisticNegativeCount += 1;
          }
        }

        if (row.disagreementDirection === "system_more_optimistic") {
          if (outcome?.verdict === "positive") {
            conservativePositiveCount += 1;
          } else {
            conservativeNegativeCount += 1;
          }
        }
      }

      const comparedFiles = group.rows.length;
      const disagreementCount = group.rows.filter((row) => row.hasDisagreement).length;
      const alignedCount = group.rows.filter((row) => !row.hasDisagreement).length;
      const disagreementRate = comparedFiles === 0 ? 0 : Math.round((disagreementCount / comparedFiles) * 100);
      const alignmentRate = comparedFiles === 0 ? 0 : Math.round((alignedCount / comparedFiles) * 100);
      const humanMoreOptimisticCount = group.rows.filter(
        (row) => row.disagreementDirection === "human_more_optimistic",
      ).length;
      const systemMoreOptimisticCount = group.rows.filter(
        (row) => row.disagreementDirection === "system_more_optimistic",
      ).length;

      let status: CalibrationStatus = "mixed";
      let recommendation = "Override history is mixed. Review the file directly before changing threshold policy.";

      if (comparedFiles < 2 || knownOutcomeCount === 0) {
        status = "needs_data";
        recommendation = "Not enough outcome-backed disagreement history yet to calibrate this reviewer.";
      } else if (optimisticNegativeCount >= 2 && optimisticNegativeCount > optimisticPositiveCount) {
        status = "watch";
        recommendation =
          "This reviewer’s optimistic overrides have underperformed. Tighten the proof threshold before sponsor-facing movement.";
      } else if (alignmentRate >= 60 && optimisticNegativeCount <= optimisticPositiveCount) {
        status = "well_calibrated";
        recommendation =
          "This reviewer is broadly aligned with the guardrail or overrides successfully when outcomes justify it.";
      }

      return {
        reviewerId,
        reviewerName: group.reviewerName,
        comparedFiles,
        alignedCount,
        disagreementCount,
        disagreementRate,
        alignmentRate,
        humanMoreOptimisticCount,
        systemMoreOptimisticCount,
        knownOutcomeCount,
        optimisticPositiveCount,
        optimisticNegativeCount,
        conservativePositiveCount,
        conservativeNegativeCount,
        status,
        recommendation,
      } satisfies ReviewerCalibrationRow;
    })
    .sort((left, right) => {
      const severityRank: Record<CalibrationStatus, number> = {
        watch: 0,
        mixed: 1,
        needs_data: 2,
        well_calibrated: 3,
      };

      return severityRank[left.status] - severityRank[right.status] || right.comparedFiles - left.comparedFiles;
    });
}

export function buildOutcomeLearningPatterns(input: {
  rows: DecisionAuditRow[];
  outcomes: CandidateOutcomeRow[];
}) {
  const outcomeByCandidateId = new Map(input.outcomes.map((item) => [item.candidateId, item]));
  const grouped = new Map<
    string,
    {
      comparedFiles: number;
      knownOutcomeCount: number;
      humanMoreOptimisticPositive: number;
      humanMoreOptimisticNegative: number;
      systemMoreOptimisticPositive: number;
      systemMoreOptimisticNegative: number;
    }
  >();

  for (const row of input.rows) {
    if (!row.humanDecision) {
      continue;
    }

    const bucketLabel = `${row.evidenceDepth} · ${getReadinessBand(row.readinessScore)}`;
    const existing = grouped.get(bucketLabel) ?? {
      comparedFiles: 0,
      knownOutcomeCount: 0,
      humanMoreOptimisticPositive: 0,
      humanMoreOptimisticNegative: 0,
      systemMoreOptimisticPositive: 0,
      systemMoreOptimisticNegative: 0,
    };

    existing.comparedFiles += 1;
    const outcome = outcomeByCandidateId.get(row.candidateId);

    if (outcome?.verdict === "positive" || outcome?.verdict === "negative") {
      existing.knownOutcomeCount += 1;

      if (row.disagreementDirection === "human_more_optimistic") {
        if (outcome.verdict === "positive") {
          existing.humanMoreOptimisticPositive += 1;
        } else {
          existing.humanMoreOptimisticNegative += 1;
        }
      }

      if (row.disagreementDirection === "system_more_optimistic") {
        if (outcome.verdict === "positive") {
          existing.systemMoreOptimisticPositive += 1;
        } else {
          existing.systemMoreOptimisticNegative += 1;
        }
      }
    }

    grouped.set(bucketLabel, existing);
  }

  return Array.from(grouped.entries())
    .map(([bucketLabel, bucket]) => {
      const severity = getPatternSeverity(bucket);

      return {
        bucketLabel,
        ...bucket,
        severity,
        recommendation: getPatternRecommendation({
          severity,
          ...bucket,
        }),
      } satisfies OutcomeLearningPattern;
    })
    .sort((left, right) => {
      const severityRank: Record<LearningSeverity, number> = {
        caution: 0,
        watch: 1,
        positive: 2,
        neutral: 3,
      };

      return severityRank[left.severity] - severityRank[right.severity] || right.knownOutcomeCount - left.knownOutcomeCount;
    });
}

export function getCandidateLearningInsight(input: {
  row: DecisionAuditRow;
  patterns: OutcomeLearningPattern[];
}) {
  const bucketLabel = `${input.row.evidenceDepth} · ${getReadinessBand(input.row.readinessScore)}`;
  const match = input.patterns.find((pattern) => pattern.bucketLabel === bucketLabel);

  if (!match || match.knownOutcomeCount === 0) {
    return null;
  }

  return {
    bucketLabel: match.bucketLabel,
    severity: match.severity,
    recommendation: match.recommendation,
    knownOutcomeCount: match.knownOutcomeCount,
  } satisfies CandidateLearningInsight;
}

export function buildDecisionQualitySummary(input: {
  rows: DecisionAuditRow[];
  outcomes: CandidateOutcomeRow[];
}) {
  const outcomeByCandidateId = new Map(input.outcomes.map((item) => [item.candidateId, item]));

  let knownOutcomeCount = 0;
  let systemAdvanceKnownCount = 0;
  let systemNonAdvanceKnownCount = 0;
  let humanAdvanceKnownCount = 0;
  let humanNonAdvanceKnownCount = 0;
  let systemFalsePositiveCount = 0;
  let systemFalseNegativeCount = 0;
  let humanFalsePositiveCount = 0;
  let humanFalseNegativeCount = 0;

  for (const row of input.rows) {
    const outcome = outcomeByCandidateId.get(row.candidateId);

    if (!outcome || !isKnownOutcomeVerdict(outcome.verdict)) {
      continue;
    }

    knownOutcomeCount += 1;

    if (isAdvanceDecision(row.systemDecision)) {
      systemAdvanceKnownCount += 1;
      if (outcome.verdict === "negative") {
        systemFalsePositiveCount += 1;
      }
    } else {
      systemNonAdvanceKnownCount += 1;
      if (outcome.verdict === "positive") {
        systemFalseNegativeCount += 1;
      }
    }

    if (!row.humanDecision) {
      continue;
    }

    if (isAdvanceDecision(row.humanDecision)) {
      humanAdvanceKnownCount += 1;
      if (outcome.verdict === "negative") {
        humanFalsePositiveCount += 1;
      }
    } else {
      humanNonAdvanceKnownCount += 1;
      if (outcome.verdict === "positive") {
        humanFalseNegativeCount += 1;
      }
    }
  }

  return {
    knownOutcomeCount,
    systemAdvanceKnownCount,
    systemNonAdvanceKnownCount,
    humanAdvanceKnownCount,
    humanNonAdvanceKnownCount,
    systemFalsePositiveCount,
    systemFalseNegativeCount,
    humanFalsePositiveCount,
    humanFalseNegativeCount,
    systemFalsePositiveRate: buildRate(systemFalsePositiveCount, systemAdvanceKnownCount),
    systemFalseNegativeRate: buildRate(systemFalseNegativeCount, systemNonAdvanceKnownCount),
    humanFalsePositiveRate: buildRate(humanFalsePositiveCount, humanAdvanceKnownCount),
    humanFalseNegativeRate: buildRate(humanFalseNegativeCount, humanNonAdvanceKnownCount),
  } satisfies DecisionQualitySummary;
}

export function buildScoreRecalibrationSuggestions(input: {
  rows: DecisionAuditRow[];
  outcomes: CandidateOutcomeRow[];
}) {
  const summary = buildDecisionQualitySummary(input);
  const outcomeByCandidateId = new Map(input.outcomes.map((item) => [item.candidateId, item]));
  const grouped = new Map<
    string,
    {
      knownOutcomeCount: number;
      falsePositiveCount: number;
      falseNegativeCount: number;
    }
  >();

  for (const row of input.rows) {
    const outcome = outcomeByCandidateId.get(row.candidateId);

    if (!outcome || !isKnownOutcomeVerdict(outcome.verdict)) {
      continue;
    }

    const bucketLabel = `${row.evidenceDepth} · ${getReadinessBand(row.readinessScore)}`;
    const existing = grouped.get(bucketLabel) ?? {
      knownOutcomeCount: 0,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
    };

    existing.knownOutcomeCount += 1;

    if (isAdvanceDecision(row.systemDecision) && outcome.verdict === "negative") {
      existing.falsePositiveCount += 1;
    }

    if (!isAdvanceDecision(row.systemDecision) && outcome.verdict === "positive") {
      existing.falseNegativeCount += 1;
    }

    grouped.set(bucketLabel, existing);
  }

  const bucketSuggestions = Array.from(grouped.entries())
    .filter(([, bucket]) => bucket.knownOutcomeCount > 0)
    .map(([bucketLabel, bucket]) => {
      let direction: ScoreRecalibrationSuggestion["direction"] = "hold";
      let priority: ScoreRecalibrationSuggestion["priority"] = "low";
      let recommendation =
        "Keep the current score threshold here. Outcome-backed misses are balanced or too sparse to justify a change.";

      if (bucket.falsePositiveCount >= Math.max(2, bucket.falseNegativeCount + 1)) {
        direction = "tighten";
        priority = bucket.falsePositiveCount >= 3 ? "high" : "medium";
        recommendation =
          "The system is advancing too aggressively in this bucket. Raise the sponsor-readiness bar or require another proof artifact before outreach.";
      } else if (bucket.falseNegativeCount >= Math.max(2, bucket.falsePositiveCount + 1)) {
        direction = "loosen";
        priority = bucket.falseNegativeCount >= 3 ? "high" : "medium";
        recommendation =
          "Positive outcomes are arriving even when the system stays conservative here. Review whether this bucket deserves a slightly lower hold threshold.";
      }

      return {
        bucketLabel,
        direction,
        priority,
        knownOutcomeCount: bucket.knownOutcomeCount,
        falsePositiveCount: bucket.falsePositiveCount,
        falseNegativeCount: bucket.falseNegativeCount,
        recommendation,
      } satisfies ScoreRecalibrationSuggestion;
    })
    .sort((left, right) => {
      const priorityRank: Record<ScoreRecalibrationSuggestion["priority"], number> = {
        high: 0,
        medium: 1,
        low: 2,
      };

      return (
        priorityRank[left.priority] - priorityRank[right.priority] ||
        right.knownOutcomeCount - left.knownOutcomeCount ||
        left.bucketLabel.localeCompare(right.bucketLabel)
      );
    });

  if (bucketSuggestions.length > 0) {
    return bucketSuggestions.slice(0, 4);
  }

  const globalDirection =
    summary.systemFalsePositiveRate >= summary.systemFalseNegativeRate + 15 && summary.systemFalsePositiveCount >= 2
      ? "tighten"
      : summary.systemFalseNegativeRate >= summary.systemFalsePositiveRate + 15 && summary.systemFalseNegativeCount >= 2
        ? "loosen"
        : "hold";

  return [
    {
      bucketLabel: "Global threshold",
      direction: globalDirection,
      priority: summary.knownOutcomeCount >= 4 ? "medium" : "low",
      knownOutcomeCount: summary.knownOutcomeCount,
      falsePositiveCount: summary.systemFalsePositiveCount,
      falseNegativeCount: summary.systemFalseNegativeCount,
      recommendation:
        globalDirection === "tighten"
          ? "Observed negative outcomes are concentrated in system advances. Tighten the default sponsor-ready threshold."
          : globalDirection === "loosen"
            ? "Observed positive outcomes are showing up in files the system held back. Review whether the default threshold is too conservative."
            : "Not enough consistent outcome-backed misses yet to justify a global scoring change.",
    } satisfies ScoreRecalibrationSuggestion,
  ];
}
