import {
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorOutcomeType,
  SponsorOutcomeVerdict,
  SponsorPipelineStage,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const SPONSOR_OUTCOME_TYPE_LABELS: Record<SponsorOutcomeType, string> = {
  ADVOCACY_COMMITTED: "Advocacy committed",
  INTRO_COMPLETED: "Introduction completed",
  OPPORTUNITY_SECURED: "Opportunity secured",
  FOLLOW_ON_SUPPORT: "Follow-on support",
  TIMING_MISMATCH: "Timing mismatch",
  DECLINED: "Declined",
  NO_MOVEMENT: "No movement",
  NEEDS_MORE_PROOF: "Needs more proof",
};

export const SPONSOR_OUTCOME_VERDICT_LABELS: Record<SponsorOutcomeVerdict, string> = {
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  MIXED: "Mixed",
};

export function getPipelineStageForOutcomeVerdict(verdict: SponsorOutcomeVerdict) {
  if (verdict === SponsorOutcomeVerdict.NEGATIVE) {
    return SponsorPipelineStage.PASSED;
  }

  return SponsorPipelineStage.CLOSED;
}

export async function recordSponsorOutcome(input: {
  organizationId: string;
  candidateId: string;
  sponsorId: string;
  pipelineItemId?: string | null;
  recordedById?: string | null;
  verdict: SponsorOutcomeVerdict;
  outcomeType: SponsorOutcomeType;
  title: string;
  detail: string;
  occurredAt: Date;
}) {
  const pipelineItem =
    input.pipelineItemId
      ? await prisma.sponsorPipelineItem.findFirst({
          where: {
            id: input.pipelineItemId,
            candidateId: input.candidateId,
            sponsorId: input.sponsorId,
          },
        })
      : await prisma.sponsorPipelineItem.findUnique({
          where: {
            candidateId_sponsorId: {
              candidateId: input.candidateId,
              sponsorId: input.sponsorId,
            },
          },
        });

  const outcome = await prisma.sponsorOutcome.create({
    data: {
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      sponsorId: input.sponsorId,
      pipelineItemId: pipelineItem?.id ?? null,
      recordedById: input.recordedById ?? null,
      verdict: input.verdict,
      outcomeType: input.outcomeType,
      title: input.title,
      detail: input.detail,
      occurredAt: input.occurredAt,
    },
  });

  await prisma.sponsorActivity.create({
    data: {
      candidateId: input.candidateId,
      sponsorId: input.sponsorId,
      opportunityBriefId: pipelineItem?.opportunityBriefId ?? null,
      activityType: SponsorActivityType.OUTCOME_RECORDED,
      status: input.verdict === SponsorOutcomeVerdict.NEGATIVE ? SponsorActivityStatus.BLOCKED : SponsorActivityStatus.COMPLETED,
      title: input.title,
      detail: input.detail,
      sourceLabel: "Structured sponsor outcome",
      occurredAt: input.occurredAt,
      completedAt: input.occurredAt,
    },
  });

  if (pipelineItem) {
    await prisma.sponsorPipelineItem.update({
      where: { id: pipelineItem.id },
      data: {
        stage: getPipelineStageForOutcomeVerdict(input.verdict),
        outcomeNote: input.detail,
        lastActivityAt: input.occurredAt,
      },
    });
  }

  return outcome;
}
