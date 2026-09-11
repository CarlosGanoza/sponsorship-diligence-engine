import {
  ProofRequestStatus,
  RecommendationType,
  type Artifact,
  type Candidate,
  type CandidateUpdate,
  type EvidenceClaim,
  type ProofRequest,
  type Recommendation,
  type Sponsor,
  type SponsorActivity,
  type SponsorOutcome,
  type SponsorPipelineItem,
} from "@prisma/client";

import { clampNumber } from "@/lib/utils/format";

type RecommendationFreshnessSeverity = "fresh" | "watch" | "stale";

export type RecommendationFreshnessReport = {
  isStale: boolean;
  severity: RecommendationFreshnessSeverity;
  label: string;
  summary: string;
  freshnessScore: number;
  scoreDrift: number;
  currentScore: number;
  currentRightNowLabel: string | null;
  reasons: string[];
};

export type RecommendationFreshnessSummary = {
  stale: number;
  watch: number;
  fresh: number;
  label: string;
  summary: string;
};

function getLatestDate(dates: Array<Date | null | undefined>) {
  const timestamps = dates
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .map((value) => value.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

function isLaterDate(left: Date | null, right: Date) {
  return Boolean(left && left.getTime() > right.getTime());
}

function buildEvidenceReasons(input: {
  recommendationUpdatedAt: Date;
  latestEvidenceAt: Date | null;
  latestOpenProofRequestAt: Date | null;
  recommendationType: RecommendationType;
  absoluteDrift: number;
}) {
  const reasons: string[] = [];
  const evidenceChanged = isLaterDate(input.latestEvidenceAt, input.recommendationUpdatedAt);
  const openProofGapChanged = isLaterDate(input.latestOpenProofRequestAt, input.recommendationUpdatedAt);

  if (evidenceChanged && (input.absoluteDrift >= 3 || input.recommendationType !== RecommendationType.BEST_SPONSOR)) {
    reasons.push("Candidate evidence changed after this recommendation was generated.");
  }

  if (openProofGapChanged) {
    reasons.push("An open proof request now sits on the file, so the recommendation should be reviewed before external use.");
  }

  return {
    reasons,
    evidenceChanged,
    openProofGapChanged,
  };
}

export function buildRecommendationFreshnessReport(input: {
  recommendation: Pick<Recommendation, "score" | "updatedAt" | "recommendationType">;
  currentScore: number;
  currentRightNowLabel?: string | null;
  candidate?: Pick<Candidate, "updatedAt"> | null;
  sponsor?: Pick<Sponsor, "updatedAt"> | null;
  artifacts?: Array<Pick<Artifact, "updatedAt">>;
  claims?: Array<Pick<EvidenceClaim, "updatedAt">>;
  candidateUpdates?: Array<Pick<CandidateUpdate, "updatedAt">>;
  proofRequests?: Array<Pick<ProofRequest, "updatedAt" | "status">>;
  sponsorActivities?: Array<Pick<SponsorActivity, "createdAt" | "updatedAt">>;
  sponsorPipelineItems?: Array<Pick<SponsorPipelineItem, "createdAt" | "updatedAt">>;
  sponsorOutcomes?: Array<Pick<SponsorOutcome, "occurredAt" | "recordedAt" | "updatedAt">>;
}) {
  const absoluteDrift = Math.abs(Math.round(input.currentScore - input.recommendation.score));
  const latestEvidenceAt = getLatestDate([
    input.candidate?.updatedAt ?? null,
    ...(input.artifacts ?? []).map((artifact) => artifact.updatedAt),
    ...(input.claims ?? []).map((claim) => claim.updatedAt),
    ...(input.candidateUpdates ?? []).map((update) => update.updatedAt),
  ]);
  const latestOpenProofRequestAt = getLatestDate(
    (input.proofRequests ?? [])
      .filter(
        (request) =>
          request.status === ProofRequestStatus.OPEN || request.status === ProofRequestStatus.IN_PROGRESS,
      )
      .map((request) => request.updatedAt),
  );
  const latestSponsorContextAt = getLatestDate([
    input.sponsor?.updatedAt ?? null,
    ...(input.sponsorActivities ?? []).flatMap((activity) => [activity.createdAt, activity.updatedAt]),
    ...(input.sponsorPipelineItems ?? []).flatMap((item) => [item.createdAt, item.updatedAt]),
    ...(input.sponsorOutcomes ?? []).flatMap((outcome) => [
      outcome.occurredAt,
      outcome.recordedAt,
      outcome.updatedAt,
    ]),
  ]);
  const sponsorContextChanged = isLaterDate(latestSponsorContextAt, input.recommendation.updatedAt);
  const operatingConstraint =
    input.currentRightNowLabel === "Paused right now" || input.currentRightNowLabel === "Capacity constrained";
  const evidenceChangeState = buildEvidenceReasons({
    recommendationUpdatedAt: input.recommendation.updatedAt,
    latestEvidenceAt,
    latestOpenProofRequestAt,
    recommendationType: input.recommendation.recommendationType,
    absoluteDrift,
  });
  const reasons = [...evidenceChangeState.reasons];

  if (sponsorContextChanged && (absoluteDrift >= 3 || input.recommendation.recommendationType !== RecommendationType.OPPORTUNITY_TYPE)) {
    reasons.push("Sponsor operating context changed after this recommendation was generated.");
  }

  if (absoluteDrift >= 7) {
    reasons.push(
      `Live sponsor fit moved ${absoluteDrift} points from the stored recommendation score.`,
    );
  }

  if (operatingConstraint) {
    reasons.push(`Current sponsor operating context is ${input.currentRightNowLabel?.toLowerCase()}.`);
  }

  let severity: RecommendationFreshnessSeverity = "fresh";

  if (
    operatingConstraint ||
    absoluteDrift >= 12 ||
    (evidenceChangeState.evidenceChanged && sponsorContextChanged) ||
    (evidenceChangeState.openProofGapChanged && absoluteDrift >= 4)
  ) {
    severity = "stale";
  } else if (reasons.length > 0) {
    severity = "watch";
  }

  const freshnessScore = clampNumber(
    100 -
      (evidenceChangeState.evidenceChanged ? 18 : 0) -
      (evidenceChangeState.openProofGapChanged ? 14 : 0) -
      (sponsorContextChanged ? 14 : 0) -
      Math.min(absoluteDrift * 4, 36) -
      (operatingConstraint ? 24 : 0),
    8,
    100,
  );
  const label =
    severity === "stale"
      ? "Stale recommendation"
      : severity === "watch"
        ? "Watch recommendation drift"
        : "Fresh recommendation";
  const summary =
    severity === "fresh"
      ? "This recommendation still matches the latest evidence and sponsor operating context."
      : severity === "watch"
        ? reasons[0] ?? "Some inputs have moved enough that the recommendation should be checked again."
        : reasons.join(" ");

  return {
    isStale: severity === "stale",
    severity,
    label,
    summary,
    freshnessScore,
    scoreDrift: Math.round(input.currentScore - input.recommendation.score),
    currentScore: input.currentScore,
    currentRightNowLabel: input.currentRightNowLabel ?? null,
    reasons,
  } satisfies RecommendationFreshnessReport;
}

export function summarizeRecommendationFreshness(reports: RecommendationFreshnessReport[]) {
  const stale = reports.filter((report) => report.severity === "stale").length;
  const watch = reports.filter((report) => report.severity === "watch").length;
  const fresh = reports.filter((report) => report.severity === "fresh").length;

  if (stale > 0) {
    return {
      stale,
      watch,
      fresh,
      label: "Stale recommendation drift",
      summary: `${stale} recommendation${stale === 1 ? "" : "s"} should be regenerated or reviewed before use.`,
    } satisfies RecommendationFreshnessSummary;
  }

  if (watch > 0) {
    return {
      stale,
      watch,
      fresh,
      label: "Recommendation drift watch",
      summary: `${watch} recommendation${watch === 1 ? "" : "s"} should be checked against the latest evidence or sponsor context.`,
    } satisfies RecommendationFreshnessSummary;
  }

  return {
    stale,
    watch,
    fresh,
    label: "Recommendations current",
    summary: "Current recommendation records still align with the latest file and sponsor context.",
  } satisfies RecommendationFreshnessSummary;
}
