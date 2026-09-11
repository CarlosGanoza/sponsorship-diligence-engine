import { z } from "zod";

import type { ReviewerCalibrationRow } from "@/lib/calibration/report";
import type { PilotTemplateDefinition } from "@/lib/pilot/templates";

export const REVIEWER_CALIBRATION_ITEM_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "READY", "ESCALATED"] as const;

export const reviewerCalibrationItemStatusSchema = z.enum(REVIEWER_CALIBRATION_ITEM_STATUSES);

export const reviewerCalibrationItemMutationSchema = z.object({
  status: reviewerCalibrationItemStatusSchema,
  owner: z.string().trim().max(80).optional().or(z.literal("")),
  dueAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(280).optional().or(z.literal("")),
});

export type ReviewerCalibrationItemStatus = (typeof REVIEWER_CALIBRATION_ITEM_STATUSES)[number];
export type ReviewerCalibrationItemMutationInput = z.infer<typeof reviewerCalibrationItemMutationSchema>;

type PersistedCalibrationItem = {
  status: ReviewerCalibrationItemStatus;
  owner?: string;
  dueAt?: string;
  note?: string;
  completedAt?: string | null;
  updatedAt?: string | null;
};

type CalibrationWorkspaceState = Record<string, PersistedCalibrationItem>;

export type ReviewerCalibrationActionItem = {
  reviewerId: string;
  reviewerSlug: string;
  reviewerName: string;
  comparedFiles: number;
  knownOutcomeCount: number;
  alignmentRate: number;
  disagreementRate: number;
  optimisticPositiveCount: number;
  optimisticNegativeCount: number;
  conservativePositiveCount: number;
  conservativeNegativeCount: number;
  calibrationStatus: ReviewerCalibrationRow["status"];
  recommendation: string;
  defaultOwner: string;
  currentOwner: string;
  status: ReviewerCalibrationItemStatus;
  dueAt: string | null;
  note: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};

export type ReviewerCalibrationWorkspace = {
  items: ReviewerCalibrationActionItem[];
  summary: {
    total: number;
    readyCount: number;
    inProgressCount: number;
    notStartedCount: number;
    escalatedCount: number;
    overdueCount: number;
    completionRate: number;
    statusLabel: "Calibration ready" | "Needs calibration work" | "Not started";
    nextDueAt: string | null;
    blockers: string[];
  };
  overview: {
    watchCount: number;
    mixedCount: number;
    wellCalibratedCount: number;
    needsDataCount: number;
  };
};

const persistedCalibrationItemSchema = z.object({
  status: reviewerCalibrationItemStatusSchema.default("NOT_STARTED"),
  owner: z.string().trim().max(80).optional(),
  dueAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(280).optional(),
  completedAt: z.string().datetime().optional().nullable(),
  updatedAt: z.string().datetime().optional().nullable(),
});

const calibrationWorkspaceStateSchema = z.record(z.string(), persistedCalibrationItemSchema);

function toTrimmedValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugifyReviewerName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCalibrationWorkspaceState(rawValue: string | undefined) {
  if (!rawValue) {
    return {} satisfies CalibrationWorkspaceState;
  }

  const payload = z.string().safeParse(rawValue);

  if (!payload.success) {
    return {} satisfies CalibrationWorkspaceState;
  }

  let decodedValue: unknown;
  try {
    decodedValue = JSON.parse(payload.data);
  } catch {
    return {} satisfies CalibrationWorkspaceState;
  }

  const parsed = calibrationWorkspaceStateSchema.safeParse(decodedValue);
  if (!parsed.success) {
    return {} satisfies CalibrationWorkspaceState;
  }

  return parsed.data as CalibrationWorkspaceState;
}

function getDefaultCalibrationStatus(reviewer: ReviewerCalibrationRow): ReviewerCalibrationItemStatus {
  if (reviewer.status === "well_calibrated") {
    return "READY";
  }

  if (reviewer.status === "watch") {
    return "ESCALATED";
  }

  if (reviewer.status === "mixed") {
    return "IN_PROGRESS";
  }

  return "NOT_STARTED";
}

function getDefaultOwner(input: {
  reviewer: ReviewerCalibrationRow;
  template: PilotTemplateDefinition;
}) {
  if (input.template.stakeholderMap.length > 0) {
    return input.template.stakeholderMap[0]?.role ?? input.reviewer.reviewerName;
  }

  return input.reviewer.reviewerName;
}

export function buildReviewerCalibrationWorkspace(input: {
  reviewers: ReviewerCalibrationRow[];
  template: PilotTemplateDefinition;
  rawValue: string | undefined;
}): ReviewerCalibrationWorkspace {
  const persistedState = parseCalibrationWorkspaceState(input.rawValue);
  const today = new Date().toISOString().slice(0, 10);

  const items = [...input.reviewers]
    .sort((left, right) => {
      if (left.status === right.status) {
        return right.disagreementRate - left.disagreementRate || right.knownOutcomeCount - left.knownOutcomeCount;
      }

      const statusPriority: Record<ReviewerCalibrationRow["status"], number> = {
        watch: 0,
        mixed: 1,
        needs_data: 2,
        well_calibrated: 3,
      };

      return statusPriority[left.status] - statusPriority[right.status];
    })
    .map((reviewer) => {
      const persistedItem = persistedState[reviewer.reviewerId];

      return {
        reviewerId: reviewer.reviewerId,
        reviewerSlug: slugifyReviewerName(reviewer.reviewerName),
        reviewerName: reviewer.reviewerName,
        comparedFiles: reviewer.comparedFiles,
        knownOutcomeCount: reviewer.knownOutcomeCount,
        alignmentRate: reviewer.alignmentRate,
        disagreementRate: reviewer.disagreementRate,
        optimisticPositiveCount: reviewer.optimisticPositiveCount,
        optimisticNegativeCount: reviewer.optimisticNegativeCount,
        conservativePositiveCount: reviewer.conservativePositiveCount,
        conservativeNegativeCount: reviewer.conservativeNegativeCount,
        calibrationStatus: reviewer.status,
        recommendation: reviewer.recommendation,
        defaultOwner: getDefaultOwner({
          reviewer,
          template: input.template,
        }),
        currentOwner:
          persistedItem?.owner?.trim() ||
          getDefaultOwner({
            reviewer,
            template: input.template,
          }),
        status: persistedItem?.status ?? getDefaultCalibrationStatus(reviewer),
        dueAt: persistedItem?.dueAt ?? null,
        note: persistedItem?.note?.trim() || null,
        completedAt: persistedItem?.completedAt ?? null,
        updatedAt: persistedItem?.updatedAt ?? null,
      } satisfies ReviewerCalibrationActionItem;
    });

  const readyCount = items.filter((item) => item.status === "READY").length;
  const inProgressCount = items.filter((item) => item.status === "IN_PROGRESS").length;
  const escalatedCount = items.filter((item) => item.status === "ESCALATED").length;
  const notStartedCount = items.length - readyCount - inProgressCount - escalatedCount;
  const overdueCount = items.filter((item) => item.dueAt && item.dueAt < today && item.status !== "READY").length;
  const completionRate = items.length === 0 ? 0 : Math.round((readyCount / items.length) * 100);
  const nextDueAt =
    items
      .filter((item) => item.dueAt && item.status !== "READY")
      .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""))[0]?.dueAt ?? null;

  return {
    items,
    summary: {
      total: items.length,
      readyCount,
      inProgressCount,
      notStartedCount,
      escalatedCount,
      overdueCount,
      completionRate,
      statusLabel:
        items.length === 0
          ? "Not started"
          : escalatedCount === 0 && readyCount === items.length
            ? "Calibration ready"
            : readyCount > 0 || inProgressCount > 0 || escalatedCount > 0
              ? "Needs calibration work"
              : "Not started",
      nextDueAt,
      blockers: items
        .filter((item) => item.status !== "READY")
        .slice(0, 3)
        .map((item) =>
          item.calibrationStatus === "watch"
            ? `${item.reviewerName} still needs calibration review before sponsor-facing movement.`
            : item.dueAt
              ? `${item.reviewerName} is still open and due ${item.dueAt}.`
              : `${item.reviewerName} still needs a calibration decision.`,
        ),
    },
    overview: {
      watchCount: items.filter((item) => item.calibrationStatus === "watch").length,
      mixedCount: items.filter((item) => item.calibrationStatus === "mixed").length,
      wellCalibratedCount: items.filter((item) => item.calibrationStatus === "well_calibrated").length,
      needsDataCount: items.filter((item) => item.calibrationStatus === "needs_data").length,
    },
  };
}

export function serializeUpdatedReviewerCalibrationWorkspace(input: {
  currentValue: string | undefined;
  reviewerId: string;
  update: ReviewerCalibrationItemMutationInput;
}) {
  const currentState = parseCalibrationWorkspaceState(input.currentValue);
  const now = new Date().toISOString();
  const nextStatus = input.update.status;

  currentState[input.reviewerId] = {
    status: nextStatus,
    owner: toTrimmedValue(input.update.owner),
    dueAt: toTrimmedValue(input.update.dueAt),
    note: toTrimmedValue(input.update.note),
    completedAt: nextStatus === "READY" ? currentState[input.reviewerId]?.completedAt ?? now : null,
    updatedAt: now,
  };

  return JSON.stringify(currentState);
}
