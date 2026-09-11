import type { CommercialReadinessModel } from "@/lib/pilot/commercial";
import type { PilotDeltaRow, WorkspacePilotMetrics } from "@/lib/pilot/measurements";
import type { PilotTemplateDefinition } from "@/lib/pilot/templates";
import type { PilotProfile, PilotLaunchWorkstream } from "@/lib/pilot/workspace";
import type { ReviewerCalibrationWorkspace } from "@/lib/calibration/workspace";
import { formatDate } from "@/lib/utils/format";

type PilotSnapshotLike = {
  snapshotType: string;
  capturedAtLabel: string;
  authorLabel: string;
  note: string | null;
  averageReviewMinutes: number | null;
  sampledReviewCount: number | null;
  memoCoverage: number;
  sponsorReadyCoverage: number;
  workflowPressure: number;
};

type PilotRoiModelLike = {
  modeled: {
    monthlyHoursRecovered: number;
    monthlyLaborValue: number;
    controlCoverage: number;
    memoCoverage: number;
    sponsorReadyCoverage: number;
    knownOutcomeCoverage: number;
    positiveOutcomeRate: number;
    workflowPressure: number;
  };
  assumptions: string[];
};

export type PilotProofCriterion = {
  label: string;
  status: "ready" | "watch" | "blocked";
  detail: string;
};

export type PilotProofReport = {
  title: string;
  generatedAtLabel: string;
  recommendationLabel: string;
  recommendationDetail: string;
  stageLabel: string;
  summary: string;
  observedProof: string[];
  modeledAssumptions: string[];
  currentSnapshot: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  goNoGoCriteria: PilotProofCriterion[];
  measuredPilot: {
    hasBaseline: boolean;
    baselineLabel: string | null;
    latestCheckpointLabel: string | null;
    checkpointCount: number;
    note: string;
    deltaRows: PilotDeltaRow[];
  };
  calibration: {
    statusLabel: string;
    blockers: string[];
    openCount: number;
    escalatedCount: number;
    readyCount: number;
    highRiskReviewers: Array<{
      reviewerName: string;
      calibrationStatus: string;
      disagreementRate: number;
      knownOutcomeCount: number;
      recommendation: string;
    }>;
  };
  risks: string[];
  nextMoves: string[];
  buyerPressureTest: Array<{
    objection: string;
    response: string;
    proofPoint: string;
  }>;
  successMetrics: string[];
};

function buildRecommendation(input: {
  commercialReadiness: CommercialReadinessModel;
  hasMeasuredBaseline: boolean;
  knownOutcomeCount: number;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
  calibrationEscalatedCount: number;
  healthStatus: "healthy" | "degraded" | "unhealthy";
}) {
  const controlsReady = input.strictEvidenceMode && input.requireOutboundApproval;

  if (
    input.commercialReadiness.score >= 70 &&
    input.hasMeasuredBaseline &&
    input.knownOutcomeCount >= 2 &&
    controlsReady &&
    input.calibrationEscalatedCount === 0 &&
    input.healthStatus === "healthy"
  ) {
    return {
      label: "Ready for a contained design-partner pilot",
      detail:
        "The workspace has enough observed proof, control posture, and operating discipline to support a serious pilot conversation without overstating what is proven.",
    };
  }

  if (input.commercialReadiness.score >= 45 && controlsReady) {
    return {
      label: "Pilot proof is building, but still needs evidence",
      detail:
        "Use the workspace as a proof-building pilot narrative. Lead with observed workflow discipline and measured movement, then state clearly what still needs to be earned.",
    };
  }

  return {
    label: "Not ready for an external pilot motion yet",
    detail:
      "The workspace can still support an internal evaluation, but it does not yet have enough measured proof or control discipline for a strong external design-partner ask.",
  };
}

function buildCriterionStatus(ready: boolean, watchDetail: boolean) {
  if (ready) {
    return "ready" as const;
  }

  return watchDetail ? ("watch" as const) : ("blocked" as const);
}

function dedupeLines(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function buildPilotProofReport(input: {
  template: PilotTemplateDefinition;
  pilotProfile: PilotProfile;
  launchWorkstream: PilotLaunchWorkstream;
  currentMetrics: WorkspacePilotMetrics;
  baseline: PilotSnapshotLike | null;
  latestCheckpoint: PilotSnapshotLike | null;
  recentSnapshots: PilotSnapshotLike[];
  observedDeltas: PilotDeltaRow[];
  roiModel: PilotRoiModelLike;
  commercialReadiness: CommercialReadinessModel;
  calibrationWorkspace: ReviewerCalibrationWorkspace;
  healthStatus: "healthy" | "degraded" | "unhealthy";
  generatedAt?: Date;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  const checkpointCount = input.recentSnapshots.filter((snapshot) => snapshot.snapshotType === "CHECKPOINT").length;
  const recommendation = buildRecommendation({
    commercialReadiness: input.commercialReadiness,
    hasMeasuredBaseline: Boolean(input.baseline),
    knownOutcomeCount: input.currentMetrics.knownOutcomeCount,
    strictEvidenceMode: input.currentMetrics.strictEvidenceMode,
    requireOutboundApproval: input.currentMetrics.requireOutboundApproval,
    calibrationEscalatedCount: input.calibrationWorkspace.summary.escalatedCount,
    healthStatus: input.healthStatus,
  });

  const goNoGoCriteria: PilotProofCriterion[] = [
    {
      label: "Measured baseline on file",
      status: buildCriterionStatus(Boolean(input.baseline), false),
      detail: input.baseline
        ? `Baseline captured ${input.baseline.capturedAtLabel} by ${input.baseline.authorLabel}.`
        : "Capture a baseline before presenting the product as anything more than a modeled workflow story.",
    },
    {
      label: "Sponsor-ready anchor files",
      status: buildCriterionStatus(input.currentMetrics.sponsorReadyCount >= 2, input.currentMetrics.sponsorReadyCount >= 1),
      detail:
        input.currentMetrics.sponsorReadyCount >= 2
          ? `${input.currentMetrics.sponsorReadyCount} files are already strong enough to anchor a serious buyer walkthrough.`
          : input.currentMetrics.sponsorReadyCount === 1
            ? "One sponsor-ready file exists, but the buyer story is still too dependent on a single example."
            : "No sponsor-ready anchor files are available yet.",
    },
    {
      label: "Known outcome proof",
      status: buildCriterionStatus(input.currentMetrics.knownOutcomeCount >= 2, input.currentMetrics.knownOutcomeCount >= 1),
      detail:
        input.currentMetrics.knownOutcomeCount >= 2
          ? `${input.currentMetrics.knownOutcomeCount} sponsor outcomes are already recorded in the workspace.`
          : input.currentMetrics.knownOutcomeCount === 1
            ? "One sponsor outcome is recorded, but more real result proof is still needed."
            : "No sponsor outcome proof is on record yet.",
    },
    {
      label: "Control posture",
      status: buildCriterionStatus(
        input.currentMetrics.strictEvidenceMode && input.currentMetrics.requireOutboundApproval,
        input.currentMetrics.strictEvidenceMode || input.currentMetrics.requireOutboundApproval,
      ),
      detail:
        input.currentMetrics.strictEvidenceMode && input.currentMetrics.requireOutboundApproval
          ? "Strict evidence and outbound approval are both active."
          : "Core evidence and outbound controls are not both visibly active yet.",
    },
    {
      label: "Launch readiness",
      status: buildCriterionStatus(
        input.launchWorkstream.summary.readyCount === input.launchWorkstream.summary.total && input.launchWorkstream.summary.total > 0,
        input.launchWorkstream.summary.readyCount > 0 || input.launchWorkstream.summary.inProgressCount > 0,
      ),
      detail: `${input.launchWorkstream.summary.readyCount}/${input.launchWorkstream.summary.total} launch items are ready. ${input.launchWorkstream.summary.statusLabel}.`,
    },
    {
      label: "Calibration posture",
      status: buildCriterionStatus(
        input.calibrationWorkspace.summary.escalatedCount === 0,
        input.calibrationWorkspace.summary.inProgressCount > 0 || input.calibrationWorkspace.summary.notStartedCount > 0,
      ),
      detail:
        input.calibrationWorkspace.summary.escalatedCount === 0
          ? "No escalated reviewer calibration items are currently open."
          : `${input.calibrationWorkspace.summary.escalatedCount} escalated reviewer calibration items still need resolution before relying on the pilot as a buyer proof point.`,
    },
  ];

  const observedProof = dedupeLines([
    `${input.currentMetrics.candidateCount} live candidate files are already in the workspace.`,
    `${input.currentMetrics.memoReadyCount} files have ready sponsor memos and ${input.currentMetrics.sponsorReadyCount} currently sit above the sponsor-ready threshold.`,
    `${input.currentMetrics.knownOutcomeCount} sponsor outcomes are already logged, with ${input.currentMetrics.positiveOutcomeCount} positive outcomes on record.`,
    input.baseline
      ? `A measured baseline is on file${input.latestCheckpoint ? ` and the latest checkpoint was captured ${input.latestCheckpoint.capturedAtLabel}.` : "."}`
      : "No measured baseline is on file yet.",
    `${input.calibrationWorkspace.summary.readyCount} reviewer calibration items are ready, while ${input.calibrationWorkspace.summary.escalatedCount} remain escalated.`,
    `Current commercial readiness is ${input.commercialReadiness.score}/100: ${input.commercialReadiness.stageLabel}.`,
  ]);

  const risks = dedupeLines([
    ...input.commercialReadiness.gaps,
    ...input.launchWorkstream.summary.blockers,
    ...input.calibrationWorkspace.summary.blockers,
    ...(input.healthStatus === "healthy" ? [] : [`Runtime health is currently ${input.healthStatus}, which weakens buyer confidence.`]),
  ]);

  const nextMoves = dedupeLines([
    ...input.commercialReadiness.nextMoves,
    ...input.template.commercialMilestones.map((milestone) => `${milestone.title}: ${milestone.detail}`),
    ...input.launchWorkstream.summary.blockers.slice(0, 2).map((blocker) => `Close launch blocker: ${blocker}`),
  ]).slice(0, 8);

  return {
    title: `${input.pilotProfile.pilotName} proof report`,
    generatedAtLabel: formatDate(generatedAt),
    recommendationLabel: recommendation.label,
    recommendationDetail: recommendation.detail,
    stageLabel: input.commercialReadiness.stageLabel,
    summary: input.pilotProfile.packSummary,
    observedProof,
    modeledAssumptions: input.roiModel.assumptions,
    currentSnapshot: [
      {
        label: "Commercial readiness",
        value: `${input.commercialReadiness.score}/100`,
        detail: input.commercialReadiness.stageLabel,
      },
      {
        label: "Sponsor-ready files",
        value: String(input.currentMetrics.sponsorReadyCount),
        detail: "Files currently above the sponsor-readiness threshold.",
      },
      {
        label: "Known outcomes",
        value: String(input.currentMetrics.knownOutcomeCount),
        detail: "Positive or negative sponsor outcomes already captured.",
      },
      {
        label: "Measured checkpoints",
        value: String(checkpointCount),
        detail: input.baseline ? "Checkpoints captured after the measured baseline." : "Checkpoints without a durable baseline still need context.",
      },
      {
        label: "Modeled hours recovered",
        value: String(input.roiModel.modeled.monthlyHoursRecovered),
        detail: "Planning number derived from the active slate and template assumptions.",
      },
      {
        label: "Control coverage",
        value: `${input.roiModel.modeled.controlCoverage}%`,
        detail: "Share of core governance controls currently enabled.",
      },
    ],
    goNoGoCriteria,
    measuredPilot: {
      hasBaseline: Boolean(input.baseline),
      baselineLabel: input.baseline?.capturedAtLabel ?? null,
      latestCheckpointLabel: input.latestCheckpoint?.capturedAtLabel ?? null,
      checkpointCount,
      note: input.baseline
        ? "Observed movement is anchored to a baseline captured inside the workspace. Modeled ROI should still be treated separately."
        : "The workspace has not captured a measured baseline yet, so buyer claims should stay at the level of workflow proof and modeled economics.",
      deltaRows: input.observedDeltas,
    },
    calibration: {
      statusLabel: input.calibrationWorkspace.summary.statusLabel,
      blockers: input.calibrationWorkspace.summary.blockers,
      openCount:
        input.calibrationWorkspace.summary.notStartedCount +
        input.calibrationWorkspace.summary.inProgressCount +
        input.calibrationWorkspace.summary.escalatedCount,
      escalatedCount: input.calibrationWorkspace.summary.escalatedCount,
      readyCount: input.calibrationWorkspace.summary.readyCount,
      highRiskReviewers: input.calibrationWorkspace.items.slice(0, 3).map((item) => ({
        reviewerName: item.reviewerName,
        calibrationStatus: item.calibrationStatus,
        disagreementRate: item.disagreementRate,
        knownOutcomeCount: item.knownOutcomeCount,
        recommendation: item.recommendation,
      })),
    },
    risks,
    nextMoves,
    buyerPressureTest: input.template.buyerObjections,
    successMetrics: input.template.successMetrics,
  } satisfies PilotProofReport;
}

export function buildPilotProofReportMarkdown(report: PilotProofReport) {
  return [
    `# ${report.title}`,
    "",
    `Generated: ${report.generatedAtLabel}`,
    `Stage: ${report.stageLabel}`,
    "",
    "## Recommendation",
    report.recommendationLabel,
    "",
    report.recommendationDetail,
    "",
    "## Observed Proof",
    ...report.observedProof.map((item) => `- ${item}`),
    "",
    "## Modeled Assumptions",
    ...report.modeledAssumptions.map((item) => `- ${item}`),
    "",
    "## Current Snapshot",
    ...report.currentSnapshot.map((item) => `- ${item.label}: ${item.value} (${item.detail})`),
    "",
    "## Go Or Hold Criteria",
    ...report.goNoGoCriteria.map((item) => `- ${item.label}: ${item.status}. ${item.detail}`),
    "",
    "## Measured Pilot",
    `- Baseline on file: ${report.measuredPilot.hasBaseline ? "yes" : "no"}`,
    `- Baseline: ${report.measuredPilot.baselineLabel ?? "none"}`,
    `- Latest checkpoint: ${report.measuredPilot.latestCheckpointLabel ?? "none"}`,
    `- Checkpoints: ${report.measuredPilot.checkpointCount}`,
    `- Note: ${report.measuredPilot.note}`,
    ...report.measuredPilot.deltaRows.map(
      (row) =>
        `- ${row.label}: ${row.deltaLabel}. Now ${row.currentValueLabel} versus baseline ${row.baselineValueLabel}. ${row.detail}`,
    ),
    "",
    "## Calibration",
    `- Status: ${report.calibration.statusLabel}`,
    `- Open items: ${report.calibration.openCount}`,
    `- Escalated items: ${report.calibration.escalatedCount}`,
    ...report.calibration.blockers.map((item) => `- ${item}`),
    "",
    "## Risks",
    ...report.risks.map((item) => `- ${item}`),
    "",
    "## Next Moves",
    ...report.nextMoves.map((item) => `- ${item}`),
    "",
    "## Buyer Pressure Test",
    ...report.buyerPressureTest.flatMap((item) => [
      `- Objection: ${item.objection}`,
      `  Response: ${item.response}`,
      `  Proof to show: ${item.proofPoint}`,
    ]),
    "",
    "## Success Metrics",
    ...report.successMetrics.map((item) => `- ${item}`),
  ].join("\n");
}
