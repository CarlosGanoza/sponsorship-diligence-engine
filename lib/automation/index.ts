import {
  AutomationMode,
  AlertSeverity,
  AlertStatus,
  BriefStatus,
  CandidateStage,
  CrmSyncStatus,
  MemoStatus,
  OperatorAlertType,
  RecommendationType,
  StageEventType,
  type OperatorAlert,
} from "@prisma/client";

import { ensureHighRiskDisagreementReview } from "@/lib/audits/workflow";
import { prisma } from "@/lib/db/prisma";
import { buildCandidateTrajectory, captureCandidateProgressSnapshot } from "@/lib/progress";
import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";
import { computeSponsorReadiness } from "@/lib/scoring";
import { DEFAULT_AUTOMATION_POLICY, getAutomationPolicy, type AutomationPolicy } from "@/lib/automation/policy";

type ManagedAlert = {
  alertType: OperatorAlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  sourceLabel: string;
};

function formatStage(stage: CandidateStage) {
  return stage.replaceAll("_", " ").toLowerCase();
}

export function computeAutomationDecision(input: {
  artifactsCount: number;
  claimsCount: number;
  readinessScore: number;
  reviewFlagged: number;
  hasPriorSnapshot: boolean;
  trajectoryMomentum: ReturnType<typeof buildCandidateTrajectory>["momentum"];
  trajectoryDelta: number;
  latestArtifactCount: number;
  previousArtifactCount: number;
  latestClaimCount: number;
  previousClaimCount: number;
  hasReadyMemo: boolean;
  hasReadyBrief: boolean;
  topSponsorMatchScore: number;
  hasActiveSponsorPath: boolean;
}, policy: AutomationPolicy = DEFAULT_AUTOMATION_POLICY) {
  const hasEvidenceBase =
    input.artifactsCount >= policy.minArtifactsForReview &&
    input.claimsCount >= policy.minClaimsForReview;
  const stalledEvidence =
    input.latestArtifactCount === input.previousArtifactCount &&
    input.latestClaimCount === input.previousClaimCount;
  const stalledTrajectory =
    input.hasPriorSnapshot && input.trajectoryDelta <= policy.stalledDeltaMax && stalledEvidence;

  if (
    input.hasReadyBrief &&
    input.topSponsorMatchScore >= policy.outreachMatchMin &&
    input.hasActiveSponsorPath &&
    input.readinessScore >= policy.outreachReadinessMin
  ) {
    return {
      stage: CandidateStage.SPONSOR_OUTREACH,
      reason:
        "Strong readiness, a credible sponsor match, and a live sponsor path justify moving this file into sponsor outreach.",
      stalledTrajectory,
    };
  }

  if (
    (input.reviewFlagged > 0 && stalledTrajectory) ||
    (input.trajectoryMomentum === "needs_attention" && input.readinessScore < policy.holdReadinessMax)
  ) {
    return {
      stage: CandidateStage.HOLD,
      reason:
        "Flagged review items and a flat trajectory indicate the case should pause until stronger proof is added.",
      stalledTrajectory,
    };
  }

  if (input.hasReadyMemo && input.readinessScore >= policy.memoReadinessMin) {
    return {
      stage: CandidateStage.MEMO_READY,
      reason:
        "The file has enough evidence depth and memo support to move into sponsor-ready packaging.",
      stalledTrajectory,
    };
  }

  if (!hasEvidenceBase || input.readinessScore < policy.intakeReadinessMax) {
    return {
      stage: CandidateStage.INTAKE,
      reason:
        "The file still lacks enough evidence volume or signal depth to leave intake.",
      stalledTrajectory,
    };
  }

  return {
    stage: CandidateStage.REVIEW,
    reason:
      "The file is substantive enough for operator review, but not yet strong enough for sponsor-ready packaging.",
    stalledTrajectory,
  };
}

async function syncManagedAlerts(candidateId: string, desiredAlerts: ManagedAlert[]) {
  const managedTypes = [
    OperatorAlertType.MOMENTUM_SURGE,
    OperatorAlertType.TRAJECTORY_STALLED,
    OperatorAlertType.OUTREACH_READY,
    OperatorAlertType.REVIEW_BLOCKER,
    OperatorAlertType.MANUAL_OVERRIDE,
  ];
  const existingAlerts = await prisma.operatorAlert.findMany({
    where: {
      candidateId,
      status: AlertStatus.OPEN,
      alertType: {
        in: managedTypes,
      },
    },
  });

  for (const existingAlert of existingAlerts) {
    const desired = desiredAlerts.find(
      (alert) =>
        alert.alertType === existingAlert.alertType &&
        alert.title === existingAlert.title,
    );

    if (!desired) {
      await prisma.operatorAlert.update({
        where: { id: existingAlert.id },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
      continue;
    }

    await prisma.operatorAlert.update({
      where: { id: existingAlert.id },
      data: {
        severity: desired.severity,
        detail: desired.detail,
        sourceLabel: desired.sourceLabel,
      },
    });
  }

  for (const desiredAlert of desiredAlerts) {
    const existing = existingAlerts.find(
      (alert) =>
        alert.alertType === desiredAlert.alertType &&
        alert.title === desiredAlert.title,
    );

    if (existing) {
      continue;
    }

    await prisma.operatorAlert.create({
      data: {
        candidateId,
        ...desiredAlert,
      },
    });
  }
}

async function recordStageEvent({
  candidateId,
  eventType,
  fromStage,
  toStage,
  rationale,
  actorLabel,
}: {
  candidateId: string;
  eventType: StageEventType;
  fromStage?: CandidateStage | null;
  toStage?: CandidateStage | null;
  rationale: string;
  actorLabel?: string | null;
}) {
  await prisma.candidateStageEvent.create({
    data: {
      candidateId,
      eventType,
      fromStage: fromStage ?? null,
      toStage: toStage ?? null,
      rationale,
      actorLabel: actorLabel?.trim() || null,
    },
  });
}

async function createStageChangeAlert({
  candidateId,
  fromStage,
  toStage,
  reason,
}: {
  candidateId: string;
  fromStage: CandidateStage;
  toStage: CandidateStage;
  reason: string;
}) {
  await prisma.operatorAlert.updateMany({
    where: {
      candidateId,
      alertType: OperatorAlertType.STAGE_CHANGED,
      status: AlertStatus.OPEN,
    },
    data: {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date(),
    },
  });

  await prisma.operatorAlert.create({
    data: {
      candidateId,
      alertType: OperatorAlertType.STAGE_CHANGED,
      severity:
        toStage === CandidateStage.SPONSOR_OUTREACH || toStage === CandidateStage.MEMO_READY
          ? AlertSeverity.ACTION
          : toStage === CandidateStage.HOLD || toStage === CandidateStage.INTAKE
            ? AlertSeverity.CAUTION
            : AlertSeverity.INFO,
      title: `Stage updated to ${formatStage(toStage)}`,
      detail: `${reason} Previous stage: ${formatStage(fromStage)}.`,
      sourceLabel: "Stage automation",
    },
  });
}

export async function evaluateCandidateAutomation(candidateId: string) {
  const policy = await getAutomationPolicy();
  const [candidate, edges] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        artifacts: true,
        evidenceClaims: true,
        sponsorMemo: true,
        recommendations: {
          select: {
            recommendationType: true,
            reviewStatus: true,
            score: true,
          },
        },
        opportunityBriefs: {
          select: {
            status: true,
          },
        },
        crmSyncRecords: {
          select: {
            status: true,
          },
        },
        sponsorActivities: {
          select: {
            activityType: true,
            status: true,
          },
        },
        progressSnapshots: {
          orderBy: {
            capturedAt: "asc",
          },
        },
        operatorAlerts: {
          where: {
            status: AlertStatus.OPEN,
          },
        },
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        OR: [{ fromEntityId: candidateId }, { toEntityId: candidateId }],
      },
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
  const trajectory = buildCandidateTrajectory(candidate.progressSnapshots);
  const previousSnapshot = trajectory.previous ?? trajectory.latest;
  const latestSnapshot = trajectory.latest;
  const topSponsorMatchScore = Math.round(
    Math.max(
      0,
      ...candidate.recommendations
        .filter((recommendation) => recommendation.recommendationType === RecommendationType.BEST_SPONSOR)
        .map((recommendation) => recommendation.score),
    ),
  );
  const hasReadyMemo = candidate.sponsorMemo?.status === MemoStatus.READY;
  const hasReadyBrief = candidate.opportunityBriefs.some((brief) => brief.status === BriefStatus.READY);
  const hasActiveSponsorPath =
    candidate.crmSyncRecords.some((sync) =>
      sync.status === CrmSyncStatus.SYNCED || sync.status === CrmSyncStatus.FALLBACK,
    ) ||
    candidate.sponsorActivities.some((activity) => activity.status !== "BLOCKED");
  const decision = computeAutomationDecision({
    artifactsCount: candidate.artifacts.length,
    claimsCount: candidate.evidenceClaims.length,
    readinessScore: readiness.score,
    reviewFlagged: reviewSummary.flagged,
    hasPriorSnapshot: Boolean(trajectory.previous),
    trajectoryMomentum: trajectory.momentum,
    trajectoryDelta: trajectory.deltaFromPrevious,
    latestArtifactCount: latestSnapshot?.artifactCount ?? candidate.artifacts.length,
    previousArtifactCount: previousSnapshot?.artifactCount ?? candidate.artifacts.length,
    latestClaimCount: latestSnapshot?.evidenceClaimCount ?? candidate.evidenceClaims.length,
    previousClaimCount: previousSnapshot?.evidenceClaimCount ?? candidate.evidenceClaims.length,
    hasReadyMemo,
    hasReadyBrief,
    topSponsorMatchScore,
    hasActiveSponsorPath,
  }, policy);

  const desiredAlerts: ManagedAlert[] = [];
  const stageChanged =
    candidate.automationMode !== AutomationMode.MANUAL_OVERRIDE &&
    candidate.currentStage !== decision.stage;
  const effectiveStage =
    candidate.automationMode === AutomationMode.MANUAL_OVERRIDE
      ? candidate.currentStage
      : decision.stage;

  if (trajectory.deltaFromPrevious >= policy.momentumSurgeDeltaMin && readiness.score >= 55) {
    desiredAlerts.push({
      alertType: OperatorAlertType.MOMENTUM_SURGE,
      severity: AlertSeverity.INFO,
      title: "Conviction increased materially",
      detail:
        "Recent trajectory movement indicates the sponsorship case strengthened quickly and is worth a fresh operator read.",
      sourceLabel: "Trajectory automation",
    });
  }

  if (reviewSummary.flagged > 0) {
    desiredAlerts.push({
      alertType: OperatorAlertType.REVIEW_BLOCKER,
      severity: AlertSeverity.CAUTION,
      title: "Review blocker is holding the file",
      detail:
        "One or more flagged review items are still limiting confidence in the current sponsorship case.",
      sourceLabel: "Review automation",
    });
  }

  if (decision.stalledTrajectory && decision.stage !== CandidateStage.SPONSOR_OUTREACH) {
    desiredAlerts.push({
      alertType: OperatorAlertType.TRAJECTORY_STALLED,
      severity: AlertSeverity.CAUTION,
      title: "Trajectory has flattened",
      detail:
        "The file is not gaining evidence or signal depth across the latest snapshot window. Consider adding stronger proof before further outreach.",
      sourceLabel: "Trajectory automation",
    });
  }

  if (
    decision.stage === CandidateStage.SPONSOR_OUTREACH &&
    !candidate.crmSyncRecords.some((sync) => sync.status === CrmSyncStatus.SYNCED)
  ) {
    desiredAlerts.push({
      alertType: OperatorAlertType.OUTREACH_READY,
      severity: AlertSeverity.ACTION,
      title: "Ready for sponsor outreach",
      detail:
        "The file meets the current sponsor-outreach threshold. Prepare the warm introduction or sync the brief into the CRM outbox.",
      sourceLabel: "Stage automation",
    });
  }

  if (candidate.automationMode === AutomationMode.MANUAL_OVERRIDE) {
    desiredAlerts.push({
      alertType: OperatorAlertType.MANUAL_OVERRIDE,
      severity: AlertSeverity.CAUTION,
      title: "Manual stage override is active",
      detail:
        candidate.automationNote ??
        "Automation is paused for this file until an operator resumes it.",
      sourceLabel: "Manual stage override",
    });
  }

  if (stageChanged) {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        currentStage: decision.stage,
        automationMode: AutomationMode.AUTOMATED,
        automationNote: decision.reason,
        automationUpdatedAt: new Date(),
        sponsorReadinessScore: readiness.score,
      },
    });

    await recordStageEvent({
      candidateId,
      eventType: StageEventType.AUTOMATION_CHANGE,
      fromStage: candidate.currentStage,
      toStage: decision.stage,
      rationale: decision.reason,
      actorLabel: "Stage automation",
    });

    await captureCandidateProgressSnapshot({
      candidateId,
      label: `Stage updated to ${formatStage(decision.stage)}`,
      summary: decision.reason,
    });

    await createStageChangeAlert({
      candidateId,
      fromStage: candidate.currentStage,
      toStage: decision.stage,
      reason: decision.reason,
    });
  } else {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        automationUpdatedAt: new Date(),
        sponsorReadinessScore: readiness.score,
      },
    });
  }

  await syncManagedAlerts(candidateId, desiredAlerts);
  await ensureHighRiskDisagreementReview(candidateId, candidate.organizationId);

  return {
    previousStage: candidate.currentStage,
    currentStage: effectiveStage,
    stageChanged,
    alertsCount: desiredAlerts.length + (stageChanged ? 1 : 0),
    reason: decision.reason,
  };
}

export async function applyManualStageOverride({
  candidateId,
  stage,
  rationale,
  actorLabel,
}: {
  candidateId: string;
  stage: CandidateStage;
  rationale: string;
  actorLabel?: string;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      currentStage: true,
    },
  });

  if (!candidate) {
    return null;
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      currentStage: stage,
      automationMode: AutomationMode.MANUAL_OVERRIDE,
      automationNote: rationale,
      automationUpdatedAt: new Date(),
    },
  });

  await recordStageEvent({
    candidateId,
    eventType: StageEventType.MANUAL_OVERRIDE,
    fromStage: candidate.currentStage,
    toStage: stage,
    rationale,
    actorLabel,
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: `Manual override to ${formatStage(stage)}`,
    summary: rationale,
  });

  await evaluateCandidateAutomation(candidateId);

  return {
    previousStage: candidate.currentStage,
    currentStage: stage,
  };
}

export async function resumeCandidateAutomation({
  candidateId,
  rationale,
  actorLabel,
}: {
  candidateId: string;
  rationale: string;
  actorLabel?: string;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      currentStage: true,
    },
  });

  if (!candidate) {
    return null;
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      automationMode: AutomationMode.AUTOMATED,
      automationNote: rationale,
      automationUpdatedAt: new Date(),
    },
  });

  await recordStageEvent({
    candidateId,
    eventType: StageEventType.AUTOMATION_RESUMED,
    fromStage: candidate.currentStage,
    toStage: candidate.currentStage,
    rationale,
    actorLabel,
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "Automation resumed",
    summary: rationale,
  });

  return evaluateCandidateAutomation(candidateId);
}

export async function resolveOperatorAlert(
  alertId: string,
  options?: {
    resolvedById?: string;
    resolutionNote?: string;
  },
) {
  const alert = await prisma.operatorAlert.findUnique({
    where: { id: alertId },
    select: {
      candidateId: true,
    },
  });

  if (!alert) {
    return null;
  }

  await prisma.operatorAlert.update({
    where: { id: alertId },
    data: {
      status: AlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedById: options?.resolvedById ?? null,
      resolutionNote: options?.resolutionNote?.trim() || null,
    },
  });

  return alert;
}

export function mapAlertSeverityToVariant(
  severity: OperatorAlert["severity"],
) {
  if (severity === AlertSeverity.ACTION) {
    return "sage";
  }

  if (severity === AlertSeverity.CAUTION) {
    return "danger";
  }

  return "muted";
}
