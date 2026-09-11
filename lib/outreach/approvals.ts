import {
  OutboundApprovalStatus,
  OutboundApprovalType,
  SponsorActivityType,
  SponsorPipelineStage,
  type OutboundApproval,
} from "@prisma/client";

import type { SafetySettings } from "@/lib/safety/settings";

type SafetyReportShape = {
  decision: "advance" | "hold" | "do_not_advance";
  unsupportedStatements: string[];
  potentialContradictions: string[];
  blockingContradictions?: string[];
  missingProof: string[];
  supportCoverage?: number;
  citationCoverage?: number;
  sponsorFacingContactDetails?: string[];
  sponsorFacingContactDetailCount?: number;
};

type ApprovalLike = Pick<
  OutboundApproval,
  "id" | "approvalType" | "status" | "title" | "rationale" | "decisionNote" | "reviewedAt" | "createdAt"
> & {
  requestedBy?: { name: string | null } | null;
  reviewedBy?: { name: string | null } | null;
};

export type SponsorPathHistorySummary = {
  duplicateAskRisk: boolean;
  duplicateAskReason: string | null;
  negativeMemory: string[];
  blackoutActive: boolean;
  blackoutReason: string | null;
  blackoutUntilLabel: string | null;
};

export const OUTBOUND_APPROVAL_TYPE_LABELS: Record<OutboundApprovalType, string> = {
  OUTREACH_RELEASE: "Outreach release",
  CRM_HANDOFF: "CRM handoff",
};

const SPONSOR_PATH_APPROVAL_ACTIVITIES = new Set<SponsorActivityType>([
  SponsorActivityType.INTRO_REQUESTED,
  SponsorActivityType.INTRO_CONFIRMED,
  SponsorActivityType.SPONSOR_CONTACTED,
  SponsorActivityType.MEETING_SCHEDULED,
  SponsorActivityType.FOLLOW_UP_SENT,
]);

const SPONSOR_FACING_PIPELINE_STAGES = new Set<SponsorPipelineStage>([
  SponsorPipelineStage.CONTACTED,
  SponsorPipelineStage.INTRO_REQUESTED,
  SponsorPipelineStage.INTRO_CONFIRMED,
  SponsorPipelineStage.MEETING_SCHEDULED,
  SponsorPipelineStage.ADVOCATING,
]);

export function requiresOutboundApprovalForActivity(activityType: SponsorActivityType) {
  return SPONSOR_PATH_APPROVAL_ACTIVITIES.has(activityType);
}

export function requiresOutboundApprovalForStage(stage: SponsorPipelineStage) {
  return SPONSOR_FACING_PIPELINE_STAGES.has(stage);
}

export function getRequiredOutboundApprovalTypes(input: {
  safetySettings: SafetySettings;
  forCrmHandoff?: boolean;
}) {
  const required: OutboundApprovalType[] = [];

  if (input.safetySettings.requireOutboundApproval) {
    required.push(OutboundApprovalType.OUTREACH_RELEASE);
  }

  if (input.forCrmHandoff && input.safetySettings.requireOutboundApproval) {
    required.push(OutboundApprovalType.CRM_HANDOFF);
  }

  return required;
}

export function buildSponsorPathHistorySummary(input: {
  briefCount: number;
  outboundEmailCount: number;
  activePipelineStage?: string | null;
  negativeMemory?: string[];
  blackoutActive?: boolean;
  blackoutReason?: string | null;
  blackoutUntilLabel?: string | null;
}) {
  const negativeMemory = Array.from(new Set((input.negativeMemory ?? []).filter(Boolean))).slice(0, 4);
  const duplicateSignals: string[] = [];

  if (input.briefCount > 1) {
    duplicateSignals.push(`${input.briefCount} active brief variants already exist for this sponsor path`);
  }

  if (input.outboundEmailCount > 1) {
    duplicateSignals.push(`${input.outboundEmailCount} outbound drafts or sends are already recorded`);
  }

  if (
    input.activePipelineStage &&
    input.activePipelineStage !== "PASSED" &&
    input.activePipelineStage !== "CLOSED" &&
    (input.briefCount > 0 || input.outboundEmailCount > 0)
  ) {
    duplicateSignals.push(`the sponsor path is already live in ${input.activePipelineStage.replaceAll("_", " ").toLowerCase()}`);
  }

  return {
    duplicateAskRisk: duplicateSignals.length > 0,
    duplicateAskReason: duplicateSignals.length > 0 ? duplicateSignals.join("; ") : null,
    negativeMemory,
    blackoutActive: input.blackoutActive ?? false,
    blackoutReason: input.blackoutReason?.trim() || null,
    blackoutUntilLabel: input.blackoutUntilLabel?.trim() || null,
  } satisfies SponsorPathHistorySummary;
}

export function buildOutboundReleaseAssessment(input: {
  safetySettings: SafetySettings;
  safetyReport: SafetyReportShape;
  openProofRequestCount: number;
  staleRecommendationCount?: number;
  approvals: ApprovalLike[];
  forCrmHandoff?: boolean;
  sponsorPathHistory?: SponsorPathHistorySummary;
}) {
  const requiredTypes = getRequiredOutboundApprovalTypes({
    safetySettings: input.safetySettings,
    forCrmHandoff: input.forCrmHandoff,
  });
  const blockers: string[] = [];
  const approvalByType = new Map(input.approvals.map((approval) => [approval.approvalType, approval]));

  if (input.safetyReport.decision !== "advance") {
    blockers.push(
      input.safetyReport.decision === "hold"
        ? "The guardrail still reads hold, so the file should not move into sponsor-facing use."
        : "The guardrail reads do not advance, so the file is not safe for sponsor-facing use.",
    );
  }

  if (input.safetyReport.unsupportedStatements.length > 0) {
    blockers.push("At least one memo statement still lacks clean evidence support.");
  }

  if ((input.safetyReport.supportCoverage ?? 100) < 85) {
    blockers.push("Memo support coverage is still below the minimum threshold for sponsor-facing use.");
  }

  if ((input.safetyReport.citationCoverage ?? 100) < 60) {
    blockers.push("Sentence-level citation coverage is still below the minimum threshold for sponsor-facing use.");
  }

  if (
    input.safetySettings.blockSponsorFacingPii &&
    ((input.safetyReport.sponsorFacingContactDetailCount ?? 0) > 0 ||
      (input.safetyReport.sponsorFacingContactDetails?.length ?? 0) > 0)
  ) {
    blockers.push("Sponsor-facing text still exposes personal contact details. Redact them before external use.");
  }

  if ((input.safetyReport.blockingContradictions?.length ?? 0) > 0) {
    blockers.push("A blocker-level contradiction is still open in the evidence base.");
  }

  if (input.safetyReport.potentialContradictions.length > 0) {
    blockers.push("Potential contradictions are still open in the evidence base.");
  }

  if (input.openProofRequestCount > 0) {
    blockers.push(
      `${input.openProofRequestCount} proof request${input.openProofRequestCount === 1 ? " is" : "s are"} still open.`,
    );
  }

  if ((input.staleRecommendationCount ?? 0) > 0) {
    blockers.push(
      `${input.staleRecommendationCount} recommendation${input.staleRecommendationCount === 1 ? " is" : "s are"} stale against the latest evidence or sponsor context.`,
    );
  }

  if (input.sponsorPathHistory?.duplicateAskRisk) {
    blockers.push(
      `This sponsor path already has overlapping motion: ${input.sponsorPathHistory.duplicateAskReason}. Consolidate the ask before moving externally.`,
    );
  }

  if (input.sponsorPathHistory?.blackoutActive) {
    blockers.push(
      input.sponsorPathHistory.blackoutReason
        ? `This sponsor is in a timing blackout${input.sponsorPathHistory.blackoutUntilLabel ? ` until ${input.sponsorPathHistory.blackoutUntilLabel}` : ""}: ${input.sponsorPathHistory.blackoutReason}.`
        : `This sponsor is in a timing blackout${input.sponsorPathHistory.blackoutUntilLabel ? ` until ${input.sponsorPathHistory.blackoutUntilLabel}` : ""}.`,
    );
  }

  for (const requiredType of requiredTypes) {
    const approval = approvalByType.get(requiredType);

    if (!approval) {
      blockers.push(`${OUTBOUND_APPROVAL_TYPE_LABELS[requiredType]} has not been requested yet.`);
      continue;
    }

    if (approval.status !== OutboundApprovalStatus.APPROVED) {
      blockers.push(
        approval.status === OutboundApprovalStatus.REJECTED
          ? `${OUTBOUND_APPROVAL_TYPE_LABELS[requiredType]} is currently rejected.`
          : `${OUTBOUND_APPROVAL_TYPE_LABELS[requiredType]} is still pending.`,
      );
    }
  }

  if (
    input.sponsorPathHistory &&
    input.sponsorPathHistory.negativeMemory.length > 0 &&
    approvalByType.get(OutboundApprovalType.OUTREACH_RELEASE)?.status !== OutboundApprovalStatus.APPROVED
  ) {
    blockers.push(
      `Past sponsor history still shows ${input.sponsorPathHistory.negativeMemory.join(", ")}. Explicit sponsor-specific release approval is required before new external movement.`,
    );
  }

  return {
    blocked: blockers.length > 0,
    blockers,
    requiredTypes,
    approvalRequired: requiredTypes.length > 0,
    approvalByType,
    sponsorPathHistory: input.sponsorPathHistory ?? {
      duplicateAskRisk: false,
      duplicateAskReason: null,
      negativeMemory: [],
      blackoutActive: false,
      blackoutReason: null,
      blackoutUntilLabel: null,
    },
  };
}

export type OutboundApprovalStateSummary = {
  state: "not_requested" | "pending" | "approved" | "rejected";
  label: string;
  variant: "muted" | "gold" | "sage" | "danger";
  detail: string;
};

export function summarizeOutboundApprovalState(input: {
  approvalType: OutboundApprovalType;
  approval?: ApprovalLike | null;
  blocked: boolean;
  blockers: string[];
}) {
  if (!input.approval) {
    return {
      state: "not_requested",
      label: "Not requested",
      variant: "muted",
      detail:
        input.blockers[0] ??
        `${OUTBOUND_APPROVAL_TYPE_LABELS[input.approvalType]} has not been requested yet.`,
    } satisfies OutboundApprovalStateSummary;
  }

  if (input.approval.status === OutboundApprovalStatus.REJECTED) {
    return {
      state: "rejected",
      label: "Rejected",
      variant: "danger",
      detail:
        input.approval.decisionNote?.trim() ||
        input.blockers[0] ||
        `${OUTBOUND_APPROVAL_TYPE_LABELS[input.approvalType]} is currently rejected.`,
    } satisfies OutboundApprovalStateSummary;
  }

  if (input.approval.status === OutboundApprovalStatus.PENDING) {
    return {
      state: "pending",
      label: "Pending review",
      variant: "gold",
      detail:
        input.blockers[0] ||
        `${OUTBOUND_APPROVAL_TYPE_LABELS[input.approvalType]} is pending operator review.`,
    } satisfies OutboundApprovalStateSummary;
  }

  if (input.blocked) {
    return {
      state: "approved",
      label: "Approved, blocked",
      variant: "danger",
      detail:
        input.blockers[0] ||
        `${OUTBOUND_APPROVAL_TYPE_LABELS[input.approvalType]} is approved, but the sponsor path is still blocked.`,
    } satisfies OutboundApprovalStateSummary;
  }

  return {
    state: "approved",
    label: "Approved",
    variant: "sage",
    detail:
      input.approval.decisionNote?.trim() ||
      `${OUTBOUND_APPROVAL_TYPE_LABELS[input.approvalType]} is clear for sponsor-facing use.`,
  } satisfies OutboundApprovalStateSummary;
}
