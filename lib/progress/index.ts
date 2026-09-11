import {
  RecommendationType,
  SignalCategory,
  type CandidateProgressSnapshot,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";
import { computeSponsorReadiness } from "@/lib/scoring";
import { formatDate } from "@/lib/utils/format";

const HIGH_VALUE_SIGNALS = new Set<SignalCategory>([
  SignalCategory.INITIATIVE,
  SignalCategory.FOLLOW_THROUGH,
  SignalCategory.LEADERSHIP,
  SignalCategory.MISSION_ALIGNMENT,
  SignalCategory.RESILIENCE,
]);

export type ProgressMomentum =
  | "accelerating"
  | "building"
  | "steady"
  | "slipping"
  | "needs_attention";

export function buildCandidateTrajectory(snapshots: CandidateProgressSnapshot[]) {
  const ordered = snapshots.slice().sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());
  const first = ordered[0] ?? null;
  const latest = ordered.at(-1) ?? null;
  const previous = ordered.length > 1 ? ordered.at(-2) ?? null : null;

  if (!first || !latest) {
    return {
      snapshots: [] as Array<
        CandidateProgressSnapshot & {
          capturedAtLabel: string;
        }
      >,
      latest: null,
      previous: null,
      first: null,
      hasSnapshots: false,
      deltaFromStart: 0,
      deltaFromPrevious: 0,
      artifactDelta: 0,
      claimDelta: 0,
      highSignalDelta: 0,
      sponsorMatchDelta: 0,
      approvedDelta: 0,
      momentum: "steady" as ProgressMomentum,
      stageChanged: false,
    };
  }

  const deltaFromStart = latest.readinessScore - first.readinessScore;
  const deltaFromPrevious = previous ? latest.readinessScore - previous.readinessScore : 0;
  const artifactDelta = latest.artifactCount - first.artifactCount;
  const claimDelta = latest.evidenceClaimCount - first.evidenceClaimCount;
  const highSignalDelta = latest.highSignalClaimCount - first.highSignalClaimCount;
  const sponsorMatchDelta = latest.topSponsorMatchScore - first.topSponsorMatchScore;
  const approvedDelta = latest.approvedItemCount - first.approvedItemCount;

  let momentum: ProgressMomentum = "steady";

  if (latest.flaggedItemCount > 0) {
    momentum = "needs_attention";
  } else if (deltaFromPrevious >= 8) {
    momentum = "accelerating";
  } else if (deltaFromPrevious >= 3) {
    momentum = "building";
  } else if (deltaFromPrevious <= -1) {
    momentum = "slipping";
  }

  return {
    snapshots: ordered.map((snapshot) => ({
      ...snapshot,
      capturedAtLabel: formatDate(snapshot.capturedAt),
    })),
    latest,
    previous,
    first,
    hasSnapshots: true,
    deltaFromStart,
    deltaFromPrevious,
    artifactDelta,
    claimDelta,
    highSignalDelta,
    sponsorMatchDelta,
    approvedDelta,
    momentum,
    stageChanged: first.stage !== latest.stage,
  };
}

export async function captureCandidateProgressSnapshot({
  candidateId,
  label,
  summary,
  capturedAt,
}: {
  candidateId: string;
  label: string;
  summary: string;
  capturedAt?: Date;
}) {
  const [candidate, edges, latestSnapshot] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        artifacts: true,
        evidenceClaims: true,
        sponsorMemo: true,
        recommendations: {
          select: {
            score: true,
            recommendationType: true,
            reviewStatus: true,
          },
        },
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        OR: [{ fromEntityId: candidateId }, { toEntityId: candidateId }],
      },
    }),
    prisma.candidateProgressSnapshot.findFirst({
      where: { candidateId },
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!candidate) {
    return null;
  }

  const readiness = computeSponsorReadiness(candidate, candidate.artifacts, candidate.evidenceClaims, edges);
  const claimReviewSummary = summarizeReviewStatuses(
    candidate.evidenceClaims.map((claim) => claim.reviewStatus),
  );
  const recommendationReviewSummary = summarizeReviewStatuses(
    candidate.recommendations.map((recommendation) => recommendation.reviewStatus),
  );
  const reviewSummary = combineReviewSummaries([claimReviewSummary, recommendationReviewSummary]);
  const snapshotData = {
    candidateId,
    label,
    summary,
    stage: candidate.currentStage,
    readinessScore: readiness.score,
    topSponsorMatchScore: Math.round(
      Math.max(
        0,
        ...candidate.recommendations
          .filter((recommendation) => recommendation.recommendationType === RecommendationType.BEST_SPONSOR)
          .map((recommendation) => recommendation.score),
      ),
    ),
    artifactCount: candidate.artifacts.length,
    evidenceClaimCount: candidate.evidenceClaims.length,
    highSignalClaimCount: candidate.evidenceClaims.filter((claim) => HIGH_VALUE_SIGNALS.has(claim.category)).length,
    approvedItemCount: reviewSummary.approved,
    flaggedItemCount: reviewSummary.flagged,
    relationshipEdgeCount: edges.length,
    memoStatus: candidate.sponsorMemo?.status ?? null,
    capturedAt: capturedAt ?? new Date(),
  };

  if (
    latestSnapshot &&
    latestSnapshot.label === snapshotData.label &&
    latestSnapshot.stage === snapshotData.stage &&
    latestSnapshot.readinessScore === snapshotData.readinessScore &&
    latestSnapshot.topSponsorMatchScore === snapshotData.topSponsorMatchScore &&
    latestSnapshot.artifactCount === snapshotData.artifactCount &&
    latestSnapshot.evidenceClaimCount === snapshotData.evidenceClaimCount &&
    latestSnapshot.highSignalClaimCount === snapshotData.highSignalClaimCount &&
    latestSnapshot.approvedItemCount === snapshotData.approvedItemCount &&
    latestSnapshot.flaggedItemCount === snapshotData.flaggedItemCount &&
    latestSnapshot.relationshipEdgeCount === snapshotData.relationshipEdgeCount &&
    latestSnapshot.memoStatus === snapshotData.memoStatus
  ) {
    return latestSnapshot;
  }

  return prisma.candidateProgressSnapshot.create({
    data: snapshotData,
  });
}
