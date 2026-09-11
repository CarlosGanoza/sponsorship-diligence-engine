import { z } from "zod";

import type { PilotTemplateDefinition, PilotTemplateKey } from "@/lib/pilot/templates";

export const PILOT_LAUNCH_ITEM_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "READY"] as const;

export const pilotLaunchItemStatusSchema = z.enum(PILOT_LAUNCH_ITEM_STATUSES);

export const pilotProfileSchema = z.object({
  pilotName: z.string().trim().min(3).max(80),
  designPartnerName: z.string().trim().min(3).max(80),
  programName: z.string().trim().min(3).max(80),
  primaryContactName: z.string().trim().min(3).max(80),
  primaryContactEmail: z.string().trim().email().max(120),
  targetLaunchDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  packSummary: z.string().trim().min(24).max(240),
});

export const pilotLaunchItemMutationSchema = z.object({
  status: pilotLaunchItemStatusSchema,
  owner: z.string().trim().max(80).optional().or(z.literal("")),
  dueAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(280).optional().or(z.literal("")),
});

export type PilotLaunchItemStatus = (typeof PILOT_LAUNCH_ITEM_STATUSES)[number];
export type PilotProfile = z.infer<typeof pilotProfileSchema>;
export type PilotLaunchItemMutationInput = z.infer<typeof pilotLaunchItemMutationSchema>;

type PilotLaunchPersistedItem = {
  status: PilotLaunchItemStatus;
  owner?: string;
  dueAt?: string;
  note?: string;
  completedAt?: string | null;
  updatedAt?: string | null;
};

type PilotLaunchState = Record<string, Record<string, PilotLaunchPersistedItem>>;

export type PilotLaunchItem = {
  slug: string;
  index: number;
  title: string;
  detail: string;
  defaultOwner: string;
  currentOwner: string;
  status: PilotLaunchItemStatus;
  dueAt: string | null;
  note: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};

export type PilotLaunchWorkstream = {
  items: PilotLaunchItem[];
  summary: {
    total: number;
    readyCount: number;
    inProgressCount: number;
    notStartedCount: number;
    overdueCount: number;
    completionRate: number;
    statusLabel: "Launch ready" | "In launch prep" | "Not started";
    nextDueAt: string | null;
    blockers: string[];
  };
};

const persistedLaunchItemSchema = z.object({
  status: pilotLaunchItemStatusSchema.default("NOT_STARTED"),
  owner: z.string().trim().max(80).optional(),
  dueAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(280).optional(),
  completedAt: z.string().datetime().optional().nullable(),
  updatedAt: z.string().datetime().optional().nullable(),
});

const persistedLaunchStateSchema = z.record(
  z.string(),
  z.record(z.string(), persistedLaunchItemSchema),
);

function toTrimmedValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugifyLaunchItem(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseLaunchState(rawValue: string | undefined) {
  if (!rawValue) {
    return {} satisfies PilotLaunchState;
  }

  const payload = z.string().safeParse(rawValue);
  if (!payload.success) {
    return {} satisfies PilotLaunchState;
  }

  let decodedValue: unknown;
  try {
    decodedValue = JSON.parse(payload.data);
  } catch {
    return {} satisfies PilotLaunchState;
  }

  const parsed = persistedLaunchStateSchema.safeParse(decodedValue);
  if (!parsed.success) {
    return {} satisfies PilotLaunchState;
  }

  return parsed.data as PilotLaunchState;
}

export function buildDefaultPilotProfile(input: {
  workspaceName: string;
  template: PilotTemplateDefinition;
}): PilotProfile {
  return {
    pilotName: `${input.workspaceName} sponsorship pilot`,
    designPartnerName: input.workspaceName,
    programName: input.template.label,
    primaryContactName: "Pilot owner",
    primaryContactEmail: "pilot@signalsponsor.demo",
    targetLaunchDate: "",
    packSummary: `A contained ${input.template.label.toLowerCase()} deployment focused on evidence-backed sponsorship decisions, explicit review governance, and measured sponsor-path outcomes.`,
  };
}

export function parsePilotProfile(rawValue: string | undefined, defaults: PilotProfile): PilotProfile {
  if (!rawValue) {
    return defaults;
  }

  const payload = z.string().safeParse(rawValue);
  if (!payload.success) {
    return defaults;
  }

  let decodedValue: unknown;
  try {
    decodedValue = JSON.parse(payload.data);
  } catch {
    return defaults;
  }

  const parsed = pilotProfileSchema.safeParse(decodedValue);
  if (!parsed.success) {
    return defaults;
  }

  return parsed.data;
}

export function serializePilotProfile(profile: PilotProfile) {
  return JSON.stringify(profile);
}

export function buildPilotLaunchWorkstream(
  template: PilotTemplateDefinition,
  rawValue: string | undefined,
): PilotLaunchWorkstream {
  const persistedState = parseLaunchState(rawValue);
  const templateState = persistedState[template.key] ?? {};
  const today = new Date().toISOString().slice(0, 10);

  const items = template.onboardingChecklist.map((item, index) => {
    const slug = slugifyLaunchItem(item.title);
    const persistedItem = templateState[slug];

    return {
      slug,
      index,
      title: item.title,
      detail: item.detail,
      defaultOwner: item.owner,
      currentOwner: persistedItem?.owner?.trim() || item.owner,
      status: persistedItem?.status ?? "NOT_STARTED",
      dueAt: persistedItem?.dueAt ?? null,
      note: persistedItem?.note?.trim() || null,
      completedAt: persistedItem?.completedAt ?? null,
      updatedAt: persistedItem?.updatedAt ?? null,
    } satisfies PilotLaunchItem;
  });

  const readyCount = items.filter((item) => item.status === "READY").length;
  const inProgressCount = items.filter((item) => item.status === "IN_PROGRESS").length;
  const notStartedCount = items.length - readyCount - inProgressCount;
  const overdueCount = items.filter((item) => item.dueAt && item.dueAt < today && item.status !== "READY").length;
  const completionRate = items.length === 0 ? 0 : Math.round((readyCount / items.length) * 100);
  const nextDueAt =
    items
      .filter((item) => item.dueAt && item.status !== "READY")
      .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""))[0]?.dueAt ?? null;

  const blockers = items
    .filter((item) => item.status !== "READY")
    .slice(0, 3)
    .map((item) =>
      item.dueAt
        ? `${item.title} is still open${item.dueAt ? ` and due ${item.dueAt}` : ""}.`
        : `${item.title} is still open.`,
    );

  return {
    items,
    summary: {
      total: items.length,
      readyCount,
      inProgressCount,
      notStartedCount,
      overdueCount,
      completionRate,
      statusLabel: readyCount === items.length ? "Launch ready" : readyCount > 0 || inProgressCount > 0 ? "In launch prep" : "Not started",
      nextDueAt,
      blockers,
    },
  };
}

export function serializeUpdatedPilotLaunchState(input: {
  currentValue: string | undefined;
  templateKey: PilotTemplateKey;
  slug: string;
  update: PilotLaunchItemMutationInput;
}) {
  const currentState = parseLaunchState(input.currentValue);
  const templateState = currentState[input.templateKey] ?? {};
  const now = new Date().toISOString();
  const nextStatus = input.update.status;

  currentState[input.templateKey] = {
    ...templateState,
    [input.slug]: {
      status: nextStatus,
      owner: toTrimmedValue(input.update.owner),
      dueAt: toTrimmedValue(input.update.dueAt),
      note: toTrimmedValue(input.update.note),
      completedAt:
        nextStatus === "READY"
          ? templateState[input.slug]?.completedAt ?? now
          : null,
      updatedAt: now,
    },
  };

  return JSON.stringify(currentState);
}
