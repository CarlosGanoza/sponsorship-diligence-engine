"use server";

import {
  AuditLogTargetType,
  BackgroundJobStatus,
  BackgroundJobType,
  CandidateStage,
  CandidateUpdateAccessLinkStatus,
  CandidateUpdateStatus,
  CommitteeReviewStatus,
  CommitteeVoteDecision,
  DisagreementResolutionType,
  NotificationChannel,
  PilotMetricSnapshotType,
  ArtifactType,
  DecisionType,
  MemoStatus,
  MembershipRole,
  NoteType,
  OutboundApprovalStatus,
  OutboundApprovalType,
  OutboundEmailEventType,
  PilotReviewShareLinkType,
  ProofRequestStatus,
  ProofRequestType,
  ReviewStatus,
  ReviewShareLinkStatus,
  ReviewShareLinkType,
  SavedViewPage,
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorOutcomeType,
  SponsorOutcomeVerdict,
  SponsorPipelineStage,
  TaskStatus,
  type Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";

import {
  extractCandidateEvidence,
  generateCandidateMemo,
  generateCandidateRecommendations,
} from "@/lib/ai/pipeline";
import {
  createTaskFromDisagreementReview,
  resolveDisagreementReview,
  upsertDisagreementReview,
} from "@/lib/audits/workflow";
import { recordAuditLog } from "@/lib/audit/log";
import { sendOperatorAlertDigest, setAlertNotificationPreference } from "@/lib/alerts/digest";
import {
  applyManualStageOverride,
  evaluateCandidateAutomation,
  resolveOperatorAlert,
  resumeCandidateAutomation,
} from "@/lib/automation";
import { saveAutomationPolicy } from "@/lib/automation/policy";
import {
  createAppSession,
  destroyAppSession,
  hasRequiredMembershipRole,
  requireActionSession,
} from "@/lib/auth/session";
import { syncCrmHandoff } from "@/lib/crm/provider";
import {
  getCandidateDetail,
  getCommercialProofData,
  getExecutiveRoiData,
  getPilotLaunchData,
  getPilotPackData,
  getPilotProofReportData,
} from "@/lib/db/queries";
import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { enqueueBackgroundJob, resolveBackgroundJobsMode, runPendingBackgroundJobs } from "@/lib/jobs/queue";
import { COMMITTEE_VOTE_LABELS } from "@/lib/committee/reviews";
import { buildSponsorMemoVariant } from "@/lib/memo/variant";
import { generateCandidateOpportunityBriefs } from "@/lib/opportunities/pipeline";
import { recordSponsorOutcome } from "@/lib/outcomes";
import { getOutreachContext } from "@/lib/outreach/context";
import { requiresOutboundApprovalForActivity, requiresOutboundApprovalForStage } from "@/lib/outreach/approvals";
import { buildCrmHandoffRecord } from "@/lib/outreach/handoff";
import { sendOutboundEmail } from "@/lib/outreach/sender";
import { capturePilotMetricSnapshot } from "@/lib/pilot/measurements";
import {
  buildPilotCommercialSharePayload,
  buildPilotOnboardingSharePayload,
  buildPilotPackSharePayload,
  buildPilotReportSharePayload,
  buildPilotRoiSharePayload,
  pilotReviewShareRequiresAdmin,
  serializePilotReviewSharePayload,
} from "@/lib/pilot/share";
import { PILOT_TEMPLATE_KEYS, type PilotTemplateKey } from "@/lib/pilot/templates";
import {
  createProofRequest,
  createTaskFromProofRequest,
  resolveProofRequest,
  updateProofRequestWorkflow,
} from "@/lib/proof-requests";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { buildCandidateUpdateAccessPath, getCandidateUpdateAccessContext } from "@/lib/candidate-updates/access-links";
import {
  buildMemoReviewSharePayload,
  buildPacketReviewSharePayload,
  serializeReviewSharePayload,
} from "@/lib/review/share";
import { getCrmFieldMappingSettingKey, normalizeCrmFieldMappingInput } from "@/lib/crm/mappings";
import { normalizeSavedViewQueryString } from "@/lib/saved-views";
import {
  setBlindReviewMode,
  setBlockSponsorFacingPii,
  setRequireOutboundApproval,
  setStrictEvidenceMode,
} from "@/lib/safety/settings";
import { resetAndSeedDemo } from "@/lib/seed/run-seed";
import { persistPilotTemplate } from "@/lib/settings/pilot";
import { sponsorAvailabilityInputSchema, updateSponsorAvailabilityForOrganization } from "@/lib/sponsor/availability";
import { getStoredFileAccessRecord } from "@/lib/storage/provider";
import { verifyPassword } from "@/lib/auth/passwords";
import { consumeRateLimit, getRequestClientLabel } from "@/lib/runtime/rate-limit";
import { formatDate } from "@/lib/utils/format";
import {
  markPipelineFromActivity,
  markPipelineOutreachDrafted,
  syncCandidateSponsorPipeline,
  updatePipelineItem,
} from "@/lib/workflow/pipeline";
import { createTaskFromAlert, updateOperatorTask } from "@/lib/workflow/tasks";

const candidateSchema = z.object({
  fullName: z.string().min(2),
  headline: z.string().min(8),
  bio: z.string().min(40),
  region: z.string().min(2),
});

const artifactSchema = z.object({
  artifactType: z.nativeEnum(ArtifactType),
  title: z.string().min(3),
  rawText: z.string().min(30),
  sourceLabel: z.string().min(2),
  fileName: z.string().optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
});

const reviewSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  note: z.string().max(280).optional(),
});

const bulkReviewSchema = z.object({
  entityType: z.enum(["claim", "recommendation"]),
  itemIds: z.array(z.string().min(1)).min(1),
  status: z.nativeEnum(ReviewStatus),
  note: z.string().max(280).optional(),
});

const candidateNoteSchema = z.object({
  noteType: z.nativeEnum(NoteType),
  title: z.string().max(80).optional(),
  content: z.string().min(8).max(600),
});

const candidateDecisionSchema = z.object({
  decisionType: z.nativeEnum(DecisionType),
  summary: z.string().min(4).max(120),
  rationale: z.string().min(12).max(600),
});

const savedViewSchema = z.object({
  page: z.nativeEnum(SavedViewPage),
  title: z.string().min(3).max(60),
  description: z.string().max(140).optional(),
  queryString: z.string().max(600),
});

const sponsorActivitySchema = z.object({
  candidateId: z.string().min(1),
  sponsorId: z.string().min(1),
  opportunityBriefId: z.string().min(1).optional(),
  activityType: z.nativeEnum(SponsorActivityType),
  status: z.nativeEnum(SponsorActivityStatus),
  title: z.string().min(4).max(120),
  detail: z.string().min(8).max(600),
  sourceLabel: z.string().min(2).max(80),
});

const stageOverrideSchema = z.object({
  stage: z.nativeEnum(CandidateStage),
  rationale: z.string().min(12).max(400),
  actorLabel: z.string().max(80).optional(),
});

const automationResumeSchema = z.object({
  rationale: z.string().min(12).max(400),
  actorLabel: z.string().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200).optional(),
});

const crmModeSchema = z.enum(["mock", "webhook", "hubspot", "salesforce", "airtable"]);
const emailSendModeSchema = z.enum(["mock", "webhook", "gmail", "outlook"]);

const pilotTemplateSchema = z.enum(PILOT_TEMPLATE_KEYS);

const alertWorkflowSchema = z.object({
  assignedUserId: z.string().optional(),
  dueAt: z.string().optional(),
});

const automationPolicySchema = z.object({
  minArtifactsForReview: z.coerce.number().int().min(1).max(10),
  minClaimsForReview: z.coerce.number().int().min(1).max(30),
  intakeReadinessMax: z.coerce.number().int().min(0).max(100),
  memoReadinessMin: z.coerce.number().int().min(0).max(100),
  outreachReadinessMin: z.coerce.number().int().min(0).max(100),
  outreachMatchMin: z.coerce.number().int().min(0).max(100),
  holdReadinessMax: z.coerce.number().int().min(0).max(100),
  stalledDeltaMax: z.coerce.number().int().min(-10).max(20),
  momentumSurgeDeltaMin: z.coerce.number().int().min(1).max(30),
});

const operatorTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  ownerUserId: z.string().optional(),
  dueAt: z.string().optional(),
});

const pipelineUpdateSchema = z.object({
  stage: z.nativeEnum(SponsorPipelineStage),
  ownerUserId: z.string().optional(),
  nextDueAt: z.string().optional(),
  nextStep: z.string().max(200).optional(),
  outcomeNote: z.string().max(400).optional(),
});

const sponsorOutcomeSchema = z.object({
  verdict: z.nativeEnum(SponsorOutcomeVerdict),
  outcomeType: z.nativeEnum(SponsorOutcomeType),
  title: z.string().min(4).max(120),
  detail: z.string().min(12).max(600),
  occurredAt: z.string().min(8),
});

const disagreementReviewSchema = z.object({
  assignedUserId: z.string().optional(),
  dueAt: z.string().optional(),
});

const disagreementResolutionSchema = z.object({
  resolutionType: z.nativeEnum(DisagreementResolutionType),
  rationale: z.string().min(12).max(600),
});

const proofRequestSchema = z.object({
  requestType: z.nativeEnum(ProofRequestType),
  title: z.string().min(4).max(120),
  detail: z.string().min(12).max(600),
  assignedUserId: z.string().optional(),
  dueAt: z.string().optional(),
  sourceDisagreementReviewId: z.string().optional(),
});

const proofRequestWorkflowSchema = z.object({
  assignedUserId: z.string().optional(),
  dueAt: z.string().optional(),
});

const proofRequestResolutionSchema = z.object({
  resolutionNote: z.string().min(12).max(600),
  status: z.enum([ProofRequestStatus.RESOLVED, ProofRequestStatus.CANCELED]).default(ProofRequestStatus.RESOLVED),
});

const candidateUpdateSubmissionSchema = z.object({
  sourceProofRequestId: z.string().optional(),
  title: z.string().min(4).max(120),
  summary: z.string().min(12).max(600),
  submittedByLabel: z.string().min(2).max(80),
  artifactType: z.nativeEnum(ArtifactType),
  sourceLabel: z.string().min(2).max(80),
  fileName: z.string().max(120).optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
  rawText: z.string().min(30),
  resolveLinkedProofRequest: z.boolean().default(true),
});

const candidateUpdateIncorporationSchema = z.object({
  status: z.nativeEnum(CandidateUpdateStatus),
  incorporationNote: z.string().min(8).max(400),
});

const candidateUpdateAccessLinkSchema = z.object({
  daysValid: z.coerce.number().int().min(1).max(30).default(7),
});

const reviewShareLinkSchema = z.object({
  linkType: z.nativeEnum(ReviewShareLinkType),
  sponsorId: z.string().optional(),
  daysValid: z.coerce.number().int().min(1).max(30).default(7),
});

const pilotReviewShareLinkSchema = z.object({
  linkType: z.nativeEnum(PilotReviewShareLinkType),
  daysValid: z.coerce.number().int().min(1).max(30).default(7),
});

const publicCandidateUpdateSchema = z.object({
  title: z.string().min(4).max(120),
  summary: z.string().min(12).max(600),
  submittedByLabel: z.string().min(2).max(80),
  artifactType: z.nativeEnum(ArtifactType),
  fileName: z.string().max(120).optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
  rawText: z.string().min(30),
  ownershipScope: z.string().max(240).optional(),
  quantifiedOutcome: z.string().max(240).optional(),
  thirdPartyContext: z.string().max(240).optional(),
  consentAcknowledged: z.literal(true),
});

const proofRequestReminderSchema = z.object({
  note: z.string().max(280).optional(),
});

const crmFieldMappingSchema = z.object({
  provider: z.enum(["hubspot", "salesforce", "airtable"]),
  value: z.string().max(6000),
});

const outboundApprovalRequestSchema = z.object({
  sponsorId: z.string().min(1),
  opportunityBriefId: z.string().optional(),
  approvalType: z.nativeEnum(OutboundApprovalType),
  title: z.string().min(4).max(120),
  rationale: z.string().min(12).max(600),
});

const outboundApprovalReviewSchema = z.object({
  status: z.nativeEnum(OutboundApprovalStatus),
  decisionNote: z.string().min(8).max(600),
});

const committeeReviewRequestSchema = z.object({
  title: z.string().min(4).max(120),
  summary: z.string().min(12).max(600),
  chairUserId: z.string().optional(),
  dueAt: z.string().optional(),
});

const committeeVoteSchema = z.object({
  decision: z.nativeEnum(CommitteeVoteDecision),
  rationale: z.string().min(12).max(600),
});

const committeeFinalizeSchema = z.object({
  finalDecision: z.nativeEnum(CommitteeVoteDecision),
  finalNote: z.string().min(12).max(600),
});

const outboundEmailSendSchema = z.object({
  sponsorId: z.string().min(1),
  opportunityBriefId: z.string().optional(),
  draftId: z.string().min(1),
  draftLabel: z.string().min(2).max(80),
  recipientLabel: z.string().min(2).max(120),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  subject: z.string().min(4).max(240),
  body: z.string().min(12).max(12000),
});

const outboundEmailEventSchema = z.object({
  outboundEmailId: z.string().min(1),
  eventType: z.nativeEnum(OutboundEmailEventType),
  title: z.string().min(4).max(120),
  detail: z.string().min(8).max(600),
});

async function requireCandidateAccess(candidateId: string, organizationId: string) {
  return prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId,
    },
    select: { id: true },
  });
}

function buildReviewShareExpiry(daysValid: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);
  expiresAt.setHours(23, 59, 0, 0);
  return expiresAt;
}

function resolvePostLoginRoute(nextValue: FormDataEntryValue | null) {
  if (typeof nextValue !== "string") {
    return "/dashboard" as Route;
  }

  const trimmed = nextValue.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/dashboard" as Route;
  }

  return trimmed as Route;
}

async function buildReviewShareDraft(input: {
  candidateId: string;
  linkType: ReviewShareLinkType;
  sponsorId?: string | null;
}) {
  const data = await getCandidateDetail(input.candidateId);

  if (!data) {
    throw new Error("Candidate detail is not available for share-link generation.");
  }

  if (input.linkType === ReviewShareLinkType.MEMO) {
    if (!data.memo) {
      throw new Error("Generate the sponsor memo before creating a share link.");
    }

    const selectedMatch = input.sponsorId
      ? data.sponsorMatches.find((match) => match.sponsor.id === input.sponsorId) ?? null
      : null;

    if (input.sponsorId && !selectedMatch) {
      throw new Error("Selected sponsor match was not found for this candidate.");
    }

    const sponsorRecommendation = selectedMatch
      ? data.recommendations.bestSponsors.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null
      : null;
    const warmPathRecommendation = selectedMatch
      ? data.recommendations.warmPaths.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null
      : null;
    const memoVariant =
      selectedMatch && data.memo
        ? buildSponsorMemoVariant({
            candidate: data.candidate,
            sponsor: selectedMatch.sponsor,
            memo: data.memo,
            claims: data.claimsByArtifact.flatMap(({ artifact, claims }) =>
              claims.map((claim) => ({
                ...claim,
                artifactTitle: artifact.title,
              })),
            ),
            bestSponsorRecommendation: sponsorRecommendation,
            warmPathRecommendation,
            nextActionRecommendation: data.recommendations.actions[0] ?? null,
            matchScore: selectedMatch.result.score,
            matchBreakdown: selectedMatch.result.breakdown,
            connectionPath: selectedMatch.connectionPath,
          })
        : null;

    const payload = buildMemoReviewSharePayload({
      kind: "memo",
      candidateName:
        memoVariant && selectedMatch
          ? `${data.candidate.fullName} · for ${selectedMatch.sponsor.fullName}`
          : data.candidate.fullName,
      summary: memoVariant?.summary ?? data.memo.summary,
      rationale: memoVariant?.rationale ?? data.memo.rationale,
      strengths: memoVariant?.strengths ?? data.memo.strengthsList,
      risks: memoVariant?.risks ?? data.memo.risksList,
      recommendedAction: memoVariant?.recommendedAction ?? data.memo.recommendedAction,
      status: data.memo.status,
      sponsorLabel: selectedMatch?.sponsor.fullName ?? null,
      sponsorMeta: selectedMatch ? `${selectedMatch.sponsor.title} · ${selectedMatch.sponsor.organization}` : null,
    });

    return {
      sponsorId: selectedMatch?.sponsor.id ?? null,
      title: selectedMatch
        ? `Shared memo · ${data.candidate.fullName} · ${selectedMatch.sponsor.fullName}`
        : `Shared memo · ${data.candidate.fullName}`,
      payload,
    };
  }

  const selectedMatch =
    data.sponsorMatches.find((match) => match.sponsor.id === input.sponsorId) ?? data.sponsorMatches[0] ?? null;

  if (!data.memo || !selectedMatch) {
    throw new Error("Packet sharing requires both a sponsor memo and at least one sponsor match.");
  }

  const sponsorRecommendation =
    data.recommendations.bestSponsors.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null;
  const warmPathRecommendation =
    data.recommendations.warmPaths.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null;
  const nextAction = data.recommendations.actions[0] ?? null;
  const variant = buildSponsorMemoVariant({
    candidate: data.candidate,
    sponsor: selectedMatch.sponsor,
    memo: data.memo,
    claims: data.claimsByArtifact.flatMap(({ artifact, claims }) =>
      claims.map((claim) => ({
        ...claim,
        artifactTitle: artifact.title,
      })),
    ),
    bestSponsorRecommendation: sponsorRecommendation,
    warmPathRecommendation,
    nextActionRecommendation: nextAction,
    matchScore: selectedMatch.result.score,
    matchBreakdown: selectedMatch.result.breakdown,
    connectionPath: selectedMatch.connectionPath,
  });

  const payload = buildPacketReviewSharePayload({
    kind: "packet",
    candidateName: data.candidate.fullName,
    candidateHeadline: data.candidate.headline,
    candidateRegion: data.candidate.region,
    sponsorName: selectedMatch.sponsor.fullName,
    sponsorTitle: selectedMatch.sponsor.title,
    sponsorOrganization: selectedMatch.sponsor.organization,
    readinessScore: data.readiness.score,
    matchScore: selectedMatch.result.score,
    fitBreakdown: selectedMatch.result.breakdown,
    memoSummary: variant.summary,
    sponsorAngle: variant.rationale,
    recommendedAsk:
      sponsorRecommendation?.actionSuggestion ?? nextAction?.actionSuggestion ?? data.memo.recommendedAction,
    recommendedAction: variant.recommendedAction,
    warmPath: selectedMatch.connectionPath,
    warmPathNote:
      warmPathRecommendation?.actionSuggestion ?? "No additional proof gap has been recorded for this sponsor path.",
    strengths: variant.strengths,
    risks: variant.risks,
    evidence: variant.selectedClaims,
    flaggedItems: data.flaggedReviewItems.slice(0, 6),
  });

  return {
    sponsorId: selectedMatch.sponsor.id,
    title: `Shared packet · ${data.candidate.fullName} · ${selectedMatch.sponsor.fullName}`,
    payload,
  };
}

function normalizePilotShareHealthStatus(status: "healthy" | "degraded" | "unhealthy" | "down") {
  return status === "unhealthy" ? "down" : status;
}

async function buildPilotReviewShareDraft(input: {
  linkType: PilotReviewShareLinkType;
}) {
  if (input.linkType === PilotReviewShareLinkType.REPORT) {
    const data = await getPilotProofReportData();
    const payload = buildPilotReportSharePayload({
      kind: "pilot_report",
      title: data.report.title,
      templateLabel: data.template.label,
      healthStatus: normalizePilotShareHealthStatus(data.health.status),
      pilotProfile: {
        pilotName: data.pilotProfile.pilotName,
        designPartnerName: data.pilotProfile.designPartnerName,
        programName: data.pilotProfile.programName,
        primaryContactName: data.pilotProfile.primaryContactName,
        primaryContactEmail: data.pilotProfile.primaryContactEmail,
        packSummary: data.pilotProfile.packSummary,
      },
      report: data.report,
    });

    return {
      title: `Shared pilot proof report · ${data.pilotProfile.designPartnerName}`,
      payload,
    };
  }

  if (input.linkType === PilotReviewShareLinkType.PACK) {
    const data = await getPilotPackData();
    const payload = buildPilotPackSharePayload({
      kind: "pilot_pack",
      title: data.buyerPack.title,
      templateLabel: data.template.label,
      healthStatus: normalizePilotShareHealthStatus(data.health.status),
      pilotProfile: {
        pilotName: data.pilotProfile.pilotName,
        designPartnerName: data.pilotProfile.designPartnerName,
        programName: data.pilotProfile.programName,
        primaryContactName: data.pilotProfile.primaryContactName,
        primaryContactEmail: data.pilotProfile.primaryContactEmail,
        packSummary: data.pilotProfile.packSummary,
      },
      buyerPack: data.buyerPack,
    });

    return {
      title: `Shared pilot buyer pack · ${data.pilotProfile.designPartnerName}`,
      payload,
    };
  }

  if (input.linkType === PilotReviewShareLinkType.COMMERCIAL) {
    const data = await getCommercialProofData();
    const payload = buildPilotCommercialSharePayload({
      kind: "pilot_commercial",
      title: `Commercial proof · ${data.settings.pilotProfile.designPartnerName}`,
      templateLabel: data.template.label,
      healthStatus: normalizePilotShareHealthStatus(data.health.status),
      pilotProfile: {
        pilotName: data.settings.pilotProfile.pilotName,
        designPartnerName: data.settings.pilotProfile.designPartnerName,
        programName: data.settings.pilotProfile.programName,
        primaryContactName: data.settings.pilotProfile.primaryContactName,
        primaryContactEmail: data.settings.pilotProfile.primaryContactEmail,
        packSummary: data.settings.pilotProfile.packSummary,
      },
      bestBuyerMotion: {
        audience: data.template.audience,
        whyItFits: data.template.whyItFits,
        firstPilotGoal: data.template.firstPilotGoal,
      },
      readiness: data.readiness,
      buyerObjections: data.template.buyerObjections,
      milestones: data.template.commercialMilestones,
    });

    return {
      title: `Shared commercial proof · ${data.settings.pilotProfile.designPartnerName}`,
      payload,
    };
  }

  if (input.linkType === PilotReviewShareLinkType.ONBOARDING) {
    const data = await getPilotLaunchData();
    const payload = buildPilotOnboardingSharePayload({
      kind: "pilot_onboarding",
      title: `Pilot launch · ${data.settings.pilotProfile.designPartnerName}`,
      templateLabel: data.template.label,
      healthStatus: normalizePilotShareHealthStatus(data.health.status),
      pilotProfile: {
        pilotName: data.settings.pilotProfile.pilotName,
        designPartnerName: data.settings.pilotProfile.designPartnerName,
        programName: data.settings.pilotProfile.programName,
        primaryContactName: data.settings.pilotProfile.primaryContactName,
        primaryContactEmail: data.settings.pilotProfile.primaryContactEmail,
        packSummary: data.settings.pilotProfile.packSummary,
        targetLaunchDateLabel: data.settings.pilotProfile.targetLaunchDate
          ? formatDate(data.settings.pilotProfile.targetLaunchDate)
          : "Not scheduled",
      },
      currentSlate: {
        candidateCount: data.dashboard.candidates.length,
        sponsorReadyCount: data.dashboard.sponsorReadyQueue.length,
      },
      launchPosture: {
        guidedDemoMode: data.settings.guidedDemoMode,
        blindReviewMode: data.settings.blindReviewMode,
        strictEvidenceMode: data.settings.strictEvidenceMode,
        requireOutboundApproval: data.settings.requireOutboundApproval,
      },
      bestBuyerMotion: {
        audience: data.template.audience,
        firstPilotGoal: data.template.firstPilotGoal,
      },
      designPartnerCommitments: data.template.designPartnerCommitments,
      launchWorkstream: data.settings.pilotLaunchWorkstream,
      onboardingChecklist: data.template.onboardingChecklist,
      stakeholderMap: data.template.stakeholderMap,
      calibrationPlaybook: data.template.calibrationPlaybook,
      buyerDeliverables: data.template.buyerDeliverables,
    });

    return {
      title: `Shared pilot launch brief · ${data.settings.pilotProfile.designPartnerName}`,
      payload,
    };
  }

  const data = await getExecutiveRoiData();
  const payload = buildPilotRoiSharePayload({
    kind: "pilot_roi",
    title: `Executive ROI · ${data.settings.pilotProfile.designPartnerName}`,
    templateLabel: data.template.label,
    templateSummary: data.template.summary,
    healthStatus: normalizePilotShareHealthStatus(data.health.status),
    pilotProfile: {
      pilotName: data.settings.pilotProfile.pilotName,
      designPartnerName: data.settings.pilotProfile.designPartnerName,
      programName: data.settings.pilotProfile.programName,
      primaryContactName: data.settings.pilotProfile.primaryContactName,
      primaryContactEmail: data.settings.pilotProfile.primaryContactEmail,
      packSummary: data.settings.pilotProfile.packSummary,
    },
    modeled: data.roiModel.modeled,
    launchPosture: {
      blindReviewMode: data.settings.blindReviewMode,
      strictEvidenceMode: data.settings.strictEvidenceMode,
      requireOutboundApproval: data.settings.requireOutboundApproval,
    },
    baseline: data.pilotData.baseline
      ? {
          capturedAtLabel: data.pilotData.baseline.capturedAtLabel,
          authorLabel: data.pilotData.baseline.authorLabel,
          note: data.pilotData.baseline.note,
          averageReviewMinutes: data.pilotData.baseline.averageReviewMinutes,
          sampledReviewCount: data.pilotData.baseline.sampledReviewCount,
        }
      : null,
    observedDeltas: data.pilotData.observedDeltas,
    recentSnapshots: data.pilotData.recentSnapshots.map((snapshot) => ({
      id: snapshot.id,
      title: snapshot.title,
      snapshotType: snapshot.snapshotType,
      capturedAtLabel: snapshot.capturedAtLabel,
      authorLabel: snapshot.authorLabel,
      note: snapshot.note,
      averageReviewMinutes: snapshot.averageReviewMinutes,
      sampledReviewCount: snapshot.sampledReviewCount,
      memoCoverage: snapshot.memoCoverage,
      sponsorReadyCoverage: snapshot.sponsorReadyCoverage,
      workflowPressure: snapshot.workflowPressure,
    })),
    assumptions: data.roiModel.assumptions,
    health: {
      checkedAtLabel: data.healthCheckedAtLabel,
      checks: data.health.checks,
    },
  });

  return {
    title: `Shared executive ROI · ${data.settings.pilotProfile.designPartnerName}`,
    payload,
  };
}

async function requireStoredFileAccess(
  storedFileId: string | undefined,
  organizationId: string,
  candidateId: string,
) {
  if (!storedFileId) {
    return null;
  }

  return getStoredFileAccessRecord({
    storedFileId,
    organizationId,
    candidateId,
  });
}

async function requireArtifactReplacementAccess(
  replacesArtifactId: string | undefined,
  organizationId: string,
  candidateId: string,
) {
  if (!replacesArtifactId) {
    return null;
  }

  return prisma.artifact.findFirst({
    where: {
      id: replacesArtifactId,
      candidateId,
      isCurrentVersion: true,
      candidate: {
        organizationId,
      },
    },
    select: {
      id: true,
      title: true,
      versionNumber: true,
      artifactType: true,
      sourceLabel: true,
    },
  });
}

async function createVersionedArtifact(
  transaction: Prisma.TransactionClient,
  input: {
    candidateId: string;
    artifactType: ArtifactType;
    title: string;
    rawText: string;
    sourceLabel: string;
    fileName?: string | null;
    storedFileId?: string | null;
    replacesArtifact?: {
      id: string;
      versionNumber: number;
    } | null;
  },
) {
  if (input.replacesArtifact) {
    await transaction.artifact.update({
      where: { id: input.replacesArtifact.id },
      data: {
        isCurrentVersion: false,
      },
    });
  }

  return transaction.artifact.create({
    data: {
      candidateId: input.candidateId,
      artifactType: input.artifactType,
      title: input.title.trim(),
      rawText: input.rawText.trim(),
      sourceLabel: input.sourceLabel.trim(),
      fileName: input.fileName?.trim() || null,
      storedFileId: input.storedFileId ?? null,
      supersedesArtifactId: input.replacesArtifact?.id ?? null,
      versionNumber: (input.replacesArtifact?.versionNumber ?? 0) + 1,
      isCurrentVersion: true,
    },
  });
}

function revalidateSavedViewPage(page: SavedViewPage) {
  if (page === SavedViewPage.CANDIDATES) {
    revalidatePath("/candidates");
    return;
  }

  if (page === SavedViewPage.TASKS) {
    revalidatePath("/tasks");
    return;
  }

  if (page === SavedViewPage.PIPELINE) {
    revalidatePath("/pipeline");
    return;
  }

  if (page === SavedViewPage.ALERTS) {
    revalidatePath("/alerts");
  }
}

export async function createCandidateAction(input: z.infer<typeof candidateSchema>) {
  const session = await requireActionSession();
  const parsed = candidateSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Candidate profile is incomplete." };
  }

  const candidate = await prisma.candidate.create({
    data: {
      ...parsed.data,
      organizationId: session.organizationId,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: candidate.id,
    label: "Profile created",
    summary: "Initial intake profile created and ready for evidence collection.",
  });
  await evaluateCandidateAutomation(candidate.id);

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath("/alerts");

  return { success: true, id: candidate.id };
}

export async function createArtifactAction(
  candidateId: string,
  input: z.infer<typeof artifactSchema>,
) {
  const session = await requireActionSession();
  const parsed = artifactSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Artifact text is too short or missing." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  const storedFile = await requireStoredFileAccess(
    parsed.data.storedFileId,
    session.organizationId,
    candidateId,
  );

  if (parsed.data.storedFileId && !storedFile) {
    return { success: false, error: "Stored file is not available for this candidate." };
  }

  const replacesArtifact = await requireArtifactReplacementAccess(
    parsed.data.replacesArtifactId,
    session.organizationId,
    candidateId,
  );

  if (parsed.data.replacesArtifactId && !replacesArtifact) {
    return { success: false, error: "The selected artifact version is no longer available to replace." };
  }

  await prisma.$transaction(async (transaction) => {
    await createVersionedArtifact(transaction, {
      candidateId,
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
      rawText: parsed.data.rawText,
      sourceLabel: parsed.data.sourceLabel,
      fileName: parsed.data.fileName,
      storedFileId: storedFile?.id ?? null,
      replacesArtifact,
    });
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: replacesArtifact ? "Artifact version replaced" : "Artifact added",
    summary: replacesArtifact
      ? `A new version replaced ${replacesArtifact.title} in the underwriting file.`
      : "A new evidence artifact was added to strengthen the underwriting file.",
  });
  await evaluateCandidateAutomation(candidateId);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");

  return { success: true };
}

export async function extractEvidenceAction(candidateId: string) {
  const session = await requireActionSession();
  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if ((await resolveBackgroundJobsMode()) === "queue") {
    const job = await enqueueBackgroundJob({
      organizationId: session.organizationId,
      candidateId,
      requestedById: session.user.id,
      jobType: BackgroundJobType.EXTRACT_EVIDENCE,
      title: "Extract evidence claims",
      payload: { candidateId },
      dedupeKey: `extract-evidence:${candidateId}`,
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/settings");

    return { success: true, queued: true, jobId: job.id };
  }

  try {
    await extractCandidateEvidence(candidateId);
    await captureCandidateProgressSnapshot({
      candidateId,
      label: "Evidence extracted",
      summary: "Structured evidence claims were refreshed from the latest artifact set.",
    });
    await evaluateCandidateAutomation(candidateId);
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/candidates");
    revalidatePath("/alerts");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Evidence extraction failed.",
    };
  }
}

export async function generateMemoAction(candidateId: string) {
  const session = await requireActionSession();
  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if ((await resolveBackgroundJobsMode()) === "queue") {
    await prisma.sponsorMemo.upsert({
      where: { candidateId },
      update: {
        status: MemoStatus.PROCESSING,
      },
      create: {
        candidateId,
        summary: "Memo generation in progress.",
        rationale: "The system is assembling a sponsor-ready memo from the current evidence set.",
        strengths: "",
        risks: "",
        recommendedAction: "Generating recommendation.",
        memoMarkdown: "# Processing",
        status: MemoStatus.PROCESSING,
      },
    });

    const job = await enqueueBackgroundJob({
      organizationId: session.organizationId,
      candidateId,
      requestedById: session.user.id,
      jobType: BackgroundJobType.GENERATE_MEMO,
      title: "Generate sponsor memo",
      payload: { candidateId },
      dedupeKey: `generate-memo:${candidateId}`,
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/memos/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/settings");

    return { success: true, queued: true, jobId: job.id };
  }

  try {
    await prisma.sponsorMemo.upsert({
      where: { candidateId },
      update: {
        status: MemoStatus.PROCESSING,
      },
      create: {
        candidateId,
        summary: "Memo generation in progress.",
        rationale: "The system is assembling a sponsor-ready memo from the current evidence set.",
        strengths: "",
        risks: "",
        recommendedAction: "Generating recommendation.",
        memoMarkdown: "# Processing",
        status: MemoStatus.PROCESSING,
      },
    });

    await generateCandidateMemo(candidateId);
    await captureCandidateProgressSnapshot({
      candidateId,
      label: "Sponsor memo refreshed",
      summary: "The memo and cited rationale were updated from the current evidence base.",
    });
    await evaluateCandidateAutomation(candidateId);
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/memos/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/alerts");
    return { success: true };
  } catch (error) {
    await prisma.sponsorMemo.updateMany({
      where: { candidateId },
      data: {
        status: MemoStatus.NEEDS_REVIEW,
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Memo generation failed.",
    };
  }
}

export async function generateRecommendationsAction(candidateId: string) {
  const session = await requireActionSession();
  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if ((await resolveBackgroundJobsMode()) === "queue") {
    const job = await enqueueBackgroundJob({
      organizationId: session.organizationId,
      candidateId,
      requestedById: session.user.id,
      jobType: BackgroundJobType.GENERATE_RECOMMENDATIONS,
      title: "Generate recommendations",
      payload: { candidateId },
      dedupeKey: `generate-recommendations:${candidateId}`,
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/pipeline");
    revalidatePath("/settings");

    return { success: true, queued: true, jobId: job.id };
  }

  try {
    await generateCandidateRecommendations(candidateId);
    await syncCandidateSponsorPipeline(candidateId);
    await captureCandidateProgressSnapshot({
      candidateId,
      label: "Recommendations refreshed",
      summary: "Sponsor targets, next advocacy actions, and warm paths were recomputed.",
    });
    await evaluateCandidateAutomation(candidateId);
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/sponsors");
    revalidatePath("/alerts");
    revalidatePath("/pipeline");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Recommendation generation failed.",
    };
  }
}

export async function generateOpportunityBriefsAction(candidateId: string) {
  const session = await requireActionSession();
  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if ((await resolveBackgroundJobsMode()) === "queue") {
    const job = await enqueueBackgroundJob({
      organizationId: session.organizationId,
      candidateId,
      requestedById: session.user.id,
      jobType: BackgroundJobType.GENERATE_BRIEFS,
      title: "Generate opportunity briefs",
      payload: { candidateId },
      dedupeKey: `generate-briefs:${candidateId}`,
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/briefs/${candidateId}`);
    revalidatePath("/briefs");
    revalidatePath("/dashboard");
    revalidatePath("/settings");

    return { success: true, queued: true, jobId: job.id };
  }

  try {
    await generateCandidateOpportunityBriefs(candidateId);
    await syncCandidateSponsorPipeline(candidateId);
    await captureCandidateProgressSnapshot({
      candidateId,
      label: "Opportunity briefs prepared",
      summary: "Sponsor-specific asks were packaged into internal opportunity briefs.",
    });
    await evaluateCandidateAutomation(candidateId);
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/briefs/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/briefs");
    revalidatePath("/sponsors");
    revalidatePath("/alerts");
    revalidatePath("/pipeline");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Opportunity brief generation failed.",
    };
  }
}

export async function reviewEvidenceClaimAction(
  claimId: string,
  input: z.infer<typeof reviewSchema>,
) {
  const session = await requireActionSession();
  const parsed = reviewSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Review state is invalid." };
  }

  const claim = await prisma.evidenceClaim.findFirst({
    where: {
      id: claimId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: { candidateId: true },
  });

  if (!claim) {
    return { success: false, error: "Evidence claim not found." };
  }

  await prisma.evidenceClaim.update({
    where: { id: claimId },
    data: {
      reviewStatus: parsed.data.status,
      reviewNote: parsed.data.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  await evaluateCandidateAutomation(claim.candidateId);

  revalidatePath(`/candidates/${claim.candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");

  return { success: true };
}

export async function reviewRecommendationAction(
  recommendationId: string,
  input: z.infer<typeof reviewSchema>,
) {
  const session = await requireActionSession();
  const parsed = reviewSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Review state is invalid." };
  }

  const recommendation = await prisma.recommendation.findFirst({
    where: {
      id: recommendationId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: { candidateId: true, sponsorId: true },
  });

  if (!recommendation) {
    return { success: false, error: "Recommendation not found." };
  }

  await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      reviewStatus: parsed.data.status,
      reviewNote: parsed.data.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  await evaluateCandidateAutomation(recommendation.candidateId);

  revalidatePath(`/candidates/${recommendation.candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");

  if (recommendation.sponsorId) {
    revalidatePath(`/sponsors/${recommendation.sponsorId}`);
  }

  revalidatePath("/sponsors");

  return { success: true };
}

export async function bulkReviewAction(input: z.infer<typeof bulkReviewSchema>) {
  const session = await requireActionSession();
  const parsed = bulkReviewSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Bulk review selection is invalid." };
  }

  const itemIds = Array.from(new Set(parsed.data.itemIds));

  if (parsed.data.entityType === "claim") {
    const claims = await prisma.evidenceClaim.findMany({
      where: {
        id: {
          in: itemIds,
        },
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        id: true,
        candidateId: true,
      },
    });

    if (claims.length !== itemIds.length) {
      return { success: false, error: "One or more evidence claims could not be reviewed." };
    }

    await prisma.evidenceClaim.updateMany({
      where: {
        id: {
          in: itemIds,
        },
      },
      data: {
        reviewStatus: parsed.data.status,
        reviewNote: parsed.data.note?.trim() || null,
        reviewedAt: new Date(),
      },
    });

    for (const candidateId of Array.from(new Set(claims.map((claim) => claim.candidateId)))) {
      await evaluateCandidateAutomation(candidateId);
      revalidatePath(`/candidates/${candidateId}`);
    }
  } else {
    const recommendations = await prisma.recommendation.findMany({
      where: {
        id: {
          in: itemIds,
        },
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        id: true,
        candidateId: true,
        sponsorId: true,
      },
    });

    if (recommendations.length !== itemIds.length) {
      return { success: false, error: "One or more recommendations could not be reviewed." };
    }

    await prisma.recommendation.updateMany({
      where: {
        id: {
          in: itemIds,
        },
      },
      data: {
        reviewStatus: parsed.data.status,
        reviewNote: parsed.data.note?.trim() || null,
        reviewedAt: new Date(),
      },
    });

    for (const candidateId of Array.from(new Set(recommendations.map((recommendation) => recommendation.candidateId)))) {
      await evaluateCandidateAutomation(candidateId);
      revalidatePath(`/candidates/${candidateId}`);
    }

    for (const sponsorId of Array.from(
      new Set(
        recommendations
          .map((recommendation) => recommendation.sponsorId)
          .filter((sponsorId): sponsorId is string => Boolean(sponsorId)),
      ),
    )) {
      revalidatePath(`/sponsors/${sponsorId}`);
    }
  }

  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath("/sponsors");

  return { success: true };
}

export async function createCandidateNoteAction(
  candidateId: string,
  input: z.infer<typeof candidateNoteSchema>,
) {
  const session = await requireActionSession();
  const parsed = candidateNoteSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Note details are incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  await prisma.candidateNote.create({
    data: {
      candidateId,
      authorUserId: session.user.id,
      noteType: parsed.data.noteType,
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content.trim(),
    },
  });

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function createCandidateDecisionAction(
  candidateId: string,
  input: z.infer<typeof candidateDecisionSchema>,
) {
  const session = await requireActionSession();
  const parsed = candidateDecisionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Decision details are incomplete." };
  }

  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId: session.organizationId,
    },
    select: {
      id: true,
      currentStage: true,
    },
  });

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  await prisma.candidateDecision.create({
    data: {
      candidateId,
      decidedById: session.user.id,
      decisionType: parsed.data.decisionType,
      summary: parsed.data.summary.trim(),
      rationale: parsed.data.rationale.trim(),
      stageAtDecision: candidate.currentStage,
    },
  });

  await evaluateCandidateAutomation(candidateId);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/audits");
  revalidatePath("/analytics");

  return { success: true };
}

export async function createSavedViewAction(input: z.infer<typeof savedViewSchema>) {
  const session = await requireActionSession();
  const parsed = savedViewSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Saved queue details are incomplete." };
  }

  const queryString = normalizeSavedViewQueryString(parsed.data.queryString);

  if (!queryString) {
    return { success: false, error: "Add at least one filter before saving a queue." };
  }

  await prisma.savedView.upsert({
    where: {
      organizationId_page_title: {
        organizationId: session.organizationId,
        page: parsed.data.page,
        title: parsed.data.title.trim(),
      },
    },
    update: {
      description: parsed.data.description?.trim() || null,
      queryString,
      createdById: session.user.id,
    },
    create: {
      organizationId: session.organizationId,
      createdById: session.user.id,
      page: parsed.data.page,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      queryString,
    },
  });

  revalidateSavedViewPage(parsed.data.page);

  return { success: true };
}

export async function deleteSavedViewAction(savedViewId: string) {
  const session = await requireActionSession();
  const savedView = await prisma.savedView.findFirst({
    where: {
      id: savedViewId,
      organizationId: session.organizationId,
    },
    select: {
      id: true,
      page: true,
    },
  });

  if (!savedView) {
    return { success: false, error: "Saved queue not found." };
  }

  await prisma.savedView.delete({
    where: { id: savedView.id },
  });

  revalidateSavedViewPage(savedView.page);

  return { success: true };
}

export async function setAiModeAction(mode: "mock" | "live") {
  await requireActionSession(MembershipRole.ADMIN);
  await prisma.appSetting.upsert({
    where: { key: "AI_MODE" },
    update: { value: mode },
    create: { key: "AI_MODE", value: mode },
  });

  await prisma.appSetting.upsert({
    where: { key: "AI_RUNTIME_NOTE" },
    update: {
      value:
        mode === "live"
          ? "Live mode requested. The next AI task will use OpenAI if a key is available, otherwise it will fall back to mock mode."
          : "Using deterministic mock mode.",
    },
    create: {
      key: "AI_RUNTIME_NOTE",
      value:
        mode === "live"
          ? "Live mode requested. The next AI task will use OpenAI if a key is available, otherwise it will fall back to mock mode."
          : "Using deterministic mock mode.",
    },
  });

  revalidatePath("/settings");

  return { success: true };
}

function buildCrmModeRuntimeNote(mode: z.infer<typeof crmModeSchema>) {
  if (mode === "webhook") {
    return "Webhook CRM sync requested. The next sync will use CRM_WEBHOOK_URL if configured, otherwise it will fall back to the local outbox.";
  }

  if (mode === "hubspot") {
    return "HubSpot CRM sync requested. Native sync will use HUBSPOT_ACCESS_TOKEN if configured, otherwise it will fall back to the local outbox.";
  }

  if (mode === "salesforce") {
    return "Salesforce CRM sync requested. Native sync will use SALESFORCE_INSTANCE_URL and SALESFORCE_ACCESS_TOKEN if configured, otherwise it will fall back to the local outbox.";
  }

  if (mode === "airtable") {
    return "Airtable sync requested. Native sync will use AIRTABLE_ACCESS_TOKEN and AIRTABLE_BASE_ID if configured, otherwise it will fall back to the local outbox.";
  }

  return "Using local mock CRM sync.";
}

function buildEmailModeRuntimeNote(mode: z.infer<typeof emailSendModeSchema>) {
  if (mode === "webhook") {
    return "Webhook email mode requested. The next send will use EMAIL_SEND_WEBHOOK_URL if configured, otherwise it will fall back to the local outbox.";
  }

  if (mode === "gmail") {
    return "Gmail delivery requested. Native delivery will use Gmail OAuth credentials if configured, otherwise it will fall back to the local outbox.";
  }

  if (mode === "outlook") {
    return "Outlook delivery requested. Native delivery will use Microsoft OAuth credentials if configured, otherwise it will fall back to the local outbox.";
  }

  return "Using local mock email delivery.";
}

export async function setCrmModeAction(mode: z.infer<typeof crmModeSchema>) {
  await requireActionSession(MembershipRole.ADMIN);
  const parsed = crmModeSchema.safeParse(mode);

  if (!parsed.success) {
    return { success: false, error: "CRM mode is invalid." };
  }

  await prisma.appSetting.upsert({
    where: { key: "CRM_SYNC_MODE" },
    update: { value: parsed.data },
    create: { key: "CRM_SYNC_MODE", value: parsed.data },
  });

  await prisma.appSetting.upsert({
    where: { key: "CRM_RUNTIME_NOTE" },
    update: { value: buildCrmModeRuntimeNote(parsed.data) },
    create: {
      key: "CRM_RUNTIME_NOTE",
      value: buildCrmModeRuntimeNote(parsed.data),
    },
  });

  revalidatePath("/settings");

  return { success: true };
}

export async function setCrmFieldMappingAction(input: z.infer<typeof crmFieldMappingSchema>) {
  const session = await requireActionSession(MembershipRole.ADMIN);
  const parsed = crmFieldMappingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "CRM field mapping is incomplete." };
  }

  const normalized = normalizeCrmFieldMappingInput(parsed.data.value, parsed.data.provider);

  if (!normalized.success) {
    return { success: false, error: normalized.error };
  }

  const key = getCrmFieldMappingSettingKey(parsed.data.provider);

  await prisma.appSetting.upsert({
    where: { key },
    update: { value: normalized.serialized },
    create: { key, value: normalized.serialized },
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "settings.crm_field_mapping.updated",
    title: `CRM field mapping updated · ${parsed.data.provider}`,
    detail: "Provider-specific field mapping was updated for outbound CRM sync payloads.",
  });

  revalidatePath("/settings");

  return { success: true };
}

export async function setEmailSendModeAction(mode: z.infer<typeof emailSendModeSchema>) {
  await requireActionSession(MembershipRole.ADMIN);
  const parsed = emailSendModeSchema.safeParse(mode);

  if (!parsed.success) {
    return { success: false, error: "Email mode is invalid." };
  }

  await prisma.appSetting.upsert({
    where: { key: "EMAIL_SEND_MODE" },
    update: { value: parsed.data },
    create: { key: "EMAIL_SEND_MODE", value: parsed.data },
  });

  await prisma.appSetting.upsert({
    where: { key: "EMAIL_RUNTIME_NOTE" },
    update: { value: buildEmailModeRuntimeNote(parsed.data) },
    create: {
      key: "EMAIL_RUNTIME_NOTE",
      value: buildEmailModeRuntimeNote(parsed.data),
    },
  });

  revalidatePath("/settings");

  return { success: true };
}

export async function setBackgroundJobsModeAction(mode: "inline" | "queue") {
  await requireActionSession(MembershipRole.ADMIN);
  await prisma.appSetting.upsert({
    where: { key: "BACKGROUND_JOBS_MODE" },
    update: { value: mode },
    create: { key: "BACKGROUND_JOBS_MODE", value: mode },
  });

  await prisma.appSetting.upsert({
    where: { key: "BACKGROUND_JOBS_RUNTIME_NOTE" },
    update: {
      value:
        mode === "queue"
          ? "Queue mode requested. Use the worker script or /api/jobs/run to drain queued work."
          : "Background work runs inline inside operator actions.",
    },
    create: {
      key: "BACKGROUND_JOBS_RUNTIME_NOTE",
      value:
        mode === "queue"
          ? "Queue mode requested. Use the worker script or /api/jobs/run to drain queued work."
          : "Background work runs inline inside operator actions.",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function setBlindReviewModeAction(enabled: boolean) {
  await requireActionSession(MembershipRole.ADMIN);
  await setBlindReviewMode(enabled);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath("/candidates/compare");

  return { success: true };
}

export async function setStrictEvidenceModeAction(enabled: boolean) {
  await requireActionSession(MembershipRole.ADMIN);
  await setStrictEvidenceMode(enabled);

  await prisma.appSetting.upsert({
    where: { key: "AI_RUNTIME_NOTE" },
    update: {
      value: enabled
        ? "Strict evidence mode is on. Memo and recommendation outputs will be pushed into review when proof is weak or unsupported."
        : "Strict evidence mode is off. Outputs still remain explainable, but unsupported statements will not automatically downgrade status.",
    },
    create: {
      key: "AI_RUNTIME_NOTE",
      value: enabled
        ? "Strict evidence mode is on. Memo and recommendation outputs will be pushed into review when proof is weak or unsupported."
        : "Strict evidence mode is off. Outputs still remain explainable, but unsupported statements will not automatically downgrade status.",
    },
  });

  revalidatePath("/settings");

  return { success: true };
}

export async function setRequireOutboundApprovalAction(enabled: boolean) {
  await requireActionSession(MembershipRole.ADMIN);
  await setRequireOutboundApproval(enabled);

  revalidatePath("/settings");
  revalidatePath("/outreach");
  revalidatePath("/pilot");
  revalidatePath("/roi");

  return { success: true };
}

export async function setBlockSponsorFacingPiiAction(enabled: boolean) {
  await requireActionSession(MembershipRole.ADMIN);
  await setBlockSponsorFacingPii(enabled);

  revalidatePath("/settings");
  revalidatePath("/candidates");
  revalidatePath("/outreach");
  revalidatePath("/briefs");
  revalidatePath("/memos");

  return { success: true };
}

export async function setPilotTemplateAction(template: PilotTemplateKey) {
  await requireActionSession(MembershipRole.ADMIN);
  const parsed = pilotTemplateSchema.safeParse(template);

  if (!parsed.success) {
    return { success: false, error: "Pilot template is invalid." };
  }

  await persistPilotTemplate(parsed.data);

  revalidatePath("/settings");
  revalidatePath("/pilot");
  revalidatePath("/roi");

  return { success: true };
}

export async function setGuidedDemoModeAction(enabled: boolean) {
  await requireActionSession(MembershipRole.ADMIN);

  await prisma.appSetting.upsert({
    where: { key: "GUIDED_DEMO_MODE" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "GUIDED_DEMO_MODE", value: enabled ? "true" : "false" },
  });

  await prisma.appSetting.upsert({
    where: { key: "PILOT_RUNTIME_NOTE" },
    update: {
      value: enabled
        ? "Guided demo mode is enabled. Pilot and ROI surfaces will prioritize the recommended walkthrough."
        : "Guided demo mode is disabled. Pilot and ROI surfaces remain available without a forced walkthrough.",
    },
    create: {
      key: "PILOT_RUNTIME_NOTE",
      value: enabled
        ? "Guided demo mode is enabled. Pilot and ROI surfaces will prioritize the recommended walkthrough."
        : "Guided demo mode is disabled. Pilot and ROI surfaces remain available without a forced walkthrough.",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/pilot");
  revalidatePath("/roi");

  return { success: true };
}

export async function capturePilotMetricSnapshotAction(snapshotType: "baseline" | "checkpoint") {
  const session = await requireActionSession();

  await capturePilotMetricSnapshot({
    organizationId: session.organizationId,
    capturedById: session.userId,
    snapshotType:
      snapshotType === "baseline" ? PilotMetricSnapshotType.BASELINE : PilotMetricSnapshotType.CHECKPOINT,
  });

  revalidatePath("/roi");
  revalidatePath("/pilot");
  revalidatePath("/settings");

  return { success: true };
}

export async function requestCommitteeReviewAction(
  candidateId: string,
  input: z.infer<typeof committeeReviewRequestSchema>,
) {
  const session = await requireActionSession();
  const parsed = committeeReviewRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Committee review details are incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  await prisma.committeeReview.create({
    data: {
      candidateId,
      createdById: session.user.id,
      chairUserId: parsed.data.chairUserId?.trim() || null,
      status: CommitteeReviewStatus.OPEN,
      title: parsed.data.title,
      summary: parsed.data.summary,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "Committee review opened",
    summary: parsed.data.summary,
  });

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/candidates/compare?ids=${candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function castCommitteeVoteAction(
  reviewId: string,
  input: z.infer<typeof committeeVoteSchema>,
) {
  const session = await requireActionSession();
  const parsed = committeeVoteSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Committee vote is incomplete." };
  }

  const review = await prisma.committeeReview.findFirst({
    where: {
      id: reviewId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
      status: true,
      title: true,
    },
  });

  if (!review) {
    return { success: false, error: "Committee review not found." };
  }

  if (review.status === CommitteeReviewStatus.FINALIZED) {
    return { success: false, error: "Committee review is already finalized." };
  }

  await prisma.committeeReviewVote.upsert({
    where: {
      committeeReviewId_userId: {
        committeeReviewId: reviewId,
        userId: session.user.id,
      },
    },
    update: {
      decision: parsed.data.decision,
      rationale: parsed.data.rationale,
    },
    create: {
      committeeReviewId: reviewId,
      userId: session.user.id,
      decision: parsed.data.decision,
      rationale: parsed.data.rationale,
    },
  });

  await prisma.committeeReview.update({
    where: { id: reviewId },
    data: {
      status: CommitteeReviewStatus.VOTING,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: review.candidateId,
    label: "Committee vote recorded",
    summary: `${COMMITTEE_VOTE_LABELS[parsed.data.decision]} vote recorded for ${review.title}.`,
  });

  revalidatePath(`/candidates/${review.candidateId}`);
  revalidatePath(`/candidates/compare?ids=${review.candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function finalizeCommitteeReviewAction(
  reviewId: string,
  input: z.infer<typeof committeeFinalizeSchema>,
) {
  const session = await requireActionSession();
  const parsed = committeeFinalizeSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Final committee decision is incomplete." };
  }

  const review = await prisma.committeeReview.findFirst({
    where: {
      id: reviewId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
      title: true,
    },
  });

  if (!review) {
    return { success: false, error: "Committee review not found." };
  }

  await prisma.committeeReview.update({
    where: { id: reviewId },
    data: {
      finalDecision: parsed.data.finalDecision,
      finalNote: parsed.data.finalNote,
      status: CommitteeReviewStatus.FINALIZED,
      finalizedAt: new Date(),
      chairUserId: session.user.id,
    },
  });

  await prisma.candidateDecision.create({
    data: {
      candidateId: review.candidateId,
      decidedById: session.user.id,
      decisionType:
        parsed.data.finalDecision === CommitteeVoteDecision.ADVANCE
          ? DecisionType.ADVANCE
          : parsed.data.finalDecision === CommitteeVoteDecision.DO_NOT_ADVANCE
            ? DecisionType.DO_NOT_ADVANCE
            : parsed.data.finalDecision === CommitteeVoteDecision.REQUEST_MORE_PROOF
              ? DecisionType.NEED_MORE_PROOF
              : DecisionType.HOLD,
      summary: `Committee signoff · ${COMMITTEE_VOTE_LABELS[parsed.data.finalDecision]}`,
      rationale: parsed.data.finalNote,
      stageAtDecision: null,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: review.candidateId,
    label: "Committee review finalized",
    summary: `${review.title}. Final decision: ${COMMITTEE_VOTE_LABELS[parsed.data.finalDecision]}.`,
  });
  await evaluateCandidateAutomation(review.candidateId);

  revalidatePath(`/candidates/${review.candidateId}`);
  revalidatePath(`/candidates/compare?ids=${review.candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function requestOutboundApprovalAction(
  candidateId: string,
  input: z.infer<typeof outboundApprovalRequestSchema>,
) {
  const session = await requireActionSession();
  const parsed = outboundApprovalRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Approval details are incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  const sponsor = await prisma.sponsor.findFirst({
    where: {
      id: parsed.data.sponsorId,
      organizationId: session.organizationId,
    },
  });

  if (!sponsor) {
    return { success: false, error: "Sponsor not found in this workspace." };
  }

  await prisma.outboundApproval.upsert({
    where: {
      candidateId_sponsorId_approvalType: {
        candidateId,
        sponsorId: parsed.data.sponsorId,
        approvalType: parsed.data.approvalType,
      },
    },
    update: {
      opportunityBriefId: parsed.data.opportunityBriefId?.trim() || null,
      requestedById: session.user.id,
      reviewedById: null,
      status: OutboundApprovalStatus.PENDING,
      title: parsed.data.title,
      rationale: parsed.data.rationale,
      decisionNote: null,
      reviewedAt: null,
    },
    create: {
      candidateId,
      sponsorId: parsed.data.sponsorId,
      opportunityBriefId: parsed.data.opportunityBriefId?.trim() || null,
      requestedById: session.user.id,
      approvalType: parsed.data.approvalType,
      status: OutboundApprovalStatus.PENDING,
      title: parsed.data.title,
      rationale: parsed.data.rationale,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "Outbound approval requested",
    summary: `${parsed.data.title}. ${parsed.data.rationale}`,
  });
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId,
    sponsorId: parsed.data.sponsorId,
    targetType: AuditLogTargetType.OUTBOUND_APPROVAL,
    action: "outbound_approval.requested",
    title: parsed.data.title,
    detail: parsed.data.rationale,
    payload: {
      approvalType: parsed.data.approvalType,
      opportunityBriefId: parsed.data.opportunityBriefId?.trim() || null,
    },
  });

  revalidatePath(`/outreach/${candidateId}`);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function sendOutboundEmailAction(
  candidateId: string,
  input: z.infer<typeof outboundEmailSendSchema>,
) {
  const session = await requireActionSession();
  const parsed = outboundEmailSendSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Outbound email draft is incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  const context = await getOutreachContext(candidateId, parsed.data.sponsorId);

  if (!context || !context.selectedBrief || !context.selectedMatch) {
    return { success: false, error: "Outreach context is not ready yet." };
  }

  if (context.outreachRelease.blocked) {
    return {
      success: false,
      error: context.outreachRelease.blockers[0] ?? "Outbound email is still blocked.",
    };
  }

  const result = await sendOutboundEmail({
    candidateId,
    candidateName: context.data.candidate.fullName,
    sponsorId: parsed.data.sponsorId,
    sponsorName: context.selectedMatch.sponsor.fullName,
    opportunityBriefId: parsed.data.opportunityBriefId?.trim() || context.selectedBrief.id,
    draftId: parsed.data.draftId,
    draftLabel: parsed.data.draftLabel,
    recipientLabel: parsed.data.recipientLabel,
    recipientEmail: parsed.data.recipientEmail?.trim() || null,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  const threadKey = `${candidateId}:${parsed.data.sponsorId}`;
  const outboundEmail = await prisma.outboundEmail.create({
    data: {
      candidateId,
      sponsorId: parsed.data.sponsorId,
      opportunityBriefId: parsed.data.opportunityBriefId?.trim() || context.selectedBrief.id,
      requestedById: session.user.id,
      draftId: parsed.data.draftId,
      draftLabel: parsed.data.draftLabel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      providerMode: result.providerMode,
      status: result.status,
      recipientEmail: parsed.data.recipientEmail?.trim() || null,
      threadKey,
      providerThreadId: result.providerThreadId,
      externalMessageId: result.externalMessageId,
      payloadJson: result.payloadJson,
      sendNote: result.sendNote,
      sentAt: new Date(),
      events: {
        create: {
          actorUserId: session.user.id,
          eventType: OutboundEmailEventType.SENT,
          title: `Outbound draft sent · ${parsed.data.draftLabel}`,
          detail: result.sendNote,
          payloadJson: result.payloadJson,
          providerEventId: result.externalMessageId ?? undefined,
        },
      },
    },
  });

  await markPipelineOutreachDrafted(candidateId, parsed.data.sponsorId);

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "Outbound email sent",
    summary: `${parsed.data.draftLabel}. ${result.sendNote}`,
  });
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId,
    sponsorId: parsed.data.sponsorId,
    targetType: AuditLogTargetType.OUTBOUND_EMAIL,
    action: "outbound_email.sent",
    title: `Outbound email sent · ${parsed.data.draftLabel}`,
    detail: `${parsed.data.subject}. ${result.sendNote}`,
    payload: {
      outboundEmailId: outboundEmail.id,
      providerMode: result.providerMode,
      status: result.status,
      threadKey,
    },
  });

  revalidatePath(`/outreach/${candidateId}?sponsor=${parsed.data.sponsorId}`);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/sponsors/${parsed.data.sponsorId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function logOutboundEmailEventAction(input: z.infer<typeof outboundEmailEventSchema>) {
  const session = await requireActionSession();
  const parsed = outboundEmailEventSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Outbound thread update is incomplete." };
  }

  const outboundEmail = await prisma.outboundEmail.findFirst({
    where: {
      id: parsed.data.outboundEmailId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
      sponsorId: true,
      opportunityBriefId: true,
      threadKey: true,
    },
  });

  if (!outboundEmail) {
    return { success: false, error: "Outbound email not found in this workspace." };
  }

  await prisma.outboundEmailEvent.create({
    data: {
      outboundEmailId: outboundEmail.id,
      actorUserId: session.user.id,
      eventType: parsed.data.eventType,
      title: parsed.data.title.trim(),
      detail: parsed.data.detail.trim(),
    },
  });

  if (parsed.data.eventType === OutboundEmailEventType.FOLLOW_UP_SENT) {
    await prisma.sponsorActivity.create({
      data: {
        candidateId: outboundEmail.candidateId,
        sponsorId: outboundEmail.sponsorId,
        opportunityBriefId: outboundEmail.opportunityBriefId,
        activityType: SponsorActivityType.FOLLOW_UP_SENT,
        status: SponsorActivityStatus.COMPLETED,
        title: parsed.data.title.trim(),
        detail: parsed.data.detail.trim(),
        sourceLabel: "Outbound thread event",
        occurredAt: new Date(),
        completedAt: new Date(),
      },
    });
    await markPipelineFromActivity({
      candidateId: outboundEmail.candidateId,
      sponsorId: outboundEmail.sponsorId,
      activityType: SponsorActivityType.FOLLOW_UP_SENT,
      status: SponsorActivityStatus.COMPLETED,
      occurredAt: new Date(),
    });
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId: outboundEmail.candidateId,
    sponsorId: outboundEmail.sponsorId,
    targetType: AuditLogTargetType.OUTBOUND_EMAIL,
    action: `outbound_email.${parsed.data.eventType.toLowerCase()}`,
    title: parsed.data.title.trim(),
    detail: parsed.data.detail.trim(),
    payload: {
      outboundEmailId: outboundEmail.id,
      threadKey: outboundEmail.threadKey,
      eventType: parsed.data.eventType,
    },
  });

  revalidatePath(`/outreach/${outboundEmail.candidateId}?sponsor=${outboundEmail.sponsorId}`);
  revalidatePath(`/candidates/${outboundEmail.candidateId}`);
  revalidatePath(`/sponsors/${outboundEmail.sponsorId}`);
  revalidatePath("/pipeline");

  return { success: true };
}

export async function reviewOutboundApprovalAction(
  approvalId: string,
  input: z.infer<typeof outboundApprovalReviewSchema>,
) {
  const session = await requireActionSession();
  const parsed = outboundApprovalReviewSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Approval decision is incomplete." };
  }

  const approval = await prisma.outboundApproval.findFirst({
    where: {
      id: approvalId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
  });

  if (!approval) {
    return { success: false, error: "Approval record not found." };
  }

  await prisma.outboundApproval.update({
    where: { id: approvalId },
    data: {
      status: parsed.data.status,
      reviewedById: session.user.id,
      decisionNote: parsed.data.decisionNote,
      reviewedAt: new Date(),
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: approval.candidateId,
    label: "Outbound approval updated",
    summary: parsed.data.decisionNote,
  });
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId: approval.candidateId,
    sponsorId: approval.sponsorId,
    targetType: AuditLogTargetType.OUTBOUND_APPROVAL,
    action: "outbound_approval.reviewed",
    title: `Outbound approval ${parsed.data.status.toLowerCase()}`,
    detail: parsed.data.decisionNote,
    payload: {
      approvalId,
      approvalType: approval.approvalType,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/outreach/${approval.candidateId}`);
  revalidatePath(`/candidates/${approval.candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function syncCrmHandoffAction(candidateId: string, sponsorId: string) {
  const session = await requireActionSession();
  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  try {
    const context = await getOutreachContext(candidateId, sponsorId);

    if (!context || !context.selectedBrief || !context.selectedMatch || !context.outreachPlan || !context.variant) {
      return { success: false, error: "Outreach context is not ready yet." };
    }

    if (context.crmHandoffRelease.blocked) {
      return {
        success: false,
        error: context.crmHandoffRelease.blockers[0] ?? "CRM handoff is still blocked.",
      };
    }

    if ((await resolveBackgroundJobsMode()) === "queue") {
      const job = await enqueueBackgroundJob({
        organizationId: session.organizationId,
        candidateId,
        requestedById: session.user.id,
        jobType: BackgroundJobType.SYNC_CRM_HANDOFF,
        title: "Sync CRM handoff",
        payload: { candidateId, sponsorId },
        dedupeKey: `sync-crm-handoff:${candidateId}:${sponsorId}`,
      });

      revalidatePath(`/outreach/${candidateId}`);
      revalidatePath(`/briefs/${candidateId}`);
      revalidatePath(`/candidates/${candidateId}`);
      revalidatePath(`/sponsors/${sponsorId}`);
      revalidatePath("/settings");

      return { success: true, queued: true, jobId: job.id };
    }

    const record = buildCrmHandoffRecord({
      brief: context.selectedBrief,
      candidate: context.data.candidate,
      sponsor: context.selectedMatch.sponsor,
      connectionPath: context.selectedMatch.connectionPath,
      nextStep: context.outreachPlan.meetingGoal,
      outreachMode: context.outreachPlan.mode,
      risks: context.variant.risks,
      sponsorMatchScore: context.selectedMatch.result.score,
      sponsorReadinessScore: context.data.readiness.score,
      subjectLine: context.outreachPlan.subjectLine,
    });
    const result = await syncCrmHandoff(record);

    await prisma.crmSyncRecord.create({
      data: {
        candidateId,
        sponsorId,
        opportunityBriefId: context.selectedBrief.id,
        objectType: "opportunity_brief",
        providerMode: result.providerMode,
        status: result.status,
        externalRecordId: result.externalRecordId,
        payloadJson: JSON.stringify(record),
        syncNote: result.syncNote,
        syncedAt: new Date(),
      },
    });
    await recordAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.user.id,
      candidateId,
      sponsorId,
      targetType: AuditLogTargetType.CRM_SYNC,
      action: "crm_sync.sent",
      title: "CRM handoff recorded",
      detail: result.syncNote,
      payload: {
        providerMode: result.providerMode,
        status: result.status,
        externalRecordId: result.externalRecordId,
      },
    });

    await prisma.sponsorActivity.create({
      data: {
        candidateId,
        sponsorId,
        opportunityBriefId: context.selectedBrief.id,
        activityType: SponsorActivityType.CRM_SYNCED,
        status:
          result.status === "FAILED" ? SponsorActivityStatus.BLOCKED : SponsorActivityStatus.COMPLETED,
        title: "CRM handoff synced",
        detail: result.syncNote,
        sourceLabel:
          result.providerMode === "MOCK"
            ? "Local CRM outbox"
            : result.providerMode === "WEBHOOK"
              ? "CRM webhook sync"
              : `${result.providerMode.toLowerCase()} CRM adapter`,
        occurredAt: new Date(),
        completedAt: result.status === "FAILED" ? null : new Date(),
      },
    });

    await captureCandidateProgressSnapshot({
      candidateId,
      label: "CRM handoff recorded",
      summary: "The selected sponsor brief was synced into the outbound operations queue.",
    });
    await markPipelineOutreachDrafted(candidateId, sponsorId);
    await evaluateCandidateAutomation(candidateId);

    revalidatePath(`/outreach/${candidateId}`);
    revalidatePath(`/briefs/${candidateId}`);
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/sponsors/${sponsorId}`);
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/alerts");
    revalidatePath("/pipeline");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "CRM sync failed.",
    };
  }
}

export async function logSponsorActivityAction(input: z.infer<typeof sponsorActivitySchema>) {
  const session = await requireActionSession();
  const parsed = sponsorActivitySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Activity details are incomplete." };
  }

  const candidate = await requireCandidateAccess(parsed.data.candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if (requiresOutboundApprovalForActivity(parsed.data.activityType)) {
    const context = await getOutreachContext(parsed.data.candidateId, parsed.data.sponsorId);

    if (!context || context.outreachRelease.blocked) {
      return {
        success: false,
        error: context?.outreachRelease.blockers[0] ?? "Outbound activity is still blocked pending release approval.",
      };
    }
  }

  const activity = await prisma.sponsorActivity.create({
    data: {
      ...parsed.data,
      opportunityBriefId: parsed.data.opportunityBriefId?.trim() || null,
      completedAt: parsed.data.status === SponsorActivityStatus.COMPLETED ? new Date() : null,
      occurredAt: new Date(),
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: activity.candidateId,
    label: activity.title,
    summary: activity.detail,
  });
  await markPipelineFromActivity({
    candidateId: activity.candidateId,
    sponsorId: activity.sponsorId,
    activityType: activity.activityType,
    status: activity.status,
    occurredAt: activity.occurredAt,
  });
  await evaluateCandidateAutomation(activity.candidateId);

  revalidatePath(`/outreach/${activity.candidateId}`);
  revalidatePath(`/candidates/${activity.candidateId}`);
  revalidatePath(`/sponsors/${activity.sponsorId}`);
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath("/pipeline");

  return { success: true };
}

export async function resolveOperatorAlertAction(alertId: string) {
  const session = await requireActionSession();
  const workspaceAlert = await prisma.operatorAlert.findFirst({
    where: {
      id: alertId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
  });

  if (!workspaceAlert) {
    return { success: false, error: "Alert not found." };
  }

  const alert = await resolveOperatorAlert(alertId, {
    resolvedById: session.user.id,
  });

  if (!alert) {
    return { success: false, error: "Alert not found." };
  }

  await prisma.operatorTask.updateMany({
    where: {
      sourceAlertId: alertId,
    },
    data: {
      status: TaskStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${alert.candidateId}`);
  revalidatePath("/alerts");
  revalidatePath("/tasks");

  return { success: true };
}

export async function updateOperatorAlertWorkflowAction(
  alertId: string,
  input: z.infer<typeof alertWorkflowSchema>,
) {
  const session = await requireActionSession();
  const parsed = alertWorkflowSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Alert workflow details are invalid." };
  }

  const alert = await prisma.operatorAlert.findFirst({
    where: {
      id: alertId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!alert) {
    return { success: false, error: "Alert not found." };
  }

  if (parsed.data.assignedUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.assignedUserId,
      },
    });

    if (!membership) {
      return { success: false, error: "Selected assignee is not part of this workspace." };
    }
  }

  await prisma.operatorAlert.update({
    where: { id: alertId },
    data: {
      assignedUserId: parsed.data.assignedUserId?.trim() || null,
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
    },
  });

  await prisma.operatorTask.updateMany({
    where: {
      sourceAlertId: alertId,
    },
    data: {
      ownerUserId: parsed.data.assignedUserId?.trim() || null,
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
    },
  });

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${alert.candidateId}`);
  revalidatePath("/tasks");

  return { success: true };
}

export async function createTaskFromAlertAction(alertId: string) {
  const session = await requireActionSession();
  const alert = await prisma.operatorAlert.findFirst({
    where: {
      id: alertId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!alert) {
    return { success: false, error: "Alert not found." };
  }

  await createTaskFromAlert(alertId);

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath(`/candidates/${alert.candidateId}`);

  return { success: true };
}

export async function updateOperatorTaskAction(
  taskId: string,
  input: z.infer<typeof operatorTaskSchema>,
) {
  const session = await requireActionSession();
  const parsed = operatorTaskSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Task details are invalid." };
  }

  const task = await prisma.operatorTask.findFirst({
    where: {
      id: taskId,
      organizationId: session.organizationId,
    },
    select: {
      candidateId: true,
      sponsorId: true,
    },
  });

  if (!task) {
    return { success: false, error: "Task not found." };
  }

  if (parsed.data.ownerUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.ownerUserId,
      },
    });

    if (!membership) {
      return { success: false, error: "Selected owner is not part of this workspace." };
    }
  }

  await updateOperatorTask({
    taskId,
    status: parsed.data.status,
    ownerUserId: parsed.data.ownerUserId?.trim() || null,
    dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  if (task.candidateId) {
    revalidatePath(`/candidates/${task.candidateId}`);
  }

  if (task.sponsorId) {
    revalidatePath(`/sponsors/${task.sponsorId}`);
  }

  return { success: true };
}

export async function openDisagreementReviewAction(
  candidateId: string,
  input: z.infer<typeof disagreementReviewSchema>,
) {
  const session = await requireActionSession();
  const parsed = disagreementReviewSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Review assignment details are invalid." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if (parsed.data.assignedUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.assignedUserId,
      },
    });

    if (!membership) {
      return { success: false, error: "Selected reviewer is not part of this workspace." };
    }
  }

  try {
    await upsertDisagreementReview({
      candidateId,
      organizationId: session.organizationId,
      assignedUserId: parsed.data.assignedUserId?.trim() || null,
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not open disagreement review.",
    };
  }

  revalidatePath("/audits");
  revalidatePath("/analytics");
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/tasks");

  return { success: true };
}

export async function createTaskFromDisagreementReviewAction(reviewId: string) {
  const session = await requireActionSession();
  const review = await prisma.disagreementReview.findFirst({
    where: {
      id: reviewId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!review) {
    return { success: false, error: "Disagreement review not found." };
  }

  try {
    await createTaskFromDisagreementReview(reviewId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create a second-review task.",
    };
  }

  revalidatePath("/audits");
  revalidatePath("/analytics");
  revalidatePath("/tasks");
  revalidatePath(`/candidates/${review.candidateId}`);

  return { success: true };
}

export async function resolveDisagreementReviewAction(
  reviewId: string,
  input: z.infer<typeof disagreementResolutionSchema>,
) {
  const session = await requireActionSession();
  const parsed = disagreementResolutionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Resolution details are invalid." };
  }

  const review = await prisma.disagreementReview.findFirst({
    where: {
      id: reviewId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!review) {
    return { success: false, error: "Disagreement review not found." };
  }

  try {
    await resolveDisagreementReview({
      reviewId,
      reviewedById: session.user.id,
      resolutionType: parsed.data.resolutionType,
      rationale: parsed.data.rationale.trim(),
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not resolve disagreement review.",
    };
  }

  await evaluateCandidateAutomation(review.candidateId);

  revalidatePath("/audits");
  revalidatePath("/analytics");
  revalidatePath("/tasks");
  revalidatePath(`/candidates/${review.candidateId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function createProofRequestAction(
  candidateId: string,
  input: z.infer<typeof proofRequestSchema>,
) {
  const session = await requireActionSession();
  const parsed = proofRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Proof request details are incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  if (parsed.data.assignedUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.assignedUserId,
      },
    });

    if (!membership) {
      return { success: false, error: "Selected assignee is not part of this workspace." };
    }
  }

  if (parsed.data.sourceDisagreementReviewId) {
    const review = await prisma.disagreementReview.findFirst({
      where: {
        id: parsed.data.sourceDisagreementReviewId,
        candidateId,
        candidate: {
          organizationId: session.organizationId,
        },
      },
    });

    if (!review) {
      return { success: false, error: "Linked disagreement review was not found in this workspace." };
    }
  }

  try {
    await createProofRequest({
      candidateId,
      requestedById: session.user.id,
      assignedUserId: parsed.data.assignedUserId?.trim() || null,
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
      requestType: parsed.data.requestType,
      title: parsed.data.title,
      detail: parsed.data.detail,
      sourceDisagreementReviewId: parsed.data.sourceDisagreementReviewId?.trim() || null,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create proof request.",
    };
  }

  await evaluateCandidateAutomation(candidateId);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/candidates");
  revalidatePath("/audits");

  return { success: true };
}

export async function updateProofRequestWorkflowAction(
  requestId: string,
  input: z.infer<typeof proofRequestWorkflowSchema>,
) {
  const session = await requireActionSession();
  const parsed = proofRequestWorkflowSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Proof request workflow details are invalid." };
  }

  const request = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!request) {
    return { success: false, error: "Proof request not found." };
  }

  if (parsed.data.assignedUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.assignedUserId,
      },
    });

    if (!membership) {
      return { success: false, error: "Selected assignee is not part of this workspace." };
    }
  }

  try {
    await updateProofRequestWorkflow({
      requestId,
      assignedUserId: parsed.data.assignedUserId?.trim() || null,
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update proof request.",
    };
  }

  await evaluateCandidateAutomation(request.candidateId);

  revalidatePath(`/candidates/${request.candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/candidates");
  revalidatePath("/audits");

  return { success: true };
}

export async function createTaskFromProofRequestAction(requestId: string) {
  const session = await requireActionSession();
  const request = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!request) {
    return { success: false, error: "Proof request not found." };
  }

  try {
    await createTaskFromProofRequest(requestId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create a task from this proof request.",
    };
  }

  revalidatePath(`/candidates/${request.candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");

  return { success: true };
}

export async function createCandidateUpdateAccessLinkAction(
  requestId: string,
  input: z.infer<typeof candidateUpdateAccessLinkSchema>,
) {
  const session = await requireActionSession();
  const parsed = candidateUpdateAccessLinkSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Secure intake link settings are invalid." };
  }

  const request = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
      status: true,
    },
  });

  if (!request) {
    return { success: false, error: "Proof request not found." };
  }

  if (request.status === ProofRequestStatus.RESOLVED || request.status === ProofRequestStatus.CANCELED) {
    return { success: false, error: "Closed proof requests cannot accept secure candidate updates." };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.daysValid);
  const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 48);

  const link = await prisma.candidateUpdateAccessLink.upsert({
    where: {
      proofRequestId: request.id,
    },
    update: {
      token,
      status: CandidateUpdateAccessLinkStatus.ACTIVE,
      expiresAt,
      createdById: session.user.id,
    },
    create: {
      candidateId: request.candidateId,
      proofRequestId: request.id,
      createdById: session.user.id,
      token,
      status: CandidateUpdateAccessLinkStatus.ACTIVE,
      expiresAt,
    },
  });

  revalidatePath(`/candidates/${request.candidateId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  return {
    success: true,
    linkId: link.id,
    path: buildCandidateUpdateAccessPath(link.token),
  };
}

export async function revokeCandidateUpdateAccessLinkAction(linkId: string) {
  const session = await requireActionSession();
  const link = await prisma.candidateUpdateAccessLink.findFirst({
    where: {
      id: linkId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
    },
  });

  if (!link) {
    return { success: false, error: "Secure intake link not found." };
  }

  await prisma.candidateUpdateAccessLink.update({
    where: { id: link.id },
    data: {
      status: CandidateUpdateAccessLinkStatus.REVOKED,
    },
  });

  revalidatePath(`/candidates/${link.candidateId}`);
  revalidatePath("/tasks");

  return { success: true };
}

export async function createReviewShareLinkAction(
  candidateId: string,
  input: z.infer<typeof reviewShareLinkSchema>,
) {
  const session = await requireActionSession();
  const parsed = reviewShareLinkSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Review link settings are invalid." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  try {
    const draft = await buildReviewShareDraft({
      candidateId,
      linkType: parsed.data.linkType,
      sponsorId: parsed.data.sponsorId?.trim() || null,
    });
    const expiresAt = buildReviewShareExpiry(parsed.data.daysValid);
    const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 48);

    await prisma.reviewShareLink.updateMany({
      where: {
        organizationId: session.organizationId,
        candidateId,
        sponsorId: draft.sponsorId ?? null,
        linkType: parsed.data.linkType,
        status: ReviewShareLinkStatus.ACTIVE,
      },
      data: {
        status: ReviewShareLinkStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await prisma.reviewShareLink.create({
      data: {
        organizationId: session.organizationId,
        candidateId,
        sponsorId: draft.sponsorId,
        createdById: session.user.id,
        linkType: parsed.data.linkType,
        token,
        title: draft.title,
        payloadJson: serializeReviewSharePayload(draft.payload),
        expiresAt,
      },
    });

    await recordAuditLog({
      organizationId: session.organizationId,
      candidateId,
      sponsorId: draft.sponsorId,
      actorUserId: session.user.id,
      targetType: AuditLogTargetType.EXPORT,
      action: "review_share_link.created",
      title: "Review share link created",
      detail: `${draft.title}. Time-bounded read-only review access was created for internal sharing.`,
      payload: {
        linkType: parsed.data.linkType,
        expiresAt,
      },
    });

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/memos/${candidateId}`);
    revalidatePath(`/packets/${candidateId}`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create the review share link.",
    };
  }
}

export async function revokeReviewShareLinkAction(linkId: string) {
  const session = await requireActionSession();
  const link = await prisma.reviewShareLink.findFirst({
    where: {
      id: linkId,
      organizationId: session.organizationId,
    },
  });

  if (!link) {
    return { success: false, error: "Review share link not found." };
  }

  await prisma.reviewShareLink.update({
    where: { id: link.id },
    data: {
      status: ReviewShareLinkStatus.REVOKED,
      revokedAt: new Date(),
    },
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    candidateId: link.candidateId,
    sponsorId: link.sponsorId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.EXPORT,
    action: "review_share_link.revoked",
    title: "Review share link revoked",
    detail: `${link.title}. Read-only sharing for this review snapshot was revoked.`,
    payload: {
      linkType: link.linkType,
      reviewShareLinkId: link.id,
    },
  });

  revalidatePath(`/candidates/${link.candidateId}`);
  revalidatePath(`/memos/${link.candidateId}`);
  revalidatePath(`/packets/${link.candidateId}`);

  return { success: true };
}

export async function createPilotReviewShareLinkAction(input: z.infer<typeof pilotReviewShareLinkSchema>) {
  const parsed = pilotReviewShareLinkSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Pilot share-link settings are invalid." };
  }

  const minimumRole = pilotReviewShareRequiresAdmin(parsed.data.linkType) ? MembershipRole.ADMIN : MembershipRole.MEMBER;
  const session = await requireActionSession(minimumRole);

  try {
    const draft = await buildPilotReviewShareDraft({
      linkType: parsed.data.linkType,
    });
    const expiresAt = buildReviewShareExpiry(parsed.data.daysValid);
    const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 48);

    await prisma.pilotReviewShareLink.updateMany({
      where: {
        organizationId: session.organizationId,
        linkType: parsed.data.linkType,
        status: ReviewShareLinkStatus.ACTIVE,
      },
      data: {
        status: ReviewShareLinkStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await prisma.pilotReviewShareLink.create({
      data: {
        organizationId: session.organizationId,
        createdById: session.user.id,
        linkType: parsed.data.linkType,
        token,
        title: draft.title,
        payloadJson: serializePilotReviewSharePayload(draft.payload),
        expiresAt,
      },
    });

    await recordAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.user.id,
      targetType: AuditLogTargetType.EXPORT,
      action: "pilot_review_share_link.created",
      title: "Pilot review share link created",
      detail: `${draft.title}. Time-bounded read-only review access was created for pilot materials.`,
      payload: {
        linkType: parsed.data.linkType,
        expiresAt,
      },
    });

    revalidatePath("/pilot/report");
    revalidatePath("/pilot/pack");
    revalidatePath("/commercial");
    revalidatePath("/onboarding");
    revalidatePath("/roi");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create the pilot review share link.",
    };
  }
}

export async function revokePilotReviewShareLinkAction(linkId: string) {
  const session = await requireActionSession(MembershipRole.MEMBER);
  const link = await prisma.pilotReviewShareLink.findFirst({
    where: {
      id: linkId,
      organizationId: session.organizationId,
    },
  });

  if (!link) {
    return { success: false, error: "Pilot review share link not found." };
  }

  if (pilotReviewShareRequiresAdmin(link.linkType) && !hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN)) {
    return { success: false, error: "Admin workspace access required." };
  }

  await prisma.pilotReviewShareLink.update({
    where: { id: link.id },
    data: {
      status: ReviewShareLinkStatus.REVOKED,
      revokedAt: new Date(),
    },
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.EXPORT,
    action: "pilot_review_share_link.revoked",
    title: "Pilot review share link revoked",
    detail: `${link.title}. Read-only sharing for this pilot snapshot was revoked.`,
    payload: {
      linkType: link.linkType,
      pilotReviewShareLinkId: link.id,
    },
  });

  revalidatePath("/pilot/report");
  revalidatePath("/pilot/pack");
  revalidatePath("/commercial");
  revalidatePath("/onboarding");
  revalidatePath("/roi");

  return { success: true };
}

export async function sendProofRequestReminderAction(
  requestId: string,
  input: z.infer<typeof proofRequestReminderSchema>,
) {
  const session = await requireActionSession();
  const parsed = proofRequestReminderSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Reminder details are invalid." };
  }

  const request = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  if (!request) {
    return { success: false, error: "Proof request not found." };
  }

  if (request.status === ProofRequestStatus.RESOLVED || request.status === ProofRequestStatus.CANCELED) {
    return { success: false, error: "Closed proof requests cannot receive reminders." };
  }

  const reminderNote =
    parsed.data.note?.trim() ||
    (request.dueAt
      ? `Reminder sent to gather the requested proof before ${request.dueAt.toLocaleDateString()}.`
      : "Reminder sent to gather the requested proof for the active underwriting review.");

  await prisma.proofRequest.update({
    where: { id: request.id },
    data: {
      reminderCount: {
        increment: 1,
      },
      lastReminderAt: new Date(),
      lastReminderNote: reminderNote,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: request.candidateId,
    label: "Proof request reminder sent",
    summary: `${request.title}. ${reminderNote}`,
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId: request.candidateId,
    targetType: AuditLogTargetType.CANDIDATE,
    action: "proof_request.reminder_sent",
    title: "Proof request reminder sent",
    detail: `${request.candidate.fullName} · ${request.title}. ${reminderNote}`,
  });

  revalidatePath(`/candidates/${request.candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/candidates");

  return { success: true };
}

export async function resolveProofRequestAction(
  requestId: string,
  input: z.infer<typeof proofRequestResolutionSchema>,
) {
  const session = await requireActionSession();
  const parsed = proofRequestResolutionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Proof request resolution details are invalid." };
  }

  const request = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!request) {
    return { success: false, error: "Proof request not found." };
  }

  try {
    await resolveProofRequest({
      requestId,
      resolvedById: session.user.id,
      resolutionNote: parsed.data.resolutionNote,
      status: parsed.data.status,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not resolve proof request.",
    };
  }

  await evaluateCandidateAutomation(request.candidateId);

  revalidatePath(`/candidates/${request.candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/candidates");
  revalidatePath("/audits");

  return { success: true };
}

export async function submitCandidateUpdateAction(
  candidateId: string,
  input: z.infer<typeof candidateUpdateSubmissionSchema>,
) {
  const session = await requireActionSession();
  const parsed = candidateUpdateSubmissionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Candidate update details are incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  const storedFile = await requireStoredFileAccess(
    parsed.data.storedFileId,
    session.organizationId,
    candidateId,
  );

  if (parsed.data.storedFileId && !storedFile) {
    return { success: false, error: "Stored file is not available for this candidate." };
  }

  let linkedProofRequestId: string | null = null;

  if (parsed.data.sourceProofRequestId) {
    const proofRequest = await prisma.proofRequest.findFirst({
      where: {
        id: parsed.data.sourceProofRequestId,
        candidateId,
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (!proofRequest) {
      return { success: false, error: "Linked proof request was not found in this workspace." };
    }

    linkedProofRequestId = proofRequest.id;
  }

  const replacesArtifact = await requireArtifactReplacementAccess(
    parsed.data.replacesArtifactId,
    session.organizationId,
    candidateId,
  );

  if (parsed.data.replacesArtifactId && !replacesArtifact) {
    return { success: false, error: "The selected artifact version is no longer available to replace." };
  }

  const created = await prisma.$transaction(async (transaction) => {
    const artifact = await createVersionedArtifact(transaction, {
      candidateId,
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
      rawText: parsed.data.rawText,
      sourceLabel: parsed.data.sourceLabel,
      fileName: parsed.data.fileName,
      storedFileId: storedFile?.id ?? null,
      replacesArtifact,
    });

    const update = await transaction.candidateUpdate.create({
      data: {
        candidateId,
        sourceProofRequestId: linkedProofRequestId,
        submittedByUserId: session.user.id,
        artifactId: artifact.id,
        title: parsed.data.title.trim(),
        summary: parsed.data.summary.trim(),
        submittedByLabel: parsed.data.submittedByLabel.trim(),
      },
      include: {
        artifact: true,
      },
    });

    return {
      artifact,
      update,
    };
  });

  if (linkedProofRequestId && parsed.data.resolveLinkedProofRequest) {
    await resolveProofRequest({
      requestId: linkedProofRequestId,
      resolvedById: session.user.id,
      resolutionNote: `Resolved via candidate update: ${created.update.title}. ${created.update.summary}`,
      status: ProofRequestStatus.RESOLVED,
    });
  }

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "Candidate update submitted",
    summary: replacesArtifact
      ? `${created.update.title}. ${created.update.summary} This replaced a prior artifact version.`
      : `${created.update.title}. ${created.update.summary}`,
  });
  await evaluateCandidateAutomation(candidateId);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");

  return { success: true, updateId: created.update.id };
}

export async function incorporateCandidateUpdateAction(
  updateId: string,
  input: z.infer<typeof candidateUpdateIncorporationSchema>,
) {
  const session = await requireActionSession();
  const parsed = candidateUpdateIncorporationSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Update incorporation details are invalid." };
  }

  const update = await prisma.candidateUpdate.findFirst({
    where: {
      id: updateId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!update) {
    return { success: false, error: "Candidate update not found." };
  }

  await prisma.candidateUpdate.update({
    where: { id: updateId },
    data: {
      status: parsed.data.status,
      incorporationNote: parsed.data.incorporationNote.trim(),
      incorporatedById: session.user.id,
      incorporatedAt: parsed.data.status === CandidateUpdateStatus.INCORPORATED ? new Date() : null,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: update.candidateId,
    label: parsed.data.status === CandidateUpdateStatus.INCORPORATED ? "Candidate update incorporated" : "Candidate update needs follow-up",
    summary: parsed.data.incorporationNote.trim(),
  });
  await evaluateCandidateAutomation(update.candidateId);

  revalidatePath(`/candidates/${update.candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");

  return { success: true };
}

export async function submitCandidateUpdateViaAccessLinkAction(
  token: string,
  input: z.infer<typeof publicCandidateUpdateSchema>,
) {
  const parsed = publicCandidateUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Update details are incomplete." };
  }

  const context = await getCandidateUpdateAccessContext(token);

  if (!context || !context.isActive) {
    return { success: false, error: "This secure update link is no longer active." };
  }

  const storedFile = parsed.data.storedFileId
    ? await requireStoredFileAccess(
        parsed.data.storedFileId,
        context.candidate.organizationId,
        context.candidate.id,
      )
    : null;

  if (parsed.data.storedFileId && !storedFile) {
    return { success: false, error: "Stored file is not available for this candidate." };
  }

  const replacesArtifact = await requireArtifactReplacementAccess(
    parsed.data.replacesArtifactId,
    context.candidate.organizationId,
    context.candidate.id,
  );

  if (parsed.data.replacesArtifactId && !replacesArtifact) {
    return { success: false, error: "The selected earlier artifact is no longer available to replace." };
  }

  const structuredContext = [
    parsed.data.ownershipScope?.trim()
      ? `Ownership scope: ${parsed.data.ownershipScope.trim()}`
      : null,
    parsed.data.quantifiedOutcome?.trim()
      ? `Quantified result: ${parsed.data.quantifiedOutcome.trim()}`
      : null,
    parsed.data.thirdPartyContext?.trim()
      ? `Third-party context: ${parsed.data.thirdPartyContext.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const normalizedRawText = [parsed.data.rawText.trim(), ...structuredContext].join("\n\n");

  const created = await prisma.$transaction(async (transaction) => {
    const artifact = await createVersionedArtifact(transaction, {
      candidateId: context.candidate.id,
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
      rawText: normalizedRawText,
      sourceLabel: "Secure candidate update",
      fileName: parsed.data.fileName,
      storedFileId: storedFile?.id ?? null,
      replacesArtifact,
    });

    const update = await transaction.candidateUpdate.create({
      data: {
        candidateId: context.candidate.id,
        sourceProofRequestId: context.proofRequest.id,
        artifactId: artifact.id,
        title: parsed.data.title.trim(),
        summary: [parsed.data.summary.trim(), ...structuredContext].join(" "),
        submittedByLabel: parsed.data.submittedByLabel.trim(),
      },
    });

    await transaction.candidateUpdateAccessLink.update({
      where: { id: context.link.id },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return update;
  });

  await captureCandidateProgressSnapshot({
    candidateId: context.candidate.id,
    label: "Secure candidate update submitted",
    summary: replacesArtifact
      ? `${created.title}. ${created.summary} This replaced a prior artifact version.`
      : `${created.title}. ${created.summary}`,
  });
  await evaluateCandidateAutomation(context.candidate.id);

  revalidatePath(`/candidates/${context.candidate.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath("/tasks");

  return { success: true };
}

export async function updateSponsorPipelineItemAction(
  itemId: string,
  input: z.infer<typeof pipelineUpdateSchema>,
) {
  const session = await requireActionSession();
  const parsed = pipelineUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Pipeline details are invalid." };
  }

  const item = await prisma.sponsorPipelineItem.findFirst({
    where: {
      id: itemId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
      sponsorId: true,
      stage: true,
    },
  });

  if (!item) {
    return { success: false, error: "Pipeline item not found." };
  }

  if (parsed.data.ownerUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.ownerUserId,
      },
    });

    if (!membership) {
      return { success: false, error: "Selected owner is not part of this workspace." };
    }
  }

  if (
    requiresOutboundApprovalForStage(parsed.data.stage) &&
    (parsed.data.stage !== item.stage || !requiresOutboundApprovalForStage(item.stage))
  ) {
    const context = await getOutreachContext(item.candidateId, item.sponsorId);

    if (!context || context.outreachRelease.blocked) {
      return {
        success: false,
        error: `Sponsor-facing stage movement is still blocked. ${context?.outreachRelease.blockers[0] ?? "Request outreach release approval and clear the sponsor-path blockers first."}`,
      };
    }
  }

  await updatePipelineItem({
    itemId,
    stage: parsed.data.stage,
    ownerUserId: parsed.data.ownerUserId?.trim() || null,
    nextDueAt: parsed.data.nextDueAt ? new Date(`${parsed.data.nextDueAt}T23:59:00`) : null,
    nextStep: parsed.data.nextStep?.trim() || null,
    outcomeNote: parsed.data.outcomeNote?.trim() || null,
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath(`/candidates/${item.candidateId}`);
  revalidatePath(`/sponsors/${item.sponsorId}`);

  return { success: true };
}

export async function recordSponsorOutcomeAction(
  itemId: string,
  input: z.infer<typeof sponsorOutcomeSchema>,
) {
  const session = await requireActionSession();
  const parsed = sponsorOutcomeSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Outcome details are incomplete." };
  }

  const item = await prisma.sponsorPipelineItem.findFirst({
    where: {
      id: itemId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
      sponsorId: true,
    },
  });

  if (!item) {
    return { success: false, error: "Pipeline item not found." };
  }

  const occurredAt = new Date(`${parsed.data.occurredAt}T12:00:00`);

  if (Number.isNaN(occurredAt.getTime())) {
    return { success: false, error: "Outcome date is invalid." };
  }

  await recordSponsorOutcome({
    organizationId: session.organizationId,
    candidateId: item.candidateId,
    sponsorId: item.sponsorId,
    pipelineItemId: item.id,
    recordedById: session.user.id,
    verdict: parsed.data.verdict,
    outcomeType: parsed.data.outcomeType,
    title: parsed.data.title.trim(),
    detail: parsed.data.detail.trim(),
    occurredAt,
  });

  await captureCandidateProgressSnapshot({
    candidateId: item.candidateId,
    label: parsed.data.verdict === SponsorOutcomeVerdict.POSITIVE ? "Positive sponsor outcome recorded" : "Sponsor outcome recorded",
    summary: parsed.data.detail.trim(),
  });
  await evaluateCandidateAutomation(item.candidateId);

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/pilot");
  revalidatePath("/roi");
  revalidatePath(`/candidates/${item.candidateId}`);
  revalidatePath(`/sponsors/${item.sponsorId}`);

  return { success: true };
}

export async function updateSponsorAvailabilityAction(
  sponsorId: string,
  input: z.infer<typeof sponsorAvailabilityInputSchema>,
) {
  const session = await requireActionSession();
  const parsed = sponsorAvailabilityInputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Sponsor availability details are invalid." };
  }

  try {
    await updateSponsorAvailabilityForOrganization({
      sponsorId,
      organizationId: session.organizationId,
      actorUserId: session.user.id,
      data: parsed.data,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update sponsor availability.",
    };
  }

  revalidatePath("/sponsors");
  revalidatePath(`/sponsors/${sponsorId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/analytics");

  return { success: true };
}

export async function retryBackgroundJobAction(jobId: string) {
  const session = await requireActionSession(MembershipRole.ADMIN);
  const job = await prisma.backgroundJob.findFirst({
    where: {
      id: jobId,
      organizationId: session.organizationId,
    },
    select: {
      id: true,
      candidateId: true,
      status: true,
    },
  });

  if (!job) {
    return { success: false, error: "Background job not found in this workspace." };
  }

  if (job.status !== BackgroundJobStatus.FAILED && job.status !== BackgroundJobStatus.RETRYABLE) {
    return { success: false, error: "Only failed or retryable jobs can be requeued." };
  }

  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: BackgroundJobStatus.PENDING,
      availableAt: new Date(),
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      resultJson: null,
    },
  });

  if ((await resolveBackgroundJobsMode()) === "inline") {
    await runPendingBackgroundJobs({ limit: 1 });
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  if (job.candidateId) {
    revalidatePath(`/candidates/${job.candidateId}`);
  }

  return { success: true };
}

export async function retryCrmSyncRecordAction(syncId: string) {
  const session = await requireActionSession(MembershipRole.ADMIN);
  const syncRecord = await prisma.crmSyncRecord.findFirst({
    where: {
      id: syncId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
      sponsorId: true,
    },
  });

  if (!syncRecord) {
    return { success: false, error: "CRM sync record not found in this workspace." };
  }

  await enqueueBackgroundJob({
    organizationId: session.organizationId,
    candidateId: syncRecord.candidateId,
    requestedById: session.user.id,
    jobType: BackgroundJobType.SYNC_CRM_HANDOFF,
    title: "Retry CRM handoff sync",
    payload: {
      candidateId: syncRecord.candidateId,
      sponsorId: syncRecord.sponsorId,
    },
    dedupeKey: `crm-sync:${syncRecord.candidateId}:${syncRecord.sponsorId}`,
  });

  await captureCandidateProgressSnapshot({
    candidateId: syncRecord.candidateId,
    label: "CRM sync retry requested",
    summary: "A new CRM handoff sync attempt was queued from the recovery queue.",
  });

  if ((await resolveBackgroundJobsMode()) === "inline") {
    await runPendingBackgroundJobs({ limit: 2 });
  }

  revalidatePath("/settings");
  revalidatePath("/pipeline");
  revalidatePath(`/candidates/${syncRecord.candidateId}`);
  revalidatePath(`/sponsors/${syncRecord.sponsorId}`);

  return { success: true };
}

export async function applyManualStageOverrideAction(
  candidateId: string,
  input: z.infer<typeof stageOverrideSchema>,
) {
  const session = await requireActionSession();
  const parsed = stageOverrideSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Override details are incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  const result = await applyManualStageOverride({
    candidateId,
    stage: parsed.data.stage,
    rationale: parsed.data.rationale,
    actorLabel: parsed.data.actorLabel,
  });

  if (!result) {
    return { success: false, error: "Candidate not found." };
  }
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId,
    targetType: AuditLogTargetType.STAGE,
    action: "candidate.manual_stage_override",
    title: `Manual stage override · ${parsed.data.stage.toLowerCase()}`,
    detail: parsed.data.rationale,
    payload: {
      toStage: parsed.data.stage,
      actorLabel: parsed.data.actorLabel ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/alerts");

  return { success: true };
}

export async function resumeCandidateAutomationAction(
  candidateId: string,
  input: z.infer<typeof automationResumeSchema>,
) {
  const session = await requireActionSession();
  const parsed = automationResumeSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Resume note is incomplete." };
  }

  const candidate = await requireCandidateAccess(candidateId, session.organizationId);

  if (!candidate) {
    return { success: false, error: "Candidate not found in this workspace." };
  }

  const result = await resumeCandidateAutomation({
    candidateId,
    rationale: parsed.data.rationale,
    actorLabel: parsed.data.actorLabel,
  });

  if (!result) {
    return { success: false, error: "Candidate not found." };
  }
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId,
    targetType: AuditLogTargetType.STAGE,
    action: "candidate.automation_resumed",
    title: "Candidate automation resumed",
    detail: parsed.data.rationale,
    payload: {
      actorLabel: parsed.data.actorLabel ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/alerts");

  return { success: true };
}

export async function setAlertNotificationPreferenceAction(
  channel: NotificationChannel,
  enabled: boolean,
) {
  await requireActionSession(MembershipRole.ADMIN);
  await setAlertNotificationPreference(channel, enabled);

  revalidatePath("/alerts");
  revalidatePath("/settings");

  return { success: true };
}

export async function saveAutomationPolicyAction(
  input: z.infer<typeof automationPolicySchema>,
) {
  await requireActionSession(MembershipRole.ADMIN);
  const parsed = automationPolicySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Automation policy values are invalid." };
  }

  await saveAutomationPolicy(parsed.data);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath("/alerts");

  return { success: true };
}

export async function sendOperatorAlertDigestAction(
  target: NotificationChannel | "all" = "all",
) {
  const session = await requireActionSession();

  if ((await resolveBackgroundJobsMode()) === "queue") {
    const job = await enqueueBackgroundJob({
      organizationId: session.organizationId,
      requestedById: session.user.id,
      jobType: BackgroundJobType.SEND_ALERT_DIGEST,
      title: "Deliver operator alert digest",
      payload: { target },
      dedupeKey: `alert-digest:${target}`,
    });

    revalidatePath("/settings");
    revalidatePath("/alerts");

    return { success: true, queued: true, jobId: job.id, summary: "Digest queued for worker delivery." };
  }

  const result = await sendOperatorAlertDigest(target);

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return { success: true, summary: result.summary };
}

export async function runBackgroundJobsAction(limit = 5) {
  await requireActionSession(MembershipRole.ADMIN);
  const result = await runPendingBackgroundJobs({
    limit: Math.min(Math.max(limit, 1), 25),
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath("/pipeline");
  revalidatePath("/tasks");

  return { success: true, ...result };
}

export async function resetDemoDataAction() {
  try {
    const session = await requireActionSession(MembershipRole.OWNER);
    await resetAndSeedDemo();

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        user: {
          email: session.user.email,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (membership) {
      await createAppSession(membership.userId, membership.organizationId);
    }

    revalidatePath("/dashboard");
    revalidatePath("/candidates");
    revalidatePath("/sponsors");
    revalidatePath("/settings");
    revalidatePath("/alerts");
    revalidatePath("/tasks");
    revalidatePath("/pipeline");
    revalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Seed reset failed.",
    };
  }
}

export async function loginAction(formData: FormData) {
  const requestHeaders = await headers();
  const nextRoute = resolvePostLoginRoute(formData.get("next"));
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login" as Route);
  }

  const rateLimit = consumeRateLimit({
    bucket: "login-action",
    identifier: `${parsed.data.email.toLowerCase()}:${getRequestClientLabel(requestHeaders)}`,
    limit: env.loginRateLimitMaxAttempts,
    windowMs: env.loginRateLimitWindowMs,
  });

  if (!rateLimit.allowed) {
    redirect("/login?error=throttled" as Route);
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      user: {
        email: parsed.data.email,
      },
    },
    include: {
      user: {
        include: {
          passwordCredential: true,
        },
      },
    },
    orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
  });

  if (!membership) {
    redirect("/login?error=invalid" as Route);
  }

  if (env.authMode === "password") {
    const password = parsed.data.password?.trim() ?? "";

    if (!password || !membership.user.passwordCredential) {
      redirect("/login?error=invalid" as Route);
    }

    const isValidPassword = verifyPassword(password, membership.user.passwordCredential.passwordHash);

    if (!isValidPassword) {
      redirect("/login?error=invalid" as Route);
    }
  }

  await createAppSession(membership.userId, membership.organizationId);

  redirect(nextRoute);
}

export async function logoutAction() {
  await destroyAppSession();
  redirect("/login" as Route);
}
