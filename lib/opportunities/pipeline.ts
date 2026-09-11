import {
  BriefStatus,
  ReviewStatus,
  type Candidate,
  type OpportunityBrief,
} from "@prisma/client";

import { buildWarmPath } from "@/lib/ai";
import { generateCandidateMemo, generateCandidateRecommendations } from "@/lib/ai/pipeline";
import { prisma } from "@/lib/db/prisma";
import { buildSponsorMemoVariant } from "@/lib/memo/variant";
import { getOpportunityTemplate, selectOpportunityType } from "@/lib/opportunities/templates";
import { computeSponsorMatch } from "@/lib/scoring";
import { dedupeStrings, parseDelimitedList, serializeDelimitedList } from "@/lib/utils/strings";

async function getOpportunityContext(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      artifacts: true,
      evidenceClaims: true,
      sponsorMemo: true,
      recommendations: {
        include: {
          sponsor: true,
        },
      },
    },
  });

  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const [edges, sponsors, sponsorActivities, sponsorPipelineItems] = await Promise.all([
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: candidate.organizationId,
      },
    }),
    prisma.sponsor.findMany({
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

  return {
    candidate,
    edges,
    sponsors,
    sponsorOperatingContext: new Map(
      sponsors.map((sponsor) => [
        sponsor.id,
        {
          sponsorActivities: sponsorActivities.filter((item) => item.sponsorId === sponsor.id),
          sponsorPipelineItems: sponsorPipelineItems.filter((item) => item.sponsorId === sponsor.id),
        },
      ]),
    ),
  };
}

function firstParagraph(value: string | null | undefined) {
  return value?.split("\n\n")[0]?.trim() ?? "";
}

function buildBriefStatus(candidate: Candidate, reviewStatuses: ReviewStatus[]) {
  if (reviewStatuses.includes(ReviewStatus.FLAGGED)) {
    return BriefStatus.HOLD;
  }

  if (candidate.sponsorReadinessScore < 68) {
    return BriefStatus.DRAFT;
  }

  return BriefStatus.READY;
}

function buildBriefMarkdown({
  title,
  summary,
  whyNow,
  sponsorAsk,
  talkingPoints,
  proofToBring,
  successIndicators,
}: {
  title: string;
  summary: string;
  whyNow: string;
  sponsorAsk: string;
  talkingPoints: string[];
  proofToBring: string[];
  successIndicators: string[];
}) {
  return [
    `# ${title}`,
    "",
    "## Summary",
    summary,
    "",
    "## Why Now",
    whyNow,
    "",
    "## Sponsor Ask",
    sponsorAsk,
    "",
    "## Talking Points",
    ...talkingPoints.map((item) => `- ${item}`),
    "",
    "## Proof To Bring",
    ...proofToBring.map((item) => `- ${item}`),
    "",
    "## Success Indicators",
    ...successIndicators.map((item) => `- ${item}`),
  ].join("\n");
}

export async function generateCandidateOpportunityBriefs(candidateId: string, mode?: "mock" | "live") {
  let { candidate, edges, sponsors, sponsorOperatingContext } = await getOpportunityContext(candidateId);

  if (!candidate.sponsorMemo) {
    await generateCandidateMemo(candidateId, mode);
  }

  if (candidate.recommendations.length === 0) {
    await generateCandidateRecommendations(candidateId, mode);
  }

  ({ candidate, edges, sponsors, sponsorOperatingContext } = await getOpportunityContext(candidateId));

  if (!candidate.sponsorMemo) {
    throw new Error("A sponsor memo is required before generating opportunity briefs.");
  }

  const memo = {
    ...candidate.sponsorMemo,
    strengthsList: parseDelimitedList(candidate.sponsorMemo.strengths),
    risksList: parseDelimitedList(candidate.sponsorMemo.risks),
  };

  const candidateMatches = sponsors
    .map((sponsor) => ({
      sponsor,
      result: computeSponsorMatch(
        candidate,
        sponsor,
        candidate.artifacts,
        candidate.evidenceClaims,
        edges,
        sponsorOperatingContext.get(sponsor.id),
      ),
      connectionPath: buildWarmPath(candidate, sponsor, edges),
    }))
    .sort((left, right) => right.result.score - left.result.score)
    .slice(0, 3);

  await prisma.opportunityBrief.deleteMany({
    where: { candidateId },
  });

  const createdBriefs: OpportunityBrief[] = [];

  for (const match of candidateMatches) {
    const sponsorRecommendation =
      candidate.recommendations.find(
        (item) => item.recommendationType === "BEST_SPONSOR" && item.sponsorId === match.sponsor.id,
      ) ?? null;
    const warmPathRecommendation =
      candidate.recommendations.find(
        (item) => item.recommendationType === "WARM_PATH" && item.sponsorId === match.sponsor.id,
      ) ?? null;
    const nextActionRecommendation =
      candidate.recommendations.find((item) => item.recommendationType === "NEXT_ACTION") ?? null;
    const opportunityRecommendation =
      candidate.recommendations.find((item) => item.recommendationType === "OPPORTUNITY_TYPE") ?? null;

    const variant = buildSponsorMemoVariant({
      candidate,
      sponsor: match.sponsor,
      memo,
      claims: candidate.artifacts.flatMap((artifact) =>
        candidate.evidenceClaims
          .filter((claim) => claim.artifactId === artifact.id)
          .map((claim) => ({
            ...claim,
            artifactTitle: artifact.title,
          })),
      ),
      bestSponsorRecommendation: sponsorRecommendation,
      warmPathRecommendation,
      nextActionRecommendation,
      matchScore: match.result.score,
      matchBreakdown: match.result.breakdown,
      connectionPath: match.connectionPath,
    });

    const opportunityType = selectOpportunityType({
      sponsor: match.sponsor,
      candidateKeywords: match.result.candidateKeywords,
      hasLeadershipSignal: candidate.evidenceClaims.some((claim) => claim.category === "LEADERSHIP"),
    });
    const template = getOpportunityTemplate(opportunityType);
    const proofToBring = dedupeStrings([
      ...variant.selectedClaims.slice(0, 2).map(
        (claim) => `${claim.artifactTitle}: ${firstParagraph(claim.supportingExcerpt) || claim.claim}`,
      ),
      warmPathRecommendation?.actionSuggestion ?? "",
      opportunityRecommendation?.actionSuggestion ?? "",
    ]).slice(0, 4);
    const talkingPoints = dedupeStrings([
      template.thesis,
      firstParagraph(variant.sponsorAngle),
      ...variant.strengths,
    ]).slice(0, 4);
    const successIndicators = dedupeStrings([
      template.successFrame,
      `A second meeting or diligence request from ${match.sponsor.fullName}.`,
      `A sponsor-backed next step tied to ${match.sponsor.organization}.`,
    ]).slice(0, 3);
    const title = `${template.label} · ${candidate.fullName} × ${match.sponsor.fullName}`;
    const summary = `${template.thesis} ${firstParagraph(variant.summary)}`;
    const whyNow = `${template.whyNow} ${firstParagraph(nextActionRecommendation?.explanation)}`;
    const sponsorAsk = `${template.askStyle} ${sponsorRecommendation?.actionSuggestion ?? memo.recommendedAction}`;
    const status = buildBriefStatus(
      candidate,
      variant.selectedClaims.map((claim) => claim.reviewStatus),
    );
    const briefMarkdown = buildBriefMarkdown({
      title,
      summary,
      whyNow,
      sponsorAsk,
      talkingPoints,
      proofToBring,
      successIndicators,
    });

    const brief = await prisma.opportunityBrief.create({
      data: {
        candidateId: candidate.id,
        sponsorId: match.sponsor.id,
        opportunityType,
        status,
        title,
        summary,
        whyNow,
        sponsorAsk,
        talkingPoints: serializeDelimitedList(talkingPoints),
        proofToBring: serializeDelimitedList(proofToBring),
        successIndicators: serializeDelimitedList(successIndicators),
        briefMarkdown,
      },
    });

    createdBriefs.push(brief);
  }

  return createdBriefs;
}
