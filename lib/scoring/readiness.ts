import { SignalCategory, type Artifact, type Candidate, type EvidenceClaim, type RelationshipEdge } from "@prisma/client";

import { computeEvidenceFreshnessScore, computeSourceQualityScore } from "@/lib/scoring/evidence";
import { clampNumber, toFixedNumber } from "@/lib/utils/format";
import { ReadinessBreakdown } from "@/lib/scoring/types";

const HIGH_VALUE_SIGNALS = new Set<SignalCategory>([
  SignalCategory.INITIATIVE,
  SignalCategory.FOLLOW_THROUGH,
  SignalCategory.LEADERSHIP,
  SignalCategory.MISSION_ALIGNMENT,
  SignalCategory.RESILIENCE,
]);

export function computeSponsorReadiness(
  candidate: Candidate,
  artifacts: Artifact[],
  claims: EvidenceClaim[],
  edges: RelationshipEdge[],
) {
  const evidenceAmount = clampNumber((artifacts.length / 5) * 16, 0, 16);
  const uniqueTypes = new Set(artifacts.map((artifact) => artifact.artifactType)).size;
  const artifactDiversity = clampNumber((uniqueTypes / 5) * 12, 0, 12);
  const averageConfidence =
    claims.length > 0
      ? clampNumber((claims.reduce((sum, claim) => sum + claim.confidence, 0) / claims.length) * 16, 0, 16)
      : 0;
  const highValueClaimCount = claims.filter((claim) => HIGH_VALUE_SIGNALS.has(claim.category)).length;
  const highValueSignals = clampNumber((highValueClaimCount / 8) * 16, 0, 16);
  const relatedEdges = edges.filter((edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id);
  const relationshipStrength = clampNumber(
    (relatedEdges.reduce((sum, edge) => sum + edge.strength, 0) / 25) * 12,
    0,
    12,
  );

  const completenessChecks = [
    candidate.fullName.trim().length > 0,
    candidate.headline.trim().length > 0,
    candidate.bio.trim().length > 120,
    candidate.region.trim().length > 0,
    artifacts.length > 0,
  ];
  const profileCompleteness = clampNumber(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 8,
    0,
    8,
  );
  const sourceQuality = computeSourceQualityScore(artifacts, claims);
  const evidenceFreshness = computeEvidenceFreshnessScore(artifacts);

  const breakdown: ReadinessBreakdown = {
    evidenceAmount: toFixedNumber(evidenceAmount),
    artifactDiversity: toFixedNumber(artifactDiversity),
    averageConfidence: toFixedNumber(averageConfidence),
    highValueSignals: toFixedNumber(highValueSignals),
    relationshipStrength: toFixedNumber(relationshipStrength),
    profileCompleteness: toFixedNumber(profileCompleteness),
    sourceQuality,
    evidenceFreshness,
  };

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const needsReview = artifacts.length < 2 || claims.length < 3;

  return {
    score: Math.round(score),
    breakdown,
    status: needsReview ? "needs_review" : score >= 70 ? "ready" : score >= 45 ? "processing" : "not_started",
  };
}
