import {
  BriefStatus,
  RecommendationType,
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorPipelineStage,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const SPONSOR_PIPELINE_STAGE_LABELS: Record<SponsorPipelineStage, string> = {
  RECOMMENDED: "Recommended",
  UNDER_REVIEW: "Under review",
  BRIEF_READY: "Brief ready",
  OUTREACH_DRAFTED: "Outreach drafted",
  CONTACTED: "Contacted",
  INTRO_REQUESTED: "Intro requested",
  INTRO_CONFIRMED: "Intro confirmed",
  MEETING_SCHEDULED: "Meeting scheduled",
  ADVOCATING: "Advocating",
  PASSED: "Passed",
  CLOSED: "Closed",
};

const STAGE_RANK: Record<SponsorPipelineStage, number> = {
  RECOMMENDED: 0,
  UNDER_REVIEW: 1,
  BRIEF_READY: 2,
  OUTREACH_DRAFTED: 3,
  CONTACTED: 4,
  INTRO_REQUESTED: 5,
  INTRO_CONFIRMED: 6,
  MEETING_SCHEDULED: 7,
  ADVOCATING: 8,
  PASSED: 9,
  CLOSED: 10,
};

export function maxPipelineStage(left: SponsorPipelineStage, right: SponsorPipelineStage) {
  return STAGE_RANK[left] >= STAGE_RANK[right] ? left : right;
}

function getDerivedStageFromBrief(status: BriefStatus) {
  if (status === BriefStatus.HOLD) {
    return SponsorPipelineStage.UNDER_REVIEW;
  }

  if (status === BriefStatus.READY) {
    return SponsorPipelineStage.BRIEF_READY;
  }

  return SponsorPipelineStage.UNDER_REVIEW;
}

export function getPipelineStageFromActivity(
  activityType: SponsorActivityType,
  status: SponsorActivityStatus,
) {
  if (status === SponsorActivityStatus.BLOCKED) {
    return SponsorPipelineStage.PASSED;
  }

  if (activityType === SponsorActivityType.INTRO_REQUESTED) {
    return SponsorPipelineStage.INTRO_REQUESTED;
  }

  if (activityType === SponsorActivityType.INTRO_CONFIRMED) {
    return SponsorPipelineStage.INTRO_CONFIRMED;
  }

  if (activityType === SponsorActivityType.SPONSOR_CONTACTED) {
    return SponsorPipelineStage.CONTACTED;
  }

  if (activityType === SponsorActivityType.MEETING_SCHEDULED) {
    return SponsorPipelineStage.MEETING_SCHEDULED;
  }

  if (activityType === SponsorActivityType.FOLLOW_UP_SENT) {
    return SponsorPipelineStage.ADVOCATING;
  }

  if (activityType === SponsorActivityType.OUTCOME_RECORDED) {
    return SponsorPipelineStage.CLOSED;
  }

  return SponsorPipelineStage.OUTREACH_DRAFTED;
}

export async function syncCandidateSponsorPipeline(candidateId: string) {
  const [recommendations, briefs, existingItems] = await Promise.all([
    prisma.recommendation.findMany({
      where: {
        candidateId,
        recommendationType: RecommendationType.BEST_SPONSOR,
        sponsorId: {
          not: null,
        },
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 6,
    }),
    prisma.opportunityBrief.findMany({
      where: {
        candidateId,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidateId,
      },
    }),
  ]);

  const briefBySponsorId = new Map(briefs.map((brief) => [brief.sponsorId, brief]));
  const existingBySponsorId = new Map(existingItems.map((item) => [item.sponsorId, item]));

  for (const recommendation of recommendations) {
    if (!recommendation.sponsorId) {
      continue;
    }

    const brief = briefBySponsorId.get(recommendation.sponsorId);
    const existing = existingBySponsorId.get(recommendation.sponsorId);
    const derivedStage = brief
      ? getDerivedStageFromBrief(brief.status)
      : SponsorPipelineStage.RECOMMENDED;
    const stage = existing
      ? maxPipelineStage(existing.stage, derivedStage)
      : derivedStage;

    await prisma.sponsorPipelineItem.upsert({
      where: {
        candidateId_sponsorId: {
          candidateId,
          sponsorId: recommendation.sponsorId,
        },
      },
      update: {
        recommendationId: recommendation.id,
        opportunityBriefId: brief?.id ?? existing?.opportunityBriefId ?? null,
        score: recommendation.score,
        rationale: recommendation.explanation,
        nextStep: recommendation.actionSuggestion,
        stage,
      },
      create: {
        candidateId,
        sponsorId: recommendation.sponsorId,
        recommendationId: recommendation.id,
        opportunityBriefId: brief?.id ?? null,
        score: recommendation.score,
        rationale: recommendation.explanation,
        nextStep: recommendation.actionSuggestion,
        stage,
      },
    });
  }
}

export async function markPipelineOutreachDrafted(candidateId: string, sponsorId: string) {
  const item = await prisma.sponsorPipelineItem.findUnique({
    where: {
      candidateId_sponsorId: {
        candidateId,
        sponsorId,
      },
    },
  });

  if (!item) {
    return null;
  }

  return prisma.sponsorPipelineItem.update({
    where: { id: item.id },
    data: {
      stage: maxPipelineStage(item.stage, SponsorPipelineStage.OUTREACH_DRAFTED),
      lastActivityAt: new Date(),
    },
  });
}

export async function markPipelineFromActivity(input: {
  candidateId: string;
  sponsorId: string;
  activityType: SponsorActivityType;
  status: SponsorActivityStatus;
  occurredAt?: Date | null;
}) {
  const item = await prisma.sponsorPipelineItem.findUnique({
    where: {
      candidateId_sponsorId: {
        candidateId: input.candidateId,
        sponsorId: input.sponsorId,
      },
    },
  });

  if (!item) {
    return null;
  }

  const derivedStage = getPipelineStageFromActivity(input.activityType, input.status);

  return prisma.sponsorPipelineItem.update({
    where: { id: item.id },
    data: {
      stage: maxPipelineStage(item.stage, derivedStage),
      lastActivityAt: input.occurredAt ?? new Date(),
    },
  });
}

export async function updatePipelineItem(input: {
  itemId: string;
  stage: SponsorPipelineStage;
  ownerUserId?: string | null;
  nextDueAt?: Date | null;
  nextStep?: string | null;
  outcomeNote?: string | null;
}) {
  const item = await prisma.sponsorPipelineItem.findUnique({
    where: { id: input.itemId },
  });

  if (!item) {
    throw new Error("Pipeline item not found.");
  }

  return prisma.sponsorPipelineItem.update({
    where: { id: input.itemId },
    data: {
      stage: maxPipelineStage(item.stage, input.stage),
      ownerUserId: input.ownerUserId ?? null,
      nextDueAt: input.nextDueAt ?? null,
      nextStep: input.nextStep ?? null,
      outcomeNote: input.outcomeNote ?? null,
      lastActivityAt: new Date(),
    },
  });
}
