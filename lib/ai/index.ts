import type { Artifact, Candidate, EvidenceClaim, RelationshipEdge, Sponsor } from "@prisma/client";

import { parseTags, serializeTags, toPrismaSignalCategory } from "@/lib/ai/mappers";
import { mockAiProvider } from "@/lib/ai/mock";
import { createResilientAiProvider, setAiRuntimeState } from "@/lib/ai/provider";
import type { AiProvider, ArtifactAiInput, CandidateAiInput, EvidenceClaimAiInput, SponsorAiInput } from "@/lib/ai/types";
import { liveAiProvider } from "@/lib/ai/live";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/db/env";

export function mapCandidateToAiInput(candidate: Candidate): CandidateAiInput {
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    headline: candidate.headline,
    bio: candidate.bio,
    region: candidate.region,
    currentStage: candidate.currentStage,
    sponsorReadinessScore: candidate.sponsorReadinessScore,
  };
}

export function mapArtifactToAiInput(artifact: Artifact): ArtifactAiInput {
  return {
    id: artifact.id,
    artifactType: artifact.artifactType,
    title: artifact.title,
    rawText: artifact.rawText,
    sourceLabel: artifact.sourceLabel,
    fileName: artifact.fileName,
  };
}

export function mapClaimToAiInput(claim: EvidenceClaim, artifactTitle: string): EvidenceClaimAiInput {
  return {
    id: claim.id,
    category: claim.category.toLowerCase() as EvidenceClaimAiInput["category"],
    claim: claim.claim,
    confidence: claim.confidence,
    supportingExcerpt: claim.supportingExcerpt,
    artifactId: claim.artifactId,
    tags: claim.tags,
    artifactTitle,
  };
}

export function mapSponsorToAiInput(sponsor: Sponsor): SponsorAiInput {
  return {
    id: sponsor.id,
    fullName: sponsor.fullName,
    title: sponsor.title,
    organization: sponsor.organization,
    domainExpertise: sponsor.domainExpertise,
    seniorityLevel: sponsor.seniorityLevel,
    sponsorStyle: sponsor.sponsorStyle,
    interestTags: sponsor.interestTags,
    geography: sponsor.geography,
    warmIntroAvailable: sponsor.warmIntroAvailable,
    bio: sponsor.bio,
  };
}

export async function resolveAiMode() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "AI_MODE" },
    });

    if (setting?.value === "live" || setting?.value === "mock") {
      return setting.value;
    }
  } catch {
    return env.aiMode;
  }

  return env.aiMode;
}

export async function getAiProvider(mode?: "mock" | "live"): Promise<AiProvider> {
  const resolvedMode = mode ?? (await resolveAiMode());

  if (resolvedMode === "live" && env.openAiApiKey) {
    return createResilientAiProvider({
      liveProvider: liveAiProvider,
      fallbackProvider: mockAiProvider,
      liveModel: env.openAiModel,
    });
  }

  await setAiRuntimeState(
    "mock",
    resolvedMode === "live" && !env.openAiApiKey
      ? "Live mode was selected, but OPENAI_API_KEY is missing. Using deterministic mock mode."
      : "Using deterministic mock mode.",
  );

  return mockAiProvider;
}

export function normalizeClaimRows(
  candidateId: string,
  artifactId: string,
  claims: Awaited<ReturnType<AiProvider["extractEvidenceClaims"]>>["claims"],
) {
  return claims.map((claim) => ({
    candidateId,
    artifactId,
    category: toPrismaSignalCategory(claim.category),
    claim: claim.claim,
    confidence: claim.confidence,
    supportingExcerpt: claim.supportingExcerpt,
    tags: serializeTags(claim.tags),
  }));
}

export function hydrateClaimTags<T extends Pick<EvidenceClaim, "tags">>(claim: T) {
  return {
    ...claim,
    tags: parseTags(claim.tags),
  };
}

export function buildWarmPath(
  candidate: Candidate,
  sponsor: Sponsor,
  edges: RelationshipEdge[],
) {
  return buildWarmPathInsight(candidate, sponsor, edges).steps;
}

export function buildWarmPathInsight(
  candidate: Candidate,
  sponsor: Sponsor,
  edges: RelationshipEdge[],
) {
  const candidateNeighbors = edges.filter(
    (edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id,
  );
  const sponsorNeighbors = edges.filter(
    (edge) => edge.fromEntityId === sponsor.id || edge.toEntityId === sponsor.id,
  );

  const sharedPath = candidateNeighbors
    .map((candidateEdge) => {
      const candidateCounterpartyId =
        candidateEdge.fromEntityId === candidate.id ? candidateEdge.toEntityId : candidateEdge.fromEntityId;
      const sponsorConnection = sponsorNeighbors.find((sponsorEdge) => {
        const sponsorCounterpartyId =
          sponsorEdge.fromEntityId === sponsor.id ? sponsorEdge.toEntityId : sponsorEdge.fromEntityId;
        return sponsorCounterpartyId === candidateCounterpartyId;
      });

      if (!sponsorConnection) {
        return null;
      }

      const relationshipLabel = candidateEdge.notes;
      const combinedStrength = candidateEdge.strength + sponsorConnection.strength;

      return {
        steps: [
          `${candidate.fullName} -> ${relationshipLabel}`,
          `${relationshipLabel} -> ${sponsor.fullName}`,
        ],
        provenance: [
          `${candidateEdge.edgeType.replaceAll("_", " ").toLowerCase()} (${candidateEdge.strength}/5): ${candidateEdge.notes}`,
          `${sponsorConnection.edgeType.replaceAll("_", " ").toLowerCase()} (${sponsorConnection.strength}/5): ${sponsorConnection.notes}`,
        ],
        confidence: Math.min(100, combinedStrength * 10),
      };
    })
    .filter(Boolean)
    .sort((left, right) => (right?.confidence ?? 0) - (left?.confidence ?? 0))[0];

  if (sharedPath) {
    return {
      steps: sharedPath.steps,
      confidence: sharedPath.confidence,
      summary: `Shared connector path with estimated confidence ${sharedPath.confidence}/100.`,
      provenance: sharedPath.provenance,
    };
  }

  if (sponsor.warmIntroAvailable) {
    return {
      steps: [`Direct operator request possible through ${sponsor.organization}.`],
      confidence: 62,
      summary: "Direct operator route is available even without a documented two-hop connector.",
      provenance: [`Warm introductions are marked available for ${sponsor.fullName}.`],
    };
  }

  return {
    steps: ["No warm path found yet; strengthen proof before cold outreach."],
    confidence: 24,
    summary: "No documented warm path is currently available.",
    provenance: ["No shared connector or direct warm-intro flag is recorded for this sponsor."],
  };
}
