import { z } from "zod";

import { pilotLaunchItemStatusSchema } from "@/lib/pilot/workspace";

export const PILOT_REVIEW_SHARE_TYPES = ["REPORT", "PACK", "COMMERCIAL", "ONBOARDING", "ROI"] as const;

export const pilotReviewShareTypeSchema = z.enum(PILOT_REVIEW_SHARE_TYPES);

export type PilotReviewShareType = z.infer<typeof pilotReviewShareTypeSchema>;

const pilotHealthStatusSchema = z.enum(["healthy", "degraded", "down", "unhealthy"]);

const proofCriterionSchema = z.object({
  label: z.string(),
  status: z.enum(["ready", "watch", "blocked"]),
  detail: z.string(),
});

const deltaRowSchema = z.object({
  label: z.string(),
  deltaLabel: z.string(),
  currentValueLabel: z.string(),
  baselineValueLabel: z.string(),
  detail: z.string(),
  direction: z.enum(["improved", "declined", "flat"]),
});

const proofReportSchema = z.object({
  title: z.string(),
  generatedAtLabel: z.string(),
  recommendationLabel: z.string(),
  recommendationDetail: z.string(),
  stageLabel: z.string(),
  summary: z.string(),
  observedProof: z.array(z.string()),
  modeledAssumptions: z.array(z.string()),
  currentSnapshot: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      detail: z.string(),
    }),
  ),
  goNoGoCriteria: z.array(proofCriterionSchema),
  measuredPilot: z.object({
    hasBaseline: z.boolean(),
    baselineLabel: z.string().nullable(),
    latestCheckpointLabel: z.string().nullable(),
    checkpointCount: z.number(),
    note: z.string(),
    deltaRows: z.array(deltaRowSchema),
  }),
  calibration: z.object({
    statusLabel: z.string(),
    blockers: z.array(z.string()),
    openCount: z.number(),
    escalatedCount: z.number(),
    readyCount: z.number(),
    highRiskReviewers: z.array(
      z.object({
        reviewerName: z.string(),
        calibrationStatus: z.string(),
        disagreementRate: z.number(),
        knownOutcomeCount: z.number(),
        recommendation: z.string(),
      }),
    ),
  }),
  risks: z.array(z.string()),
  nextMoves: z.array(z.string()),
  buyerPressureTest: z.array(
    z.object({
      objection: z.string(),
      response: z.string(),
      proofPoint: z.string(),
    }),
  ),
  successMetrics: z.array(z.string()),
});

const pilotProfileSummarySchema = z.object({
  pilotName: z.string(),
  designPartnerName: z.string(),
  programName: z.string(),
  primaryContactName: z.string(),
  primaryContactEmail: z.string(),
  packSummary: z.string(),
});

const commercialReadinessBreakdownSchema = z.object({
  label: z.string(),
  score: z.number(),
  maxScore: z.number(),
  detail: z.string(),
});

const buyerObjectionSchema = z.object({
  objection: z.string(),
  response: z.string(),
  proofPoint: z.string(),
});

const commercialMilestoneSchema = z.object({
  title: z.string(),
  owner: z.string(),
  detail: z.string(),
});

const pilotLaunchChecklistItemSchema = z.object({
  title: z.string(),
  owner: z.string(),
  detail: z.string(),
});

const pilotStakeholderItemSchema = z.object({
  role: z.string(),
  detail: z.string(),
});

const pilotLaunchWorkstreamSummarySchema = z.object({
  total: z.number(),
  readyCount: z.number(),
  inProgressCount: z.number(),
  notStartedCount: z.number(),
  overdueCount: z.number(),
  completionRate: z.number(),
  statusLabel: z.enum(["Launch ready", "In launch prep", "Not started"]),
  nextDueAt: z.string().nullable(),
  blockers: z.array(z.string()),
});

const pilotLaunchWorkstreamItemSchema = z.object({
  slug: z.string(),
  index: z.number(),
  title: z.string(),
  detail: z.string(),
  defaultOwner: z.string(),
  currentOwner: z.string(),
  status: pilotLaunchItemStatusSchema,
  dueAt: z.string().nullable(),
  note: z.string().nullable(),
  completedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

const pilotLaunchWorkstreamSchema = z.object({
  items: z.array(pilotLaunchWorkstreamItemSchema),
  summary: pilotLaunchWorkstreamSummarySchema,
});

const healthCheckSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["healthy", "degraded", "down"]),
  detail: z.string(),
});

const pilotSnapshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  snapshotType: z.enum(["BASELINE", "CHECKPOINT"]),
  capturedAtLabel: z.string(),
  authorLabel: z.string(),
  note: z.string().nullable(),
  averageReviewMinutes: z.number().nullable(),
  sampledReviewCount: z.number().nullable(),
  memoCoverage: z.number(),
  sponsorReadyCoverage: z.number(),
  workflowPressure: z.number(),
});

const pilotReportSharePayloadSchema = z.object({
  kind: z.literal("pilot_report"),
  title: z.string(),
  templateLabel: z.string(),
  healthStatus: pilotHealthStatusSchema,
  pilotProfile: pilotProfileSummarySchema,
  report: proofReportSchema,
});

const buyerPackSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  recommendationLabel: z.string(),
  recommendationDetail: z.string(),
  measuredDecision: z.object({
    label: z.string(),
    detail: z.string(),
  }),
  observedProofHighlights: z.array(z.string()),
  modeledEconomicsHighlights: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      detail: z.string(),
    }),
  ),
  measuredMovementHighlights: z.array(
    z.object({
      label: z.string(),
      deltaLabel: z.string(),
      detail: z.string(),
    }),
  ),
  goNoGoCriteria: z.array(proofCriterionSchema),
  buyerDeliverables: z.array(z.string()),
  buyerObjections: z.array(
    z.object({
      objection: z.string(),
      response: z.string(),
      proofPoint: z.string(),
    }),
  ),
  nextMoves: z.array(z.string()),
  successMetrics: z.array(z.string()),
});

const pilotPackSharePayloadSchema = z.object({
  kind: z.literal("pilot_pack"),
  title: z.string(),
  templateLabel: z.string(),
  healthStatus: pilotHealthStatusSchema,
  pilotProfile: pilotProfileSummarySchema,
  buyerPack: buyerPackSchema,
});

const pilotCommercialSharePayloadSchema = z.object({
  kind: z.literal("pilot_commercial"),
  title: z.string(),
  templateLabel: z.string(),
  healthStatus: pilotHealthStatusSchema,
  pilotProfile: pilotProfileSummarySchema,
  bestBuyerMotion: z.object({
    audience: z.string(),
    whyItFits: z.string(),
    firstPilotGoal: z.string(),
  }),
  readiness: z.object({
    score: z.number(),
    stageLabel: z.string(),
    breakdown: z.array(commercialReadinessBreakdownSchema),
    gaps: z.array(z.string()),
    nextMoves: z.array(z.string()),
  }),
  buyerObjections: z.array(buyerObjectionSchema),
  milestones: z.array(commercialMilestoneSchema),
});

const pilotOnboardingSharePayloadSchema = z.object({
  kind: z.literal("pilot_onboarding"),
  title: z.string(),
  templateLabel: z.string(),
  healthStatus: pilotHealthStatusSchema,
  pilotProfile: pilotProfileSummarySchema.extend({
    targetLaunchDateLabel: z.string(),
  }),
  currentSlate: z.object({
    candidateCount: z.number(),
    sponsorReadyCount: z.number(),
  }),
  launchPosture: z.object({
    guidedDemoMode: z.boolean(),
    blindReviewMode: z.boolean(),
    strictEvidenceMode: z.boolean(),
    requireOutboundApproval: z.boolean(),
  }),
  bestBuyerMotion: z.object({
    audience: z.string(),
    firstPilotGoal: z.string(),
  }),
  designPartnerCommitments: z.array(z.string()),
  launchWorkstream: pilotLaunchWorkstreamSchema,
  onboardingChecklist: z.array(pilotLaunchChecklistItemSchema),
  stakeholderMap: z.array(pilotStakeholderItemSchema),
  calibrationPlaybook: z.array(z.string()),
  buyerDeliverables: z.array(z.string()),
});

const pilotRoiSharePayloadSchema = z.object({
  kind: z.literal("pilot_roi"),
  title: z.string(),
  templateLabel: z.string(),
  templateSummary: z.string(),
  healthStatus: pilotHealthStatusSchema,
  pilotProfile: pilotProfileSummarySchema,
  modeled: z.object({
    monthlyHoursRecovered: z.number(),
    operatorDaysRecovered: z.number(),
    monthlyLaborValue: z.number(),
    controlCoverage: z.number(),
    memoCoverage: z.number(),
    sponsorReadyCoverage: z.number(),
    knownOutcomeCoverage: z.number(),
    workflowPressure: z.number(),
    disagreementRate: z.number(),
    positiveOutcomeRate: z.number(),
  }),
  launchPosture: z.object({
    blindReviewMode: z.boolean(),
    strictEvidenceMode: z.boolean(),
    requireOutboundApproval: z.boolean(),
  }),
  baseline: z.object({
    capturedAtLabel: z.string(),
    authorLabel: z.string(),
    note: z.string().nullable(),
    averageReviewMinutes: z.number().nullable(),
    sampledReviewCount: z.number().nullable(),
  }).nullable(),
  observedDeltas: z.array(deltaRowSchema),
  recentSnapshots: z.array(pilotSnapshotSchema),
  assumptions: z.array(z.string()),
  health: z.object({
    checkedAtLabel: z.string(),
    checks: z.array(healthCheckSchema),
  }),
});

export const pilotReviewSharePayloadSchema = z.union([
  pilotReportSharePayloadSchema,
  pilotPackSharePayloadSchema,
  pilotCommercialSharePayloadSchema,
  pilotOnboardingSharePayloadSchema,
  pilotRoiSharePayloadSchema,
]);

export type PilotReviewSharePayload = z.infer<typeof pilotReviewSharePayloadSchema>;

export function buildPilotReportSharePayload(input: z.input<typeof pilotReportSharePayloadSchema>) {
  return pilotReportSharePayloadSchema.parse(input);
}

export function buildPilotPackSharePayload(input: z.input<typeof pilotPackSharePayloadSchema>) {
  return pilotPackSharePayloadSchema.parse(input);
}

export function buildPilotCommercialSharePayload(input: z.input<typeof pilotCommercialSharePayloadSchema>) {
  return pilotCommercialSharePayloadSchema.parse(input);
}

export function buildPilotOnboardingSharePayload(input: z.input<typeof pilotOnboardingSharePayloadSchema>) {
  return pilotOnboardingSharePayloadSchema.parse(input);
}

export function buildPilotRoiSharePayload(input: z.input<typeof pilotRoiSharePayloadSchema>) {
  return pilotRoiSharePayloadSchema.parse(input);
}

export function serializePilotReviewSharePayload(payload: PilotReviewSharePayload) {
  return JSON.stringify(payload);
}

export function parsePilotReviewSharePayload(payloadJson: string) {
  return pilotReviewSharePayloadSchema.parse(JSON.parse(payloadJson) as unknown);
}

export function buildPilotReviewSharePath(token: string) {
  return `/pilot/review/${token}`;
}

export function getPilotReviewShareArtifactLabel(linkType: PilotReviewShareType) {
  switch (linkType) {
    case "REPORT":
      return "proof report";
    case "PACK":
      return "buyer pack";
    case "COMMERCIAL":
      return "commercial proof brief";
    case "ONBOARDING":
      return "pilot launch brief";
    case "ROI":
      return "executive ROI brief";
  }
}

export function pilotReviewShareRequiresAdmin(linkType: PilotReviewShareType) {
  return linkType === "REPORT" || linkType === "COMMERCIAL" || linkType === "ROI";
}
