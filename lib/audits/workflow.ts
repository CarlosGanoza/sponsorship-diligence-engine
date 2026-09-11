import {
  DecisionType,
  DisagreementResolutionType,
  DisagreementReviewStatus,
  MembershipRole,
  ProofRequestType,
  TaskPriority,
  TaskStatus,
  UnderwritingDecision as PrismaUnderwritingDecision,
} from "@prisma/client";

import {
  createDecisionAuditRow,
  formatUnderwritingDecision,
  mapUnderwritingDecisionToDecisionType,
  toPrismaDisagreementDirection,
  toPrismaUnderwritingDecision,
  type UnderwritingDecision,
} from "@/lib/audits/report";
import { prisma } from "@/lib/db/prisma";
import { buildProofRequestSuggestions, createProofRequest, createTaskFromProofRequest } from "@/lib/proof-requests";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";
import { computeSponsorReadiness } from "@/lib/scoring";
import { buildCandidateSafetyReport } from "@/lib/safety/guardrails";

export const DISAGREEMENT_REVIEW_STATUS_LABELS: Record<DisagreementReviewStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  ESCALATED: "Escalated",
};

export const DISAGREEMENT_RESOLUTION_LABELS: Record<DisagreementResolutionType, string> = {
  FOLLOW_SYSTEM: "Follow system guardrail",
  UPHOLD_HUMAN: "Uphold human judgment",
  REQUEST_MORE_PROOF: "Request more proof",
  SECOND_REVIEW: "Second review requested",
};

export type HighRiskDisagreementAssessment = {
  shouldTrigger: boolean;
  riskScore: number;
  reason: string | null;
  factors: string[];
};

function fromPrismaUnderwritingDecision(decision: PrismaUnderwritingDecision): UnderwritingDecision {
  if (decision === PrismaUnderwritingDecision.ADVANCE) {
    return "advance";
  }

  if (decision === PrismaUnderwritingDecision.HOLD) {
    return "hold";
  }

  return "do_not_advance";
}

function buildDisagreementSummary(input: {
  humanDecision: UnderwritingDecision;
  systemDecision: UnderwritingDecision;
}) {
  return `Human ${formatUnderwritingDecision(input.humanDecision)} vs system ${formatUnderwritingDecision(input.systemDecision)}`;
}

function buildResolutionSummary(resolutionType: DisagreementResolutionType) {
  switch (resolutionType) {
    case DisagreementResolutionType.FOLLOW_SYSTEM:
      return "Accepted current guardrail recommendation";
    case DisagreementResolutionType.UPHOLD_HUMAN:
      return "Upheld human underwriting judgment";
    case DisagreementResolutionType.REQUEST_MORE_PROOF:
      return "Paused for stronger proof";
    default:
      return "Escalated for second review";
  }
}

export async function getCurrentDecisionAudit(candidateId: string, organizationId: string) {
  const [candidate, edges] = await Promise.all([
    prisma.candidate.findFirst({
      where: {
        id: candidateId,
        organizationId,
      },
      include: {
        artifacts: true,
        evidenceClaims: true,
        recommendations: true,
        candidateDecisions: {
          include: {
            decidedBy: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        candidateNotes: {
          select: {
            title: true,
            content: true,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        candidateUpdates: {
          select: {
            title: true,
            summary: true,
          },
          orderBy: { submittedAt: "desc" },
          take: 8,
        },
        sponsorMemo: {
          select: {
            status: true,
            summary: true,
            rationale: true,
            recommendedAction: true,
          },
        },
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId,
      },
    }),
  ]);

  if (!candidate) {
    return null;
  }

  const readiness = computeSponsorReadiness(
    candidate,
    candidate.artifacts,
    candidate.evidenceClaims,
    edges.filter((edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id),
  );
  const reviewSummary = combineReviewSummaries([
    summarizeReviewStatuses(candidate.evidenceClaims.map((claim) => claim.reviewStatus)),
    summarizeReviewStatuses(candidate.recommendations.map((recommendation) => recommendation.reviewStatus)),
  ]);

  return {
    candidate,
    audit: createDecisionAuditRow({
      candidate,
      displayName: candidate.fullName,
      displayHeadline: candidate.headline,
      displayRegion: candidate.region,
      artifacts: candidate.artifacts,
      claims: candidate.evidenceClaims,
      recommendations: candidate.recommendations,
      candidateDecisions: candidate.candidateDecisions,
      readinessScore: readiness.score,
      reviewState: reviewSummary.status,
      memoStatus: candidate.sponsorMemo?.status ?? null,
      memo: candidate.sponsorMemo
        ? {
            executiveSummary: candidate.sponsorMemo.summary,
            whyWorthBacking: candidate.sponsorMemo.rationale,
            recommendedNextAction: candidate.sponsorMemo.recommendedAction,
          }
        : null,
      candidateUpdates: candidate.candidateUpdates,
      operatorNotes: candidate.candidateNotes,
      additionalNarratives: candidate.recommendations.slice(0, 4).flatMap((recommendation) => [
        { label: `${recommendation.recommendationType} explanation`, text: recommendation.explanation },
        { label: `${recommendation.recommendationType} action`, text: recommendation.actionSuggestion },
      ]),
    }),
  };
}

export async function upsertDisagreementReview(input: {
  candidateId: string;
  organizationId: string;
  assignedUserId?: string | null;
  dueAt?: Date | null;
  autoTriggered?: boolean;
  riskScore?: number;
  triggerReason?: string | null;
}) {
  const context = await getCurrentDecisionAudit(input.candidateId, input.organizationId);

  if (!context) {
    throw new Error("Candidate not found.");
  }

  if (!context.audit.hasDisagreement || !context.audit.humanDecision) {
    throw new Error("There is no active human-vs-system disagreement to review.");
  }

  const disagreementDirection =
    context.audit.disagreementDirection === "human_more_optimistic"
      ? "human_more_optimistic"
      : "system_more_optimistic";

  const existing = await prisma.disagreementReview.findFirst({
    where: {
      candidateId: input.candidateId,
      status: {
        in: [DisagreementReviewStatus.OPEN, DisagreementReviewStatus.IN_PROGRESS, DisagreementReviewStatus.ESCALATED],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = {
    assignedUserId: input.assignedUserId ?? null,
    dueAt: input.dueAt ?? null,
    sourceSystemDecision: toPrismaUnderwritingDecision(context.audit.systemDecision),
    sourceHumanDecision: toPrismaUnderwritingDecision(context.audit.humanDecision),
    disagreementDirection: toPrismaDisagreementDirection(disagreementDirection),
    summary: buildDisagreementSummary({
      humanDecision: context.audit.humanDecision,
      systemDecision: context.audit.systemDecision,
    }),
    status:
      existing?.status === DisagreementReviewStatus.ESCALATED
        ? DisagreementReviewStatus.ESCALATED
        : input.assignedUserId
          ? DisagreementReviewStatus.IN_PROGRESS
          : DisagreementReviewStatus.OPEN,
    autoTriggered: input.autoTriggered ?? existing?.autoTriggered ?? false,
    riskScore: input.riskScore ?? existing?.riskScore ?? 0,
    triggerReason:
      input.triggerReason !== undefined
        ? input.triggerReason
        : existing?.triggerReason ?? null,
  };

  if (existing) {
    return prisma.disagreementReview.update({
      where: { id: existing.id },
      data,
      include: {
        assignedUser: true,
        reviewedBy: true,
        operatorTask: true,
      },
    });
  }

  return prisma.disagreementReview.create({
    data: {
      candidateId: input.candidateId,
      ...data,
    },
    include: {
      assignedUser: true,
      reviewedBy: true,
      operatorTask: true,
    },
  });
}

export function buildHighRiskDisagreementAssessment(input: {
  audit: NonNullable<Awaited<ReturnType<typeof getCurrentDecisionAudit>>>["audit"];
  safetyReport: ReturnType<typeof buildCandidateSafetyReport>;
  openProofRequestCount: number;
}) {
  if (!input.audit.hasDisagreement || !input.audit.humanDecision) {
    return {
      shouldTrigger: false,
      riskScore: 0,
      reason: null,
      factors: [],
    } satisfies HighRiskDisagreementAssessment;
  }

  let riskScore = 0;
  const factors: string[] = [];

  if (input.audit.disagreementDirection === "human_more_optimistic") {
    riskScore += 3;
    factors.push("The latest human call is materially more optimistic than the current guardrail.");
  } else if (input.audit.disagreementDirection === "system_more_optimistic") {
    riskScore += 2;
    factors.push("The current guardrail is more optimistic than the latest human call.");
  }

  if (input.audit.systemDecision === "do_not_advance" && input.audit.humanDecision === "advance") {
    riskScore += 4;
    factors.push("The file is split between do not advance and advance.");
  } else if (input.audit.systemDecision === "hold" && input.audit.humanDecision === "advance") {
    riskScore += 3;
    factors.push("The file is split between hold and advance.");
  } else if (input.audit.systemDecision === "do_not_advance" && input.audit.humanDecision === "hold") {
    riskScore += 2;
    factors.push("The file is split between do not advance and hold.");
  }

  if (input.safetyReport.supportCoverage < 70) {
    riskScore += 2;
    factors.push("Memo support coverage is still below 70%.");
  } else if (input.safetyReport.supportCoverage < 85) {
    riskScore += 1;
    factors.push("Memo support coverage is still incomplete.");
  }

  if (input.safetyReport.unsupportedStatements.length > 0) {
    riskScore += 2;
    factors.push("Some memo statements still lack clean evidence support.");
  }

  if (input.safetyReport.potentialContradictions.length > 0) {
    riskScore += 2;
    factors.push("Potential contradictions are still unresolved.");
  }

  if ((input.safetyReport.blockingContradictions?.length ?? 0) > 0) {
    riskScore += 3;
    factors.push("At least one blocker-level contradiction is still open.");
  }

  if (input.safetyReport.missingProof.length >= 3) {
    riskScore += 2;
    factors.push("Several proof gaps remain open.");
  } else if (input.safetyReport.missingProof.length > 0) {
    riskScore += 1;
    factors.push("The file still has missing proof.");
  }

  if (input.openProofRequestCount > 0) {
    riskScore += 1;
    factors.push("There are still open proof requests tied to this file.");
  }

  if (input.audit.reviewState === "flagged") {
    riskScore += 1;
    factors.push("Flagged review items are still active.");
  }

  if (input.audit.readinessScore < 55) {
    riskScore += 1;
    factors.push("Readiness is still below a stable sponsorship threshold.");
  }

  if (input.audit.artifactCount <= 2) {
    riskScore += 2;
    factors.push("The file is still too thin for a stable sponsorship call.");
  }

  if (input.audit.thirdPartyArtifactCount === 0) {
    riskScore += 1;
    factors.push("There is still no third-party corroboration in the file.");
  }

  if (input.audit.stage === "MEMO_READY" || input.audit.stage === "SPONSOR_OUTREACH") {
    riskScore += 1;
    factors.push("The disagreement sits on a sponsor-facing stage.");
  }

  if (
    (input.audit.stage === "MEMO_READY" || input.audit.stage === "SPONSOR_OUTREACH") &&
    input.safetyReport.supportCoverage < 85
  ) {
    riskScore += 2;
    factors.push("Sponsor-facing narrative still has incomplete citation coverage.");
  }

  if (input.safetyReport.sourceQualityScore < 6) {
    riskScore += 1;
    factors.push("Source quality is still thin for a reputational ask.");
  }

  const shouldTrigger =
    riskScore >= 6 ||
    ((input.audit.stage === "MEMO_READY" || input.audit.stage === "SPONSOR_OUTREACH") &&
      ((input.safetyReport.blockingContradictions?.length ?? 0) > 0 || input.safetyReport.supportCoverage < 70));

  return {
    shouldTrigger,
    riskScore,
    reason: shouldTrigger ? factors.slice(0, 3).join(" ") : null,
    factors,
  } satisfies HighRiskDisagreementAssessment;
}

async function pickAutoReviewer(organizationId: string, excludedUserId?: string | null) {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId,
      user: {
        role: {
          not: "CANDIDATE",
        },
      },
    },
    include: {
      user: true,
    },
    orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
  });

  return (
    memberships.find((membership) => membership.userId !== excludedUserId) ??
    memberships.find((membership) => membership.membershipRole === MembershipRole.OWNER) ??
    memberships[0] ??
    null
  );
}

async function resolveAutoTriggeredDisagreementReview(reviewId: string, rationale: string) {
  const review = await prisma.disagreementReview.findUnique({
    where: { id: reviewId },
    include: {
      operatorTask: true,
    },
  });

  if (!review || !review.autoTriggered) {
    return null;
  }

  const updated = await prisma.disagreementReview.update({
    where: { id: review.id },
    data: {
      status: DisagreementReviewStatus.RESOLVED,
      resolvedAt: new Date(),
      rationale,
      triggerReason: rationale,
    },
    include: {
      operatorTask: true,
    },
  });

  if (updated.operatorTask) {
    await prisma.operatorTask.update({
      where: { id: updated.operatorTask.id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  return updated;
}

export async function ensureHighRiskDisagreementReview(candidateId: string, organizationId: string) {
  const context = await getCurrentDecisionAudit(candidateId, organizationId);

  if (!context) {
    return null;
  }

  const existing = await prisma.disagreementReview.findFirst({
    where: {
      candidateId,
      status: {
        in: [DisagreementReviewStatus.OPEN, DisagreementReviewStatus.IN_PROGRESS, DisagreementReviewStatus.ESCALATED],
      },
    },
    include: {
      operatorTask: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!context.audit.hasDisagreement || !context.audit.humanDecision) {
    if (existing?.autoTriggered) {
      await resolveAutoTriggeredDisagreementReview(
        existing.id,
        "Automatically closed because the current human underwriting call and guardrail are no longer in active disagreement.",
      );
    }

    return {
      assessment: {
        shouldTrigger: false,
        riskScore: 0,
        reason: null,
        factors: [],
      } satisfies HighRiskDisagreementAssessment,
      review: null,
    };
  }

  const openProofRequestCount = await prisma.proofRequest.count({
    where: {
      candidateId,
      status: {
        in: ["OPEN", "IN_PROGRESS"],
      },
    },
  });
  const safetyReport = buildCandidateSafetyReport({
    candidate: context.candidate,
    artifacts: context.candidate.artifacts,
    claims: context.candidate.evidenceClaims,
    recommendations: context.candidate.recommendations,
    readinessScore: context.audit.readinessScore,
    memo: context.candidate.sponsorMemo
      ? {
          executiveSummary: context.candidate.sponsorMemo.summary,
          whyWorthBacking: context.candidate.sponsorMemo.rationale,
          recommendedNextAction: context.candidate.sponsorMemo.recommendedAction,
        }
      : null,
    candidateUpdates: context.candidate.candidateUpdates,
    operatorNotes: context.candidate.candidateNotes,
  });
  const assessment = buildHighRiskDisagreementAssessment({
    audit: context.audit,
    safetyReport,
    openProofRequestCount,
  });

  if (!assessment.shouldTrigger) {
    if (existing?.autoTriggered) {
      await resolveAutoTriggeredDisagreementReview(
        existing.id,
        "Automatically closed because the disagreement no longer meets the current high-risk second-review threshold.",
      );
    }

    return {
      assessment,
      review: null,
    };
  }

  if (existing && !existing.autoTriggered) {
    return {
      assessment,
      review: existing,
    };
  }

  const autoReviewer = await pickAutoReviewer(organizationId, context.audit.humanDecidedById);
  const dueAt = existing?.dueAt
    ? existing.dueAt
    : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 2);
        date.setHours(23, 59, 0, 0);
        return date;
      })();

  const review = await upsertDisagreementReview({
    candidateId,
    organizationId,
    assignedUserId: existing?.assignedUserId ?? autoReviewer?.userId ?? null,
    dueAt,
    autoTriggered: true,
    riskScore: assessment.riskScore,
    triggerReason:
      assessment.reason ?? "High-risk underwriting disagreement requires second-review coverage.",
  });

  if (!review.operatorTask) {
    await createTaskFromDisagreementReview(review.id);
  }

  return {
    assessment,
    review,
  };
}

export async function createTaskFromDisagreementReview(reviewId: string) {
  const review = await prisma.disagreementReview.findUnique({
    where: { id: reviewId },
    include: {
      candidate: true,
      operatorTask: true,
    },
  });

  if (!review) {
    throw new Error("Disagreement review not found.");
  }

  if (review.operatorTask) {
    return review.operatorTask;
  }

  return prisma.operatorTask.create({
    data: {
      organizationId: review.candidate.organizationId,
      candidateId: review.candidateId,
      sourceDisagreementReviewId: review.id,
      ownerUserId: review.assignedUserId,
      title: `${review.candidate.fullName} · Second review on underwriting disagreement`,
      detail: `${review.summary}. Review whether the file should follow the current guardrail or the latest human underwriting call.`,
      priority: TaskPriority.HIGH,
      dueAt: review.dueAt,
      sourceLabel: "Created from reviewer disagreement",
    },
  });
}

export async function resolveDisagreementReview(input: {
  reviewId: string;
  reviewedById: string;
  resolutionType: DisagreementResolutionType;
  rationale: string;
}) {
  const review = await prisma.disagreementReview.findUnique({
    where: { id: input.reviewId },
    include: {
      operatorTask: true,
      candidate: true,
    },
  });

  if (!review) {
    throw new Error("Disagreement review not found.");
  }

  const nextStatus =
    input.resolutionType === DisagreementResolutionType.SECOND_REVIEW
      ? DisagreementReviewStatus.ESCALATED
      : DisagreementReviewStatus.RESOLVED;

  const updated = await prisma.disagreementReview.update({
    where: { id: input.reviewId },
    data: {
      reviewedById: input.reviewedById,
      resolutionType: input.resolutionType,
      rationale: input.rationale,
      status: nextStatus,
      resolvedAt: new Date(),
    },
    include: {
      operatorTask: true,
    },
  });

  if (input.resolutionType === DisagreementResolutionType.SECOND_REVIEW) {
    const task = updated.operatorTask ?? (await createTaskFromDisagreementReview(updated.id));

    await prisma.operatorTask.update({
      where: { id: task.id },
      data: {
        status: updated.assignedUserId ? TaskStatus.IN_PROGRESS : TaskStatus.OPEN,
      },
    });
  } else {
    let decisionType: DecisionType;

    if (input.resolutionType === DisagreementResolutionType.FOLLOW_SYSTEM) {
      decisionType = mapUnderwritingDecisionToDecisionType(fromPrismaUnderwritingDecision(updated.sourceSystemDecision));
    } else if (input.resolutionType === DisagreementResolutionType.UPHOLD_HUMAN) {
      decisionType = mapUnderwritingDecisionToDecisionType(fromPrismaUnderwritingDecision(updated.sourceHumanDecision));
    } else {
      decisionType = DecisionType.NEED_MORE_PROOF;
    }

    await prisma.candidateDecision.create({
      data: {
        candidateId: updated.candidateId,
        decidedById: input.reviewedById,
        decisionType,
        summary: buildResolutionSummary(input.resolutionType),
        rationale: input.rationale,
        stageAtDecision: review.candidate.currentStage,
      },
    });

    if (input.resolutionType === DisagreementResolutionType.REQUEST_MORE_PROOF) {
      const context = await getCurrentDecisionAudit(review.candidateId, review.candidate.organizationId);

      if (context) {
        const safetyReport = buildCandidateSafetyReport({
          candidate: context.candidate,
          artifacts: context.candidate.artifacts,
          claims: context.candidate.evidenceClaims,
          recommendations: context.candidate.recommendations,
          readinessScore: context.audit.readinessScore,
          memo: context.candidate.sponsorMemo
            ? {
                executiveSummary: context.candidate.sponsorMemo.summary,
                whyWorthBacking: context.candidate.sponsorMemo.rationale,
                recommendedNextAction: context.candidate.sponsorMemo.recommendedAction,
              }
            : null,
          candidateUpdates: context.candidate.candidateUpdates,
          operatorNotes: context.candidate.candidateNotes,
        });
        const suggestion = buildProofRequestSuggestions({
          missingProof: safetyReport.missingProof,
          potentialContradictions: safetyReport.potentialContradictions,
        })[0];
        const proofRequest = await createProofRequest({
          candidateId: updated.candidateId,
          requestedById: input.reviewedById,
          assignedUserId: updated.assignedUserId ?? null,
          dueAt: updated.dueAt ?? null,
          requestType: suggestion?.requestType ?? ProofRequestType.MISSING_PROOF,
          title: suggestion?.title ?? "Request stronger supporting proof",
          detail: suggestion?.detail ?? input.rationale,
          sourceDisagreementReviewId: updated.id,
        });

        if (updated.assignedUserId || updated.operatorTask) {
          await createTaskFromProofRequest(proofRequest.id);
        }
      }
    }

    if (updated.operatorTask) {
      await prisma.operatorTask.update({
        where: { id: updated.operatorTask.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }
  }

  await captureCandidateProgressSnapshot({
    candidateId: updated.candidateId,
    label: "Disagreement review updated",
    summary: `${DISAGREEMENT_RESOLUTION_LABELS[input.resolutionType]}. ${input.rationale}`,
  });

  return updated;
}
