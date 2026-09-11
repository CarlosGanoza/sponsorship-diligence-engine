import {
  AlertStatus,
  MemoStatus,
  PilotMetricSnapshotType,
  SponsorPipelineStage,
  TaskStatus,
  type CandidateDecision,
} from "@prisma/client";

import { buildDecisionAuditReport, createDecisionAuditRow } from "@/lib/audits/report";
import { deriveCandidateOutcomeRows } from "@/lib/calibration/report";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatPercent, formatSignedNumber } from "@/lib/utils/format";
import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";
import { getSafetySettings } from "@/lib/safety/settings";
import { computeSponsorReadiness } from "@/lib/scoring";

export type WorkspacePilotMetrics = {
  candidateCount: number;
  memoReadyCount: number;
  sponsorReadyCount: number;
  activePipelineCount: number;
  openAlertsCount: number;
  openTasksCount: number;
  knownOutcomeCount: number;
  positiveOutcomeCount: number;
  disagreementRate: number;
  blindReviewMode: boolean;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
};

export type PilotDeltaRow = {
  label: string;
  currentValueLabel: string;
  baselineValueLabel: string;
  deltaLabel: string;
  direction: "improved" | "declined" | "flat";
  detail: string;
};

function toDecisionRecords(
  decisions: Array<
    CandidateDecision & {
      decidedBy: {
        id: string;
        name: string;
      } | null;
    }
  >,
) {
  return decisions.map((decision) => ({
    id: decision.id,
    decisionType: decision.decisionType,
    summary: decision.summary,
    rationale: decision.rationale,
    createdAt: decision.createdAt,
    decidedBy: decision.decidedBy,
  }));
}

export async function buildCurrentPilotMetricsForOrganization(organizationId: string): Promise<WorkspacePilotMetrics> {
  const [candidates, edges, pipelineItems, activities, sponsorOutcomes, openAlertsCount, openTasksCount, safetySettings] = await Promise.all([
    prisma.candidate.findMany({
      where: {
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
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
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
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId,
        },
      },
      select: {
        candidateId: true,
        sponsorId: true,
        stage: true,
        outcomeNote: true,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId,
        },
      },
      select: {
        candidateId: true,
        sponsorId: true,
        activityType: true,
        status: true,
        detail: true,
      },
    }),
    prisma.sponsorOutcome.findMany({
      where: {
        organizationId,
      },
      select: {
        candidateId: true,
        verdict: true,
        detail: true,
        occurredAt: true,
      },
    }),
    prisma.operatorAlert.count({
      where: {
        candidate: {
          organizationId,
        },
        status: AlertStatus.OPEN,
      },
    }),
    prisma.operatorTask.count({
      where: {
        organizationId,
        status: {
          in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        },
      },
    }),
    getSafetySettings(),
  ]);

  const readinessRows = candidates.map((candidate) => ({
    candidate,
    readiness: computeSponsorReadiness(
      candidate,
      candidate.artifacts,
      candidate.evidenceClaims,
      edges.filter((edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id),
    ),
  }));

  const auditRows = readinessRows.map(({ candidate, readiness }) => {
    const claimReview = summarizeReviewStatuses(candidate.evidenceClaims.map((claim) => claim.reviewStatus));
    const recommendationReview = summarizeReviewStatuses(
      candidate.recommendations.map((recommendation) => recommendation.reviewStatus),
    );
    const reviewSummary = combineReviewSummaries([claimReview, recommendationReview]);

    return createDecisionAuditRow({
      candidate,
      displayName: candidate.fullName,
      displayHeadline: candidate.headline,
      displayRegion: candidate.region,
      artifacts: candidate.artifacts,
      claims: candidate.evidenceClaims,
      recommendations: candidate.recommendations,
      candidateDecisions: toDecisionRecords(candidate.candidateDecisions),
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
    });
  });

  const auditSummary = buildDecisionAuditReport(auditRows).summary;
  const outcomes = deriveCandidateOutcomeRows({
    candidateIds: candidates.map((candidate) => candidate.id),
    activities,
    pipelineItems,
    structuredOutcomes: sponsorOutcomes,
  });

  return {
    candidateCount: candidates.length,
    memoReadyCount: candidates.filter((candidate) => candidate.sponsorMemo?.status === MemoStatus.READY).length,
    sponsorReadyCount: readinessRows.filter((row) => row.readiness.score >= 70).length,
    activePipelineCount: pipelineItems.filter(
      (item) => item.stage !== SponsorPipelineStage.PASSED && item.stage !== SponsorPipelineStage.CLOSED,
    ).length,
    openAlertsCount,
    openTasksCount,
    knownOutcomeCount: outcomes.filter((row) => row.verdict === "positive" || row.verdict === "negative").length,
    positiveOutcomeCount: outcomes.filter((row) => row.verdict === "positive").length,
    disagreementRate: auditSummary.disagreementRate,
    blindReviewMode: safetySettings.blindReviewMode,
    strictEvidenceMode: safetySettings.strictEvidenceMode,
    requireOutboundApproval: safetySettings.requireOutboundApproval,
  };
}

function buildCoveragePercent(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

function formatMinutes(value: number) {
  return `${value} min`;
}

function buildDirectionalDelta(
  currentValue: number,
  baselineValue: number,
  lowerIsBetter = false,
): "improved" | "declined" | "flat" {
  if (currentValue === baselineValue) {
    return "flat";
  }

  if (lowerIsBetter) {
    return currentValue < baselineValue ? "improved" : "declined";
  }

  return currentValue > baselineValue ? "improved" : "declined";
}

export function buildPilotObservedDeltaRows(input: {
  baseline: Pick<
    WorkspacePilotMetrics,
    | "candidateCount"
    | "memoReadyCount"
    | "sponsorReadyCount"
    | "openAlertsCount"
    | "openTasksCount"
    | "knownOutcomeCount"
    | "disagreementRate"
  >;
  current: WorkspacePilotMetrics;
}) {
  const baselineWorkflowPressure = input.baseline.openAlertsCount + input.baseline.openTasksCount;
  const currentWorkflowPressure = input.current.openAlertsCount + input.current.openTasksCount;
  const baselineMemoCoverage = buildCoveragePercent(input.baseline.memoReadyCount, input.baseline.candidateCount);
  const currentMemoCoverage = buildCoveragePercent(input.current.memoReadyCount, input.current.candidateCount);
  const baselineSponsorReadyCoverage = buildCoveragePercent(
    input.baseline.sponsorReadyCount,
    input.baseline.candidateCount,
  );
  const currentSponsorReadyCoverage = buildCoveragePercent(
    input.current.sponsorReadyCount,
    input.current.candidateCount,
  );

  return [
    {
      label: "Memo coverage",
      currentValueLabel: formatPercent(currentMemoCoverage),
      baselineValueLabel: formatPercent(baselineMemoCoverage),
      deltaLabel: formatSignedNumber(currentMemoCoverage - baselineMemoCoverage),
      direction: buildDirectionalDelta(currentMemoCoverage, baselineMemoCoverage),
      detail: "Measured share of the slate with a ready sponsor memo.",
    },
    {
      label: "Sponsor-ready coverage",
      currentValueLabel: formatPercent(currentSponsorReadyCoverage),
      baselineValueLabel: formatPercent(baselineSponsorReadyCoverage),
      deltaLabel: formatSignedNumber(currentSponsorReadyCoverage - baselineSponsorReadyCoverage),
      direction: buildDirectionalDelta(currentSponsorReadyCoverage, baselineSponsorReadyCoverage),
      detail: "Measured share of the slate strong enough to sit in the sponsor-ready queue.",
    },
    {
      label: "Known outcomes",
      currentValueLabel: String(input.current.knownOutcomeCount),
      baselineValueLabel: String(input.baseline.knownOutcomeCount),
      deltaLabel: formatSignedNumber(input.current.knownOutcomeCount - input.baseline.knownOutcomeCount),
      direction: buildDirectionalDelta(input.current.knownOutcomeCount, input.baseline.knownOutcomeCount),
      detail: "Measured sponsor paths with a positive or negative outcome recorded.",
    },
    {
      label: "Workflow pressure",
      currentValueLabel: String(currentWorkflowPressure),
      baselineValueLabel: String(baselineWorkflowPressure),
      deltaLabel: formatSignedNumber(currentWorkflowPressure - baselineWorkflowPressure),
      direction: buildDirectionalDelta(currentWorkflowPressure, baselineWorkflowPressure, true),
      detail: "Open alerts plus open tasks. Lower is better if throughput is holding.",
    },
    {
      label: "Disagreement rate",
      currentValueLabel: formatPercent(input.current.disagreementRate),
      baselineValueLabel: formatPercent(input.baseline.disagreementRate),
      deltaLabel: formatSignedNumber(input.current.disagreementRate - input.baseline.disagreementRate),
      direction: buildDirectionalDelta(input.current.disagreementRate, input.baseline.disagreementRate, true),
      detail: "Measured human versus guardrail disagreement across files with a logged underwriting decision.",
    },
  ] satisfies PilotDeltaRow[];
}

export async function capturePilotMetricSnapshot(input: {
  organizationId: string;
  capturedById?: string | null;
  snapshotType: PilotMetricSnapshotType;
  averageReviewMinutes?: number | null;
  sampledReviewCount?: number | null;
}) {
  const metrics = await buildCurrentPilotMetricsForOrganization(input.organizationId);
  const now = new Date();

  if (input.snapshotType === PilotMetricSnapshotType.BASELINE) {
    const existingBaseline = await prisma.pilotMetricSnapshot.findFirst({
      where: {
        organizationId: input.organizationId,
        snapshotType: PilotMetricSnapshotType.BASELINE,
      },
      orderBy: {
        capturedAt: "desc",
      },
    });

    if (existingBaseline) {
      return prisma.pilotMetricSnapshot.update({
        where: {
          id: existingBaseline.id,
        },
        data: {
          title: "Pilot baseline",
          note: "Re-captured from the current workspace state.",
          capturedById: input.capturedById ?? null,
          capturedAt: now,
          averageReviewMinutes: input.averageReviewMinutes ?? null,
          sampledReviewCount: input.sampledReviewCount ?? null,
          ...metrics,
        },
      });
    }
  }

  return prisma.pilotMetricSnapshot.create({
    data: {
      organizationId: input.organizationId,
      capturedById: input.capturedById ?? null,
      snapshotType: input.snapshotType,
      title: input.snapshotType === PilotMetricSnapshotType.BASELINE ? "Pilot baseline" : "Pilot checkpoint",
      note:
        input.snapshotType === PilotMetricSnapshotType.BASELINE
          ? "Captured as the measured starting point for this pilot."
          : "Captured from the current live workspace state.",
      capturedAt: now,
      averageReviewMinutes: input.averageReviewMinutes ?? null,
      sampledReviewCount: input.sampledReviewCount ?? null,
      ...metrics,
    },
  });
}

export function formatPilotSnapshot(snapshot: {
  id: string;
  title: string;
  note: string | null;
  snapshotType: PilotMetricSnapshotType;
  candidateCount: number;
  memoReadyCount: number;
  sponsorReadyCount: number;
  activePipelineCount: number;
  openAlertsCount: number;
  openTasksCount: number;
  knownOutcomeCount: number;
  positiveOutcomeCount: number;
  disagreementRate: number;
  averageReviewMinutes: number | null;
  sampledReviewCount: number | null;
  blindReviewMode: boolean;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
  capturedAt: Date;
  capturedBy: { name: string } | null;
}) {
  return {
    ...snapshot,
    capturedAtLabel: formatDate(snapshot.capturedAt),
    authorLabel: snapshot.capturedBy?.name ?? "System",
    workflowPressure: snapshot.openAlertsCount + snapshot.openTasksCount,
    memoCoverage: buildCoveragePercent(snapshot.memoReadyCount, snapshot.candidateCount),
    sponsorReadyCoverage: buildCoveragePercent(snapshot.sponsorReadyCount, snapshot.candidateCount),
  };
}

export function buildMeasuredReviewTimeDeltaRow(input: {
  baseline: { averageReviewMinutes: number | null; sampledReviewCount: number | null };
  checkpoint: { averageReviewMinutes: number | null; sampledReviewCount: number | null } | null;
}) {
  if (!input.checkpoint?.averageReviewMinutes || !input.baseline.averageReviewMinutes) {
    return null;
  }

  const baselineValue = input.baseline.averageReviewMinutes;
  const currentValue = input.checkpoint.averageReviewMinutes;

  return {
    label: "Measured review time",
    currentValueLabel: formatMinutes(currentValue),
    baselineValueLabel: formatMinutes(baselineValue),
    deltaLabel: formatSignedNumber(currentValue - baselineValue),
    direction: buildDirectionalDelta(currentValue, baselineValue, true),
    detail: `Operator-entered average review minutes across ${input.checkpoint.sampledReviewCount ?? 0} sampled files, compared against ${input.baseline.sampledReviewCount ?? 0} files at baseline.`,
  } satisfies PilotDeltaRow;
}
