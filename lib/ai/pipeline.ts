import {
  MemoStatus,
  RecommendationType,
  type Artifact,
  type Candidate,
  type EvidenceClaim,
  type Recommendation,
  type Sponsor,
} from "@prisma/client";

import {
  buildWarmPath,
  getAiProvider,
  mapArtifactToAiInput,
  mapCandidateToAiInput,
  mapClaimToAiInput,
  mapSponsorToAiInput,
  normalizeClaimRows,
} from "@/lib/ai";
import { prisma } from "@/lib/db/prisma";
import { computeSponsorMatch, computeSponsorReadiness } from "@/lib/scoring";
import { buildCandidateSafetyReport } from "@/lib/safety/guardrails";
import { getSafetySettings } from "@/lib/safety/settings";
import { dedupeStrings, serializeDelimitedList } from "@/lib/utils/strings";

async function getCandidateContext(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      artifacts: true,
      evidenceClaims: true,
      sponsorMemo: true,
      recommendations: true,
      candidateUpdates: {
        select: {
          title: true,
          summary: true,
        },
        orderBy: { submittedAt: "desc" },
        take: 8,
      },
      candidateNotes: {
        select: {
          title: true,
          content: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });

  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const edges = await prisma.relationshipEdge.findMany({
    where: {
      organizationId: candidate.organizationId,
      OR: [{ fromEntityId: candidateId }, { toEntityId: candidateId }],
    },
  });

  return { candidate, edges };
}

function ensureArtifactsHaveText(artifacts: Artifact[]) {
  const emptyArtifact = artifacts.find((artifact) => artifact.rawText.trim().length === 0);

  if (emptyArtifact) {
    throw new Error(`Artifact "${emptyArtifact.title}" has no text to analyze.`);
  }
}

async function mapClaimsWithArtifacts(claims: EvidenceClaim[], artifacts: Artifact[]) {
  return claims.map((claim) => {
    const artifact = artifacts.find((item) => item.id === claim.artifactId);

    return mapClaimToAiInput(claim, artifact?.title ?? "Unknown artifact");
  });
}

function buildInlineArtifactCitations(
  claims: Awaited<ReturnType<typeof mapClaimsWithArtifacts>>,
  count: number,
) {
  const citations = dedupeStrings(claims.slice(0, count).map((claim) => claim.artifactTitle)).map(
    (title) => `[${title}]`,
  );

  return citations.join(" ");
}

function appendArtifactCitations(
  text: string,
  claims: Awaited<ReturnType<typeof mapClaimsWithArtifacts>>,
  count: number,
) {
  const citations = buildInlineArtifactCitations(claims, count);

  return citations ? `${text} ${citations}` : text;
}

function buildEvidenceBasis(claims: Awaited<ReturnType<typeof mapClaimsWithArtifacts>>) {
  return claims
    .slice(0, 3)
    .map((claim) => `- ${claim.claim} [${claim.artifactTitle}]`)
    .join("\n");
}

export async function extractCandidateEvidence(candidateId: string, mode?: "mock" | "live") {
  const { candidate } = await getCandidateContext(candidateId);
  ensureArtifactsHaveText(candidate.artifacts);

  const ai = await getAiProvider(mode);

  await prisma.evidenceClaim.deleteMany({
    where: { candidateId },
  });

  const claimRows = [];

  for (const artifact of candidate.artifacts) {
    const response = await ai.extractEvidenceClaims({
      candidate: mapCandidateToAiInput(candidate),
      artifact: mapArtifactToAiInput(artifact),
    });

    claimRows.push(...normalizeClaimRows(candidate.id, artifact.id, response.claims));
  }

  if (claimRows.length === 0) {
    throw new Error("No evidence claims were generated.");
  }

  await prisma.evidenceClaim.createMany({
    data: claimRows,
  });

  const updatedClaims = await prisma.evidenceClaim.findMany({
    where: { candidateId },
  });

  const allEdges = await prisma.relationshipEdge.findMany({
    where: {
      organizationId: candidate.organizationId,
      OR: [{ fromEntityId: candidateId }, { toEntityId: candidateId }],
    },
  });

  const readiness = computeSponsorReadiness(candidate, candidate.artifacts, updatedClaims, allEdges);

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      sponsorReadinessScore: readiness.score,
    },
  });

  return { claims: updatedClaims, readiness };
}

export async function generateCandidateMemo(candidateId: string, mode?: "mock" | "live") {
  const { candidate, edges } = await getCandidateContext(candidateId);
  const ai = await getAiProvider(mode);
  const safetySettings = await getSafetySettings();

  let claims = candidate.evidenceClaims;

  if (claims.length === 0) {
    const extraction = await extractCandidateEvidence(candidateId, mode);
    claims = extraction.claims;
  }

  const readiness = computeSponsorReadiness(candidate, candidate.artifacts, claims, edges);
  const mappedClaims = await mapClaimsWithArtifacts(claims, candidate.artifacts);
  const rankedClaims = [...mappedClaims].sort((left, right) => right.confidence - left.confidence);
  const memo = await ai.generateSponsorMemo({
    candidate: mapCandidateToAiInput(candidate),
    artifacts: candidate.artifacts.map(mapArtifactToAiInput),
    claims: mappedClaims,
    readinessScore: readiness.score,
    readinessBreakdown: readiness.breakdown,
  });

  const action = await ai.recommendNextAdvocacyAction({
    candidate: mapCandidateToAiInput(candidate),
    artifacts: candidate.artifacts.map(mapArtifactToAiInput),
    claims: mappedClaims,
    readinessScore: readiness.score,
  });
  const safetyReport = buildCandidateSafetyReport({
    candidate,
    artifacts: candidate.artifacts,
    claims,
    recommendations: candidate.recommendations,
    readinessScore: readiness.score,
    memo: {
      executiveSummary: memo.executiveSummary,
      whyWorthBacking: memo.whyWorthBacking,
      recommendedNextAction: memo.recommendedNextAction,
    },
    candidateUpdates: candidate.candidateUpdates,
    operatorNotes: candidate.candidateNotes,
    additionalNarratives: [
      { label: "Memo strengths", text: memo.strongestSignals.join(". ") },
      { label: "Memo risks", text: memo.risks.join(". ") },
      { label: "Best-fit opportunity types", text: memo.bestFitOpportunityTypes.join(". ") },
      { label: "Advocacy action rationale", text: action.rationale },
    ],
  });
  const guardedActionText =
    safetyReport.decision === "advance"
      ? memo.recommendedNextAction
      : safetyReport.decision === "hold"
        ? "Hold outreach for now. Strengthen the proof base before sponsor-facing advocacy."
        : "Do not advance this profile externally yet. Rebuild the evidence file before sponsor targeting.";
  const augmentedRisks = dedupeStrings([...memo.risks, ...safetyReport.missingProof]).slice(0, 5);

  const citedSummary = appendArtifactCitations(memo.executiveSummary, rankedClaims, 2);
  const citedRationale = [
    appendArtifactCitations(memo.whyWorthBacking, rankedClaims, 3),
    "",
    "Evidence basis:",
    buildEvidenceBasis(rankedClaims),
    "",
    `Guardrail decision: ${safetyReport.decision.replaceAll("_", " ")}.`,
    safetyReport.rationale,
    "",
    `Best-fit opportunity types: ${memo.bestFitOpportunityTypes.join(", ")}.`,
  ].join("\n");
  const citedAction = [
    appendArtifactCitations(guardedActionText, rankedClaims, 2),
    "",
    `Decision: ${action.decision.replaceAll("_", " ")}.`,
    `Why now: ${action.rationale}`,
    ...(action.whyNotNow.length > 0
      ? ["", "Why not now:", ...action.whyNotNow.map((item) => `- ${item}`)]
      : []),
    ...(safetyReport.unsupportedStatements.length > 0
      ? [
          "",
          "Evidence discipline note:",
          ...safetyReport.unsupportedStatements.map((statement) => `- Needs review: ${statement}`),
        ]
      : []),
  ].join("\n");
  const memoStatus =
    safetySettings.strictEvidenceMode &&
    (
      safetyReport.unsupportedStatements.length > 0 ||
      safetyReport.decision !== "advance" ||
      (safetySettings.blockSponsorFacingPii && safetyReport.sponsorFacingContactDetailCount > 0)
    )
      ? MemoStatus.NEEDS_REVIEW
      : MemoStatus.READY;

  await prisma.sponsorMemo.upsert({
    where: { candidateId },
    create: {
      candidateId,
      summary: citedSummary,
      rationale: citedRationale,
      strengths: serializeDelimitedList(memo.strongestSignals),
      risks: serializeDelimitedList(augmentedRisks),
      recommendedAction: citedAction,
      memoMarkdown: memo.memoMarkdown,
      status: memoStatus,
    },
    update: {
      summary: citedSummary,
      rationale: citedRationale,
      strengths: serializeDelimitedList(memo.strongestSignals),
      risks: serializeDelimitedList(augmentedRisks),
      recommendedAction: citedAction,
      memoMarkdown: memo.memoMarkdown,
      status: memoStatus,
    },
  });

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      sponsorReadinessScore: readiness.score,
    },
  });

  return memo;
}

async function buildRecommendationRows({
  candidate,
  artifacts,
  claims,
  sponsors,
  edges,
  sponsorOperatingContext,
  mode,
}: {
  candidate: Candidate & {
    recommendations: Recommendation[];
    candidateUpdates: Array<{
      title: string;
      summary: string;
    }>;
    candidateNotes: Array<{
      title: string | null;
      content: string;
    }>;
  };
  artifacts: Artifact[];
  claims: EvidenceClaim[];
  sponsors: Sponsor[];
  edges: Awaited<ReturnType<typeof prisma.relationshipEdge.findMany>>;
  sponsorOperatingContext: Map<
    string,
    {
      sponsorActivities: Array<{ activityType: import("@prisma/client").SponsorActivityType; status: import("@prisma/client").SponsorActivityStatus; detail: string }>;
      sponsorPipelineItems: Array<{ stage: import("@prisma/client").SponsorPipelineStage; outcomeNote: string | null }>;
    }
  >;
  mode?: "mock" | "live";
}) {
  const ai = await getAiProvider(mode);
  const mappedClaims = await mapClaimsWithArtifacts(claims, artifacts);
  const matches = sponsors
    .map((sponsor) => ({
      sponsor,
      match: computeSponsorMatch(candidate, sponsor, artifacts, claims, edges, sponsorOperatingContext.get(sponsor.id)),
      connectionPath: buildWarmPath(candidate, sponsor, edges),
    }))
    .sort((left, right) => right.match.score - left.match.score);

  const topMatches = matches.slice(0, 3);
  const bestMatch = topMatches[0];

  if (!bestMatch) {
    return [];
  }

  const action = await ai.recommendNextAdvocacyAction({
    candidate: mapCandidateToAiInput(candidate),
    artifacts: artifacts.map(mapArtifactToAiInput),
    claims: mappedClaims,
    readinessScore: candidate.sponsorReadinessScore,
  });
  const safetyReport = buildCandidateSafetyReport({
    candidate,
    artifacts,
    claims,
    recommendations: candidate.recommendations,
    readinessScore: candidate.sponsorReadinessScore,
    memo: null,
    candidateUpdates: candidate.candidateUpdates,
    operatorNotes: candidate.candidateNotes,
    additionalNarratives: [
      { label: "Advocacy action rationale", text: action.rationale },
    ],
  });
  const actionDecision =
    safetyReport.decision === "advance" ? action.decision : safetyReport.decision;
  const guardedAction =
    actionDecision === "advance"
      ? action.action
      : actionDecision === "hold"
        ? "Hold sponsor outreach until the missing proof is strengthened and reviewed."
        : "Do not advance this file externally yet. Rebuild the evidence base first.";
  const guardedRationale =
    actionDecision === action.decision
      ? action.rationale
      : `${safetyReport.rationale} Current proof gaps: ${safetyReport.missingProof.join(" ")}`;

  const rows = [];

  for (const item of topMatches) {
    const explanation = await ai.explainSponsorMatch({
      candidate: mapCandidateToAiInput(candidate),
      sponsor: mapSponsorToAiInput(item.sponsor),
      claims: mappedClaims,
      matchScore: item.match.score,
      matchBreakdown: item.match.breakdown,
      connectionPath: item.connectionPath,
    });

    rows.push({
      candidateId: candidate.id,
      sponsorId: item.sponsor.id,
      recommendationType: RecommendationType.BEST_SPONSOR,
      score: item.match.score,
      explanation: `${explanation.whyFit}\n\n${explanation.scoreSummary}\n\nGuardrail decision: ${actionDecision.replaceAll("_", " ")}. ${safetyReport.rationale}`,
      actionSuggestion: guardedAction,
    });

    rows.push({
      candidateId: candidate.id,
      sponsorId: item.sponsor.id,
      recommendationType: RecommendationType.WARM_PATH,
      score: item.match.score,
      explanation: explanation.connectionPath.join(" "),
      actionSuggestion:
        dedupeStrings([...explanation.missingProof, ...safetyReport.missingProof]).join(" ") ||
        "No immediate proof gaps identified.",
    });
  }

  rows.push({
    candidateId: candidate.id,
    sponsorId: bestMatch.sponsor.id,
    recommendationType: RecommendationType.NEXT_ACTION,
    score: bestMatch.match.score,
    explanation: `${guardedRationale}${action.whyNotNow.length > 0 ? `\n\nWhy not now: ${action.whyNotNow.join(" ")}` : ""}`,
    actionSuggestion: guardedAction,
  });

  rows.push({
    candidateId: candidate.id,
    sponsorId: null,
    recommendationType: RecommendationType.OPPORTUNITY_TYPE,
    score: bestMatch.match.score,
    explanation:
      actionDecision === "advance"
        ? `Best current lane: ${bestMatch.match.candidateKeywords.slice(0, 3).join(", ") || "generalist sponsorship"} aligned with ${bestMatch.sponsor.organization}.`
        : `Opportunity type remains provisional until the missing proof is addressed.`,
    actionSuggestion:
      dedupeStrings([...action.requiredProof, ...action.whyNotNow, ...safetyReport.missingProof]).join(" ") ||
      "Proceed with current evidence set.",
  });

  return rows;
}

export async function generateCandidateRecommendations(candidateId: string, mode?: "mock" | "live") {
  const { candidate } = await getCandidateContext(candidateId);

  let claims = candidate.evidenceClaims;

  if (claims.length === 0) {
    const extraction = await extractCandidateEvidence(candidateId, mode);
    claims = extraction.claims;
  }

  const sponsors = await prisma.sponsor.findMany({
    where: {
      organizationId: candidate.organizationId,
    },
  });
  const [edges, sponsorActivities, sponsorPipelineItems] = await Promise.all([
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: candidate.organizationId,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: candidate.organizationId,
        },
      },
      select: {
        sponsorId: true,
        activityType: true,
        status: true,
        detail: true,
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: candidate.organizationId,
        },
      },
      select: {
        sponsorId: true,
        stage: true,
        outcomeNote: true,
      },
    }),
  ]);
  const sponsorOperatingContext = new Map(
    sponsors.map((sponsor) => [
      sponsor.id,
      {
        sponsorActivities: sponsorActivities.filter((item) => item.sponsorId === sponsor.id),
        sponsorPipelineItems: sponsorPipelineItems.filter((item) => item.sponsorId === sponsor.id),
      },
    ]),
  );

  const rows = await buildRecommendationRows({
    candidate,
    artifacts: candidate.artifacts,
    claims,
    sponsors,
    edges,
    sponsorOperatingContext,
    mode,
  });

  await prisma.recommendation.deleteMany({
    where: { candidateId },
  });

  if (rows.length > 0) {
    await prisma.recommendation.createMany({
      data: rows,
    });
  }

  return rows;
}
