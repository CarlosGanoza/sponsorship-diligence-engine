import { ArtifactType, type Artifact, type EvidenceClaim } from "@prisma/client";

import { clampNumber, toFixedNumber } from "@/lib/utils/format";

const SOURCE_WEIGHTS: Record<ArtifactType, number> = {
  [ArtifactType.RESUME]: 0.8,
  [ArtifactType.PROJECT_SUMMARY]: 0.9,
  [ArtifactType.MENTOR_NOTE]: 1,
  [ArtifactType.RECOMMENDATION]: 1,
  [ArtifactType.REFLECTION]: 0.72,
  [ArtifactType.PORTFOLIO_LINK]: 0.84,
  [ArtifactType.OTHER]: 0.7,
};

const FRESHNESS_WINDOWS = {
  recentDays: 120,
  agingDays: 365,
  staleDays: 730,
};

const CLAIM_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "demonstrates",
  "evidence",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "provides",
  "shows",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function normalizeClaimText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeClaimText(value: string) {
  return normalizeClaimText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !CLAIM_STOP_WORDS.has(token));
}

function buildClaimFingerprint(claim: Pick<EvidenceClaim, "claim" | "supportingExcerpt">) {
  const tokens = Array.from(
    new Set([...tokenizeClaimText(claim.claim), ...tokenizeClaimText(claim.supportingExcerpt)]),
  ).sort();

  return tokens.join("|");
}

export function getArtifactSourceWeight(artifactType: ArtifactType) {
  return SOURCE_WEIGHTS[artifactType] ?? SOURCE_WEIGHTS[ArtifactType.OTHER];
}

export function getArtifactAgeDays(input: Pick<Artifact, "updatedAt" | "createdAt">, now = new Date()) {
  const baseline = input.updatedAt ?? input.createdAt;
  const ageMs = now.getTime() - baseline.getTime();

  return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
}

export function getArtifactFreshnessFactor(input: Pick<Artifact, "updatedAt" | "createdAt">, now = new Date()) {
  const ageDays = getArtifactAgeDays(input, now);

  if (ageDays <= FRESHNESS_WINDOWS.recentDays) {
    return 1;
  }

  if (ageDays <= FRESHNESS_WINDOWS.agingDays) {
    return 0.82;
  }

  if (ageDays <= FRESHNESS_WINDOWS.staleDays) {
    return 0.58;
  }

  return 0.3;
}

export function countDuplicateClaims(claims: Array<Pick<EvidenceClaim, "claim" | "supportingExcerpt">>) {
  const seen = new Set<string>();
  const seenExcerpts = new Set<string>();
  let duplicateCount = 0;

  for (const claim of claims) {
    const exactKey = `${normalizeClaimText(claim.claim)}|${normalizeClaimText(claim.supportingExcerpt)}`;
    const fingerprintKey = buildClaimFingerprint(claim);
    const excerptKey = normalizeClaimText(claim.supportingExcerpt);

    if (!exactKey.replace("|", "").trim() && !fingerprintKey.trim() && !excerptKey.trim()) {
      continue;
    }

    if (
      seen.has(exactKey) ||
      (fingerprintKey && seen.has(fingerprintKey)) ||
      (excerptKey && seenExcerpts.has(excerptKey))
    ) {
      duplicateCount += 1;
      continue;
    }

    seen.add(exactKey);

    if (fingerprintKey) {
      seen.add(fingerprintKey);
    }

    if (excerptKey) {
      seenExcerpts.add(excerptKey);
    }
  }

  return duplicateCount;
}

export function computeEvidenceFreshnessScore(
  artifacts: Array<Pick<Artifact, "updatedAt" | "createdAt">>,
  maxPoints = 10,
) {
  if (artifacts.length === 0) {
    return 0;
  }

  const averageFactor =
    artifacts.reduce((sum, artifact) => sum + getArtifactFreshnessFactor(artifact), 0) / artifacts.length;
  const staleArtifactCount = artifacts.filter(
    (artifact) => getArtifactAgeDays(artifact) > FRESHNESS_WINDOWS.agingDays,
  ).length;
  const agingArtifactCount = artifacts.filter(
    (artifact) => getArtifactAgeDays(artifact) > FRESHNESS_WINDOWS.recentDays,
  ).length;
  const staleShare = staleArtifactCount / artifacts.length;
  const agingShare = agingArtifactCount / artifacts.length;
  const freshnessPenalty = clampNumber(1 - staleShare * 0.45 - agingShare * 0.1, 0.35, 1);

  return toFixedNumber(clampNumber(averageFactor * freshnessPenalty * maxPoints, 0, maxPoints));
}

export function computeSourceQualityScore(
  artifacts: Array<Pick<Artifact, "id" | "artifactType">>,
  claims: Array<Pick<EvidenceClaim, "artifactId" | "confidence" | "claim" | "supportingExcerpt">>,
  maxPoints = 10,
) {
  if (artifacts.length === 0) {
    return 0;
  }

  const artifactWeightMap = new Map(
    artifacts.map((artifact) => [artifact.id, getArtifactSourceWeight(artifact.artifactType)]),
  );
  const duplicatePenalty =
    claims.length === 0 ? 1 : clampNumber(1 - countDuplicateClaims(claims) / Math.max(claims.length, 1), 0.45, 1);
  const uniqueArtifactTypes = new Set(artifacts.map((artifact) => artifact.artifactType)).size;
  const diversityFactor = clampNumber(0.8 + uniqueArtifactTypes * 0.08, 0.8, 1.08);
  const thirdPartyArtifactCount = artifacts.filter(
    (artifact) =>
      artifact.artifactType === ArtifactType.MENTOR_NOTE ||
      artifact.artifactType === ArtifactType.RECOMMENDATION,
  ).length;
  const corroborationFactor =
    thirdPartyArtifactCount > 0
      ? clampNumber(1 + Math.min(thirdPartyArtifactCount, 2) * 0.04, 1, 1.08)
      : 0.92;

  const weightedConfidence =
    claims.length > 0
      ? claims.reduce((sum, claim) => {
          const sourceWeight = artifactWeightMap.get(claim.artifactId) ?? SOURCE_WEIGHTS[ArtifactType.OTHER];
          return sum + claim.confidence * sourceWeight;
        }, 0) / claims.length
      : Array.from(artifactWeightMap.values()).reduce((sum, value) => sum + value, 0) / artifactWeightMap.size;

  return toFixedNumber(
    clampNumber(weightedConfidence * duplicatePenalty * diversityFactor * corroborationFactor * maxPoints, 0, maxPoints),
  );
}

export function summarizeEvidenceHealth(
  artifacts: Array<Pick<Artifact, "updatedAt" | "createdAt" | "artifactType" | "id">>,
  claims: Array<Pick<EvidenceClaim, "artifactId" | "confidence" | "claim" | "supportingExcerpt">>,
) {
  const ageDays = artifacts.map((artifact) => getArtifactAgeDays(artifact));
  const staleArtifactCount = ageDays.filter((days) => days > FRESHNESS_WINDOWS.agingDays).length;

  return {
    staleArtifactCount,
    oldestArtifactAgeDays: ageDays.length > 0 ? Math.max(...ageDays) : 0,
    sourceQualityScore: computeSourceQualityScore(artifacts, claims),
    evidenceFreshnessScore: computeEvidenceFreshnessScore(artifacts),
    duplicateClaimCount: countDuplicateClaims(claims),
  };
}
