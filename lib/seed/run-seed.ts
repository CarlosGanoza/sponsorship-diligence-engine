import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/db/env";
import { hashPassword } from "@/lib/auth/passwords";
import { sendOperatorAlertDigest } from "@/lib/alerts/digest";
import {
  createTaskFromDisagreementReview,
  getCurrentDecisionAudit,
  upsertDisagreementReview,
} from "@/lib/audits/workflow";
import { generateCandidateMemo, generateCandidateRecommendations } from "@/lib/ai/pipeline";
import { applyManualStageOverride, evaluateCandidateAutomation } from "@/lib/automation";
import { DEFAULT_AUTOMATION_POLICY } from "@/lib/automation/policy";
import { extractCandidateEvidence } from "@/lib/ai/pipeline";
import { generateCandidateOpportunityBriefs } from "@/lib/opportunities/pipeline";
import { buildCurrentPilotMetricsForOrganization } from "@/lib/pilot/measurements";
import {
  createProofRequest,
  createTaskFromProofRequest,
  resolveProofRequest,
} from "@/lib/proof-requests";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";
import { candidateSeeds, relationshipSeeds, sponsorSeeds, userSeeds } from "@/lib/seed/demo-data";
import { computeSponsorReadiness } from "@/lib/scoring";
import { createTaskFromAlert } from "@/lib/workflow/tasks";
import { markPipelineFromActivity, maxPipelineStage, syncCandidateSponsorPipeline } from "@/lib/workflow/pipeline";
import {
  AuditLogTargetType,
  CandidateStage,
  CandidateUpdateStatus,
  CommitteeReviewStatus,
  CommitteeVoteDecision,
  CrmSyncMode,
  CrmSyncStatus,
  DecisionType,
  MembershipRole,
  NoteType,
  OutboundApprovalStatus,
  OutboundApprovalType,
  OutboundEmailEventType,
  PilotMetricSnapshotType,
  ProofRequestStatus,
  ProofRequestType,
  RecommendationType,
  ReviewStatus,
  SavedViewPage,
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorAvailabilityStatus,
  SponsorOutcomeType,
  SponsorOutcomeVerdict,
  SponsorPipelineStage,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

function resolveEntityId(
  type: "candidate" | "sponsor" | "other",
  key: string,
  maps: {
    candidateMap: Map<string, string>;
    sponsorMap: Map<string, string>;
  },
) {
  if (type === "candidate") {
    return maps.candidateMap.get(key) ?? key;
  }

  if (type === "sponsor") {
    return maps.sponsorMap.get(key) ?? key;
  }

  return key;
}

const strongClaimNotesByCandidate = new Map<string, string>([
  ["maya-rios", "Approved. This claim is concrete, repeated across artifacts, and strong enough for sponsor-facing use."],
  ["leila-mensah", "Approved. This is a strong example of execution and sponsorship-relevant leadership."],
  ["arjun-sethi", "Approved. The claim shows cross-functional leverage with enough implementation detail to cite."],
  ["elena-torres", "Approved. This evidence is specific, repeatable, and appropriate for conviction-building."],
]);

const flaggedClaimNotesByCandidate = new Map<string, string>([
  ["jonah-park", "Flagged for follow-up. Strong analytical proof exists, but the sponsorship case still needs clearer leadership scope."],
  ["nia-okafor", "Flagged for follow-up. Mission alignment is strong, but the case needs a longer-horizon execution proof point."],
  ["diego-alvarez", "Flagged for follow-up. The profile needs more complete source material before this claim can support outreach."],
]);

const strongRecommendationNotesByCandidate = new Map<string, string>([
  ["maya-rios", "Approved. This sponsor path is ready for operator review and external advocacy prep."],
  ["leila-mensah", "Approved. The sponsor fit is specific enough to move toward a warm introduction."],
  ["arjun-sethi", "Approved. The recommendation aligns with current evidence and an actionable warm path."],
  ["elena-torres", "Approved. This is sponsor-ready with a credible next step."],
]);

const flaggedRecommendationNotesByCandidate = new Map<string, string>([
  ["jonah-park", "Flagged. Hold outreach until the profile includes a larger ownership example beyond analysis."],
  ["nia-okafor", "Flagged. This direction is promising, but another durable follow-through artifact should be added first."],
]);

const disagreementDecisionOverrides = new Map<string, DecisionType>([
  ["maya-rios", DecisionType.HOLD],
  ["jonah-park", DecisionType.ADVANCE],
  ["nia-okafor", DecisionType.ADVANCE],
]);

const seededSponsorOutcomesByCandidate = new Map<
  string,
  {
    verdict: SponsorOutcomeVerdict;
    outcomeType: SponsorOutcomeType;
    title: string;
    detail: string;
  }
>([
  [
    "maya-rios",
    {
      verdict: SponsorOutcomeVerdict.POSITIVE,
      outcomeType: SponsorOutcomeType.ADVOCACY_COMMITTED,
      title: "Sponsor committed to advocate",
      detail:
        "Seeded positive outcome: the sponsor agreed to advocate for Maya as a climate resilience operator after reviewing the memo and meeting notes.",
    },
  ],
  [
    "arjun-sethi",
    {
      verdict: SponsorOutcomeVerdict.POSITIVE,
      outcomeType: SponsorOutcomeType.OPPORTUNITY_SECURED,
      title: "Follow-on opportunity secured",
      detail:
        "Seeded positive outcome: the sponsor moved forward with an introduction and committed to championing Arjun for an applied systems fellowship.",
    },
  ],
  [
    "jonah-park",
    {
      verdict: SponsorOutcomeVerdict.NEGATIVE,
      outcomeType: SponsorOutcomeType.DECLINED,
      title: "Sponsor asked for stronger proof",
      detail:
        "Seeded negative outcome: the sponsor declined to move now because the file still lacked a clearer ownership example beyond analytical contribution.",
    },
  ],
  [
    "nia-okafor",
    {
      verdict: SponsorOutcomeVerdict.NEGATIVE,
      outcomeType: SponsorOutcomeType.TIMING_MISMATCH,
      title: "Timing mismatch on outreach",
      detail:
        "Seeded negative outcome: the sponsor liked the mission alignment but did not move because the opportunity timing was wrong and the proof base was still too thin.",
    },
  ],
]);

const proofRequestSeedsByCandidate = new Map<
  string,
  Array<{
    requestType: ProofRequestType;
    title: string;
    detail: string;
    status: ProofRequestStatus;
    assignee: "operator" | "reviewer" | "coordinator" | null;
    createTask?: boolean;
    resolutionNote?: string;
  }>
>([
  [
    "jonah-park",
    [
      {
        requestType: ProofRequestType.OWNERSHIP_EXAMPLE,
        title: "Request larger-scope ownership example",
        detail:
          "Add one artifact that shows Jonah owned a delivery decision or cross-functional implementation beyond analysis alone.",
        status: ProofRequestStatus.OPEN,
        assignee: "reviewer",
        createTask: true,
      },
    ],
  ],
  [
    "nia-okafor",
    [
      {
        requestType: ProofRequestType.THIRD_PARTY_CORROBORATION,
        title: "Request partner corroboration",
        detail:
          "Add a mentor, manager, or partner note that confirms repeatable follow-through under pressure, not just mission alignment.",
        status: ProofRequestStatus.IN_PROGRESS,
        assignee: "operator",
        createTask: true,
      },
    ],
  ],
  [
    "maya-rios",
    [
      {
        requestType: ProofRequestType.CONTRADICTION_REVIEW,
        title: "Clarify pilot scale language",
        detail:
          "One artifact reads like a completed multi-city rollout while another frames the work as a local pilot. Resolve that mismatch before sponsor-facing use.",
        status: ProofRequestStatus.RESOLVED,
        assignee: "reviewer",
        createTask: true,
        resolutionNote:
          "Seeded resolution: keep the claim framed as a strong local pilot with credible momentum, not a completed multi-city rollout.",
      },
    ],
  ],
]);

function isStrongStage(stage: CandidateStage) {
  return stage === "MEMO_READY" || stage === "SPONSOR_OUTREACH";
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNowDateOnly(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function seedClaimReviewStates(candidateKey: string, candidateId: string, stage: CandidateStage) {
  const claims = await prisma.evidenceClaim.findMany({
    where: { candidateId },
    orderBy: [{ confidence: "desc" }, { createdAt: "asc" }],
  });

  if (claims.length === 0) {
    return;
  }

  const approvedCount = isStrongStage(stage) ? 2 : 1;
  const approvedNote =
    strongClaimNotesByCandidate.get(candidateKey) ??
    "Approved. This evidence is strong enough to support operator judgment and memo language.";

  for (const claim of claims.slice(0, approvedCount)) {
    await prisma.evidenceClaim.update({
      where: { id: claim.id },
      data: {
        reviewStatus: ReviewStatus.APPROVED,
        reviewNote: approvedNote,
        reviewedAt: claim.createdAt,
      },
    });
  }

  if (stage === "REVIEW" || stage === "INTAKE" || stage === "HOLD") {
    const flagged = claims.at(-1);
    if (flagged && !claims.slice(0, approvedCount).some((claim) => claim.id === flagged.id)) {
      await prisma.evidenceClaim.update({
        where: { id: flagged.id },
        data: {
          reviewStatus: ReviewStatus.FLAGGED,
          reviewNote:
            flaggedClaimNotesByCandidate.get(candidateKey) ??
            "Flagged for follow-up. This signal needs stronger supporting proof before sponsor-facing use.",
          reviewedAt: flagged.createdAt,
        },
      });
    }
  }
}

async function seedRecommendationReviewStates(candidateKey: string, candidateId: string, stage: CandidateStage) {
  const recommendations = await prisma.recommendation.findMany({
    where: { candidateId },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
  });

  if (recommendations.length === 0) {
    return;
  }

  const approvedRecommendationIds = new Set<string>();

  if (isStrongStage(stage)) {
    for (const recommendation of recommendations.filter(
      (item) =>
        item.recommendationType === RecommendationType.BEST_SPONSOR ||
        item.recommendationType === RecommendationType.NEXT_ACTION,
    )) {
      if (approvedRecommendationIds.size >= 2) {
        break;
      }

      approvedRecommendationIds.add(recommendation.id);
      await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: {
          reviewStatus: ReviewStatus.APPROVED,
          reviewNote:
            strongRecommendationNotesByCandidate.get(candidateKey) ??
            "Approved. This recommendation is credible enough to guide operator action.",
          reviewedAt: recommendation.createdAt,
        },
      });
    }
  }

  if (stage === "REVIEW" || stage === "INTAKE" || stage === "HOLD") {
    const flagged =
      recommendations.find((item) => item.recommendationType === RecommendationType.NEXT_ACTION) ??
      recommendations[0];

    if (flagged && !approvedRecommendationIds.has(flagged.id)) {
      await prisma.recommendation.update({
        where: { id: flagged.id },
        data: {
          reviewStatus: ReviewStatus.FLAGGED,
          reviewNote:
            flaggedRecommendationNotesByCandidate.get(candidateKey) ??
            "Flagged. This recommendation needs stronger evidence before it should drive sponsor outreach.",
          reviewedAt: flagged.createdAt,
        },
      });
    }
  }
}

async function seedSponsorOperations(
  organizationId: string,
  candidateKey: string,
  candidateId: string,
  stage: CandidateStage,
) {
  const brief = await prisma.opportunityBrief.findFirst({
    where: { candidateId },
    orderBy: { updatedAt: "desc" },
  });

  if (!brief) {
    return;
  }

  if (isStrongStage(stage)) {
    const activitySeeds = [
      {
        candidateId,
        sponsorId: brief.sponsorId,
        opportunityBriefId: brief.id,
        activityType: SponsorActivityType.INTRO_REQUESTED,
        status: SponsorActivityStatus.COMPLETED,
        title: "Warm intro request sent",
        detail: "Seeded demo activity showing the operator requested a warm introduction with the current brief attached.",
        sourceLabel: "Seeded operator update",
        occurredAt: brief.createdAt,
        completedAt: brief.createdAt,
      },
      ...(stage === "SPONSOR_OUTREACH"
        ? [
            {
              candidateId,
              sponsorId: brief.sponsorId,
              opportunityBriefId: brief.id,
              activityType: SponsorActivityType.MEETING_SCHEDULED,
              status: SponsorActivityStatus.COMPLETED,
              title: "Sponsor meeting scheduled",
              detail: "Seeded demo activity showing the first sponsor diligence meeting is on the calendar.",
              sourceLabel: "Seeded sponsor ops",
              occurredAt: brief.updatedAt,
              completedAt: brief.updatedAt,
            },
            {
              candidateId,
              sponsorId: brief.sponsorId,
              opportunityBriefId: brief.id,
              activityType: SponsorActivityType.FOLLOW_UP_SENT,
              status: SponsorActivityStatus.PENDING,
              title: "Follow-up package queued",
              detail: "Seeded demo activity indicating the evidence package is ready to send after the first conversation.",
              sourceLabel: "Seeded sponsor ops",
              occurredAt: brief.updatedAt,
            },
          ]
        : []),
    ];

    for (const activity of activitySeeds) {
      await prisma.sponsorActivity.create({
        data: activity,
      });

      await markPipelineFromActivity({
        candidateId,
        sponsorId: brief.sponsorId,
        activityType: activity.activityType,
        status: activity.status,
        occurredAt: activity.occurredAt,
      });
    }

    const seededOutcome = seededSponsorOutcomesByCandidate.get(candidateKey);

    if (seededOutcome) {
      await prisma.sponsorActivity.create({
        data: {
          candidateId,
          sponsorId: brief.sponsorId,
          opportunityBriefId: brief.id,
          activityType: SponsorActivityType.OUTCOME_RECORDED,
          status:
            seededOutcome.verdict === SponsorOutcomeVerdict.NEGATIVE
              ? SponsorActivityStatus.BLOCKED
              : SponsorActivityStatus.COMPLETED,
          title: seededOutcome.title,
          detail: seededOutcome.detail,
          sourceLabel: "Seeded sponsor ops",
          occurredAt: brief.updatedAt,
          completedAt: brief.updatedAt,
        },
      });

      const pipelineItem = await prisma.sponsorPipelineItem.findUnique({
        where: {
          candidateId_sponsorId: {
            candidateId,
            sponsorId: brief.sponsorId,
          },
        },
      });

      await prisma.sponsorOutcome.create({
        data: {
          organizationId,
          candidateId,
          sponsorId: brief.sponsorId,
          pipelineItemId: pipelineItem?.id ?? null,
          verdict: seededOutcome.verdict,
          outcomeType: seededOutcome.outcomeType,
          title: seededOutcome.title,
          detail: seededOutcome.detail,
          occurredAt: brief.updatedAt,
          recordedAt: brief.updatedAt,
          createdAt: brief.updatedAt,
          updatedAt: brief.updatedAt,
        },
      });

      await markPipelineFromActivity({
        candidateId,
        sponsorId: brief.sponsorId,
        activityType: SponsorActivityType.OUTCOME_RECORDED,
        status:
          seededOutcome.verdict === SponsorOutcomeVerdict.NEGATIVE
            ? SponsorActivityStatus.BLOCKED
            : SponsorActivityStatus.COMPLETED,
        occurredAt: brief.updatedAt,
      });

      await prisma.sponsorPipelineItem.updateMany({
        where: {
          candidateId,
          sponsorId: brief.sponsorId,
        },
        data: {
          outcomeNote: seededOutcome.detail,
          lastActivityAt: brief.updatedAt,
        },
      });
    }

    await prisma.crmSyncRecord.create({
      data: {
        candidateId,
        sponsorId: brief.sponsorId,
        opportunityBriefId: brief.id,
        objectType: "opportunity_brief",
        providerMode: CrmSyncMode.MOCK,
        status: CrmSyncStatus.SYNCED,
        externalRecordId: `seed-${candidateKey}`,
        payloadJson: JSON.stringify({
          candidateId,
          sponsorId: brief.sponsorId,
          briefTitle: brief.title,
        }),
        syncNote: "Seeded demo CRM sync stored in the local outbox.",
        syncedAt: brief.updatedAt,
      },
    });

    return;
  }

  if (stage === "REVIEW" || stage === "INTAKE" || stage === "HOLD") {
    await prisma.sponsorActivity.create({
      data: {
        candidateId,
        sponsorId: brief.sponsorId,
        opportunityBriefId: brief.id,
        activityType: SponsorActivityType.INTRO_REQUESTED,
        status: SponsorActivityStatus.BLOCKED,
        title: "Outreach held pending stronger proof",
        detail: "Seeded demo activity showing the operator held outreach until the evidence set improves.",
        sourceLabel: "Seeded operator review",
        occurredAt: brief.updatedAt,
      },
    });

    await markPipelineFromActivity({
      candidateId,
      sponsorId: brief.sponsorId,
      activityType: SponsorActivityType.INTRO_REQUESTED,
      status: SponsorActivityStatus.BLOCKED,
      occurredAt: brief.updatedAt,
    });
  }
}

async function seedProgressHistory(candidateId: string, stage: CandidateStage) {
  const [candidate, edges] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({
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
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        OR: [{ fromEntityId: candidateId }, { toEntityId: candidateId }],
      },
    }),
  ]);

  const claimReviewSummary = summarizeReviewStatuses(
    candidate.evidenceClaims.map((claim) => claim.reviewStatus),
  );
  const recommendationReviewSummary = summarizeReviewStatuses(
    candidate.recommendations.map((recommendation) => recommendation.reviewStatus),
  );
  const reviewSummary = combineReviewSummaries([claimReviewSummary, recommendationReviewSummary]);
  const topSponsorMatchScore = Math.round(
    Math.max(
      0,
      ...candidate.recommendations
        .filter((recommendation) => recommendation.recommendationType === RecommendationType.BEST_SPONSOR)
        .map((recommendation) => recommendation.score),
    ),
  );
  const highSignalClaimCount = candidate.evidenceClaims.filter((claim) =>
    ["INITIATIVE", "FOLLOW_THROUGH", "LEADERSHIP", "MISSION_ALIGNMENT", "RESILIENCE"].includes(claim.category),
  ).length;
  const readiness = computeSponsorReadiness(candidate, candidate.artifacts, candidate.evidenceClaims, edges);
  const intermediateStage = stage === "INTAKE" ? "INTAKE" : "REVIEW";
  const preCurrentStage = stage === "SPONSOR_OUTREACH" ? "MEMO_READY" : stage;
  const stageSpecificLabel =
    stage === "SPONSOR_OUTREACH"
      ? "Sponsor path activated"
      : stage === "MEMO_READY"
        ? "Memo compiled"
        : stage === "HOLD"
          ? "Held for stronger proof"
          : "Operator review";
  const stageSpecificSummary =
    stage === "SPONSOR_OUTREACH"
      ? "The memo, sponsor fit, and warm path were strong enough to move into outreach preparation."
      : stage === "MEMO_READY"
        ? "The evidence file was strong enough to produce a sponsor-ready memo and brief package."
        : stage === "HOLD"
          ? "The case stayed in hold while the operator looked for stronger execution proof."
          : "The profile was reviewed for clarity, leadership scope, and durability of evidence.";

  await prisma.candidateProgressSnapshot.createMany({
    data: [
      {
        candidateId,
        label: "Initial intake",
        summary: "The file opened with a limited evidence set and an early read on sponsorship potential.",
        stage: "INTAKE",
        readinessScore: Math.max(18, readiness.score - (isStrongStage(stage) ? 24 : 14)),
        topSponsorMatchScore: Math.max(8, topSponsorMatchScore - 28),
        artifactCount: Math.max(1, Math.min(candidate.artifacts.length, 1)),
        evidenceClaimCount: Math.max(0, Math.floor(candidate.evidenceClaims.length * 0.2)),
        highSignalClaimCount: Math.max(0, Math.floor(highSignalClaimCount * 0.15)),
        approvedItemCount: 0,
        flaggedItemCount: 0,
        relationshipEdgeCount: Math.max(0, edges.length - 1),
        memoStatus: null,
        capturedAt: daysAgo(90),
      },
      {
        candidateId,
        label: "Evidence pack expanded",
        summary: "New artifacts improved repeatability, signal coverage, and the operator's confidence in the case.",
        stage: intermediateStage,
        readinessScore: Math.max(28, readiness.score - (isStrongStage(stage) ? 11 : 5)),
        topSponsorMatchScore: Math.max(15, topSponsorMatchScore - 14),
        artifactCount: Math.max(1, Math.ceil(candidate.artifacts.length * 0.67)),
        evidenceClaimCount: Math.max(1, Math.floor(candidate.evidenceClaims.length * 0.65)),
        highSignalClaimCount: Math.max(0, Math.floor(highSignalClaimCount * 0.6)),
        approvedItemCount: Math.max(0, reviewSummary.approved - (isStrongStage(stage) ? 1 : 0)),
        flaggedItemCount: stage === "HOLD" || stage === "REVIEW" ? Math.max(0, reviewSummary.flagged - 1) : 0,
        relationshipEdgeCount: edges.length,
        memoStatus: null,
        capturedAt: daysAgo(42),
      },
      {
        candidateId,
        label: stageSpecificLabel,
        summary: stageSpecificSummary,
        stage: preCurrentStage,
        readinessScore: Math.max(35, readiness.score - (stage === "SPONSOR_OUTREACH" ? 3 : 1)),
        topSponsorMatchScore: Math.max(20, topSponsorMatchScore - (stage === "SPONSOR_OUTREACH" ? 2 : 0)),
        artifactCount: Math.max(1, Math.ceil(candidate.artifacts.length * 0.9)),
        evidenceClaimCount: Math.max(1, Math.floor(candidate.evidenceClaims.length * 0.9)),
        highSignalClaimCount: Math.max(0, Math.floor(highSignalClaimCount * 0.85)),
        approvedItemCount: Math.max(0, reviewSummary.approved),
        flaggedItemCount: Math.max(0, reviewSummary.flagged),
        relationshipEdgeCount: edges.length,
        memoStatus: candidate.sponsorMemo?.status ?? null,
        capturedAt: daysAgo(12),
      },
    ],
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "Current file state",
    summary: "Latest scored view of the sponsorship case after memo, recommendations, review, and sponsor operations updates.",
    capturedAt: daysAgo(2),
  });
}

async function seedWorkflowContext(input: {
  candidateKey: string;
  candidateId: string;
  stage: CandidateStage;
  ownerUserId?: string | null;
  operatorUserId?: string | null;
  reviewerUserId?: string | null;
  coordinatorUserId?: string | null;
}) {
  const noteAuthorId = input.operatorUserId ?? input.ownerUserId ?? null;
  const reviewerId = input.reviewerUserId ?? noteAuthorId;
  const coordinatorId = input.coordinatorUserId ?? reviewerId;
  const noteEntries = [
    {
      candidateId: input.candidateId,
      authorUserId: noteAuthorId,
      noteType: input.stage === "HOLD" ? NoteType.RISK : NoteType.REVIEW,
      title: input.stage === "HOLD" ? "Proof gap holding pattern" : "Current underwriting read",
      content:
        input.stage === "HOLD"
          ? "The evidence base is promising, but the file still needs one clearer example of larger-scope ownership before external advocacy."
          : isStrongStage(input.stage)
            ? "The evidence pack is coherent enough to support a serious sponsor conversation, provided the ask stays close to the current proof."
            : "The candidate is directionally compelling, but the file still needs tighter proof and clearer operator framing before outreach.",
    },
    {
      candidateId: input.candidateId,
      authorUserId: reviewerId,
      noteType: isStrongStage(input.stage) ? NoteType.OUTREACH : NoteType.FOLLOW_UP,
      title: isStrongStage(input.stage) ? "Warm path framing" : "Next proof to request",
      content: isStrongStage(input.stage)
        ? "Lead with the strongest operator evidence first, then use the warm path only after the sponsor-specific brief is tightened."
        : "Request one more artifact that demonstrates repeatable execution, ideally from a supervisor or partner who saw the work under pressure.",
    },
  ];

  await prisma.candidateNote.createMany({
    data: noteEntries,
  });

  await prisma.candidateDecision.create({
    data: {
      candidateId: input.candidateId,
      decidedById: reviewerId,
      decisionType:
        disagreementDecisionOverrides.get(input.candidateKey) ??
        (input.stage === "HOLD"
          ? DecisionType.NEED_MORE_PROOF
          : input.stage === "SPONSOR_OUTREACH"
            ? DecisionType.OUTREACH_APPROVED
            : input.stage === "MEMO_READY"
              ? DecisionType.ADVANCE
              : DecisionType.HOLD),
      summary:
        disagreementDecisionOverrides.has(input.candidateKey)
          ? "Seeded disagreement for governance review"
          : input.stage === "HOLD"
          ? "Hold for stronger evidence"
          : input.stage === "SPONSOR_OUTREACH"
            ? "Outreach path approved"
            : input.stage === "MEMO_READY"
              ? "Advance to sponsor-ready queue"
              : "Continue review",
      rationale:
        disagreementDecisionOverrides.has(input.candidateKey)
          ? "Seeded mismatch between the logged human underwriting call and the current evidence guardrail so the disagreement-review workflow is visible in the demo."
          : input.stage === "HOLD"
          ? "The file is credible but still missing enough leadership-proof density to justify sponsor-facing movement."
          : input.stage === "SPONSOR_OUTREACH"
            ? "Memo quality, recommendation clarity, and warm-path evidence are strong enough to justify active sponsor outreach."
            : input.stage === "MEMO_READY"
              ? "The case is strong enough for a sponsor memo and opportunity brief, but outreach should still be deliberate and sponsor-specific."
              : "The candidate is worth continued attention, but the current file still needs stronger proof before external advocacy.",
      stageAtDecision: input.stage,
    },
  });

  const pipelineItems = await prisma.sponsorPipelineItem.findMany({
    where: {
      candidateId: input.candidateId,
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });

  for (const [index, item] of pipelineItems.entries()) {
    const ownerUserId = index === 0 ? coordinatorId : reviewerId;
    const nextDueAt = daysAgo(-(index + (isStrongStage(input.stage) ? 2 : 5)));
    const seededStage =
      input.stage === "SPONSOR_OUTREACH"
        ? SponsorPipelineStage.MEETING_SCHEDULED
        : input.stage === "MEMO_READY"
          ? SponsorPipelineStage.BRIEF_READY
          : SponsorPipelineStage.UNDER_REVIEW;

    await prisma.sponsorPipelineItem.update({
      where: { id: item.id },
      data: {
        ownerUserId,
        nextDueAt,
        stage: maxPipelineStage(item.stage, seededStage),
        nextStep:
          item.nextStep ??
          (isStrongStage(input.stage)
            ? "Prepare sponsor-specific brief and confirm the warm connector."
            : "Tighten the proof base before sponsor-facing movement."),
        outcomeNote:
          input.stage === "HOLD"
            ? "Seeded review note: hold external movement until the file gets one stronger ownership artifact."
            : item.outcomeNote,
      },
    });
  }
}

function resolveSeededUserId(
  assignee: "operator" | "reviewer" | "coordinator" | null,
  ids: {
    operatorUserId?: string | null;
    reviewerUserId?: string | null;
    coordinatorUserId?: string | null;
  },
) {
  if (assignee === "operator") {
    return ids.operatorUserId ?? null;
  }

  if (assignee === "reviewer") {
    return ids.reviewerUserId ?? null;
  }

  if (assignee === "coordinator") {
    return ids.coordinatorUserId ?? null;
  }

  return null;
}

async function seedProofRequests(input: {
  candidateKey: string;
  candidateId: string;
  operatorUserId?: string | null;
  reviewerUserId?: string | null;
  coordinatorUserId?: string | null;
}) {
  const seeds = proofRequestSeedsByCandidate.get(input.candidateKey) ?? [];

  for (const seed of seeds) {
    const assignedUserId = resolveSeededUserId(seed.assignee, input);
    const request = await createProofRequest({
      candidateId: input.candidateId,
      requestedById: input.operatorUserId ?? input.reviewerUserId ?? null,
      assignedUserId,
      dueAt: seed.status === ProofRequestStatus.RESOLVED ? daysAgo(4) : daysAgo(-4),
      requestType: seed.requestType,
      title: seed.title,
      detail: seed.detail,
    });

    if (seed.createTask) {
      await createTaskFromProofRequest(request.id);
    }

    if (seed.status === ProofRequestStatus.RESOLVED || seed.status === ProofRequestStatus.CANCELED) {
      const resolvedById = input.reviewerUserId ?? input.operatorUserId;

      if (!resolvedById) {
        continue;
      }

      await resolveProofRequest({
        requestId: request.id,
        resolvedById,
        resolutionNote: seed.resolutionNote ?? "Seeded proof request resolution.",
        status: seed.status,
      });

      continue;
    }

    await prisma.candidateUpdateAccessLink.create({
      data: {
        candidateId: input.candidateId,
        proofRequestId: request.id,
        createdById: input.operatorUserId ?? input.reviewerUserId ?? null,
        token: `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 48),
        expiresAt: daysAgo(-7),
      },
    });
  }
}

async function seedOutboundApprovals(input: {
  candidateKey: string;
  candidateId: string;
  operatorUserId?: string | null;
  reviewerUserId?: string | null;
}) {
  const topBrief = await prisma.opportunityBrief.findFirst({
    where: {
      candidateId: input.candidateId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!topBrief) {
    return;
  }

  const seedByCandidate: Record<
    string,
    Array<{
      approvalType: OutboundApprovalType;
      status: OutboundApprovalStatus;
      title: string;
      rationale: string;
      decisionNote: string;
    }>
  > = {
    "maya-rios": [
      {
        approvalType: OutboundApprovalType.OUTREACH_RELEASE,
        status: OutboundApprovalStatus.APPROVED,
        title: "Sponsor-facing outreach release",
        rationale: "The memo is evidence-backed, the brief is ready, and the sponsor path is strong enough for external movement.",
        decisionNote: "Approved for sponsor-facing outreach. Keep the ask narrow and use the cited brief first.",
      },
      {
        approvalType: OutboundApprovalType.CRM_HANDOFF,
        status: OutboundApprovalStatus.APPROVED,
        title: "CRM handoff release",
        rationale: "Operations can safely move the current sponsor path into the outbound handoff queue.",
        decisionNote: "Approved for CRM sync and sponsor operations follow-through.",
      },
    ],
    "nia-okafor": [
      {
        approvalType: OutboundApprovalType.OUTREACH_RELEASE,
        status: OutboundApprovalStatus.PENDING,
        title: "Sponsor-facing outreach release",
        rationale: "The file is promising, but an operator should confirm the proof depth before sponsor-facing use.",
        decisionNote: "Pending second operator check on the longest-horizon execution proof.",
      },
    ],
    "jonah-park": [
      {
        approvalType: OutboundApprovalType.OUTREACH_RELEASE,
        status: OutboundApprovalStatus.REJECTED,
        title: "Sponsor-facing outreach release",
        rationale: "The current case is analytically strong but still not ready for external advocacy.",
        decisionNote: "Rejected until the file includes one clearer example of team-level ownership and a refreshed proof artifact.",
      },
    ],
  };

  for (const seed of seedByCandidate[input.candidateKey] ?? []) {
    await prisma.outboundApproval.create({
      data: {
        candidateId: input.candidateId,
        sponsorId: topBrief.sponsorId,
        opportunityBriefId: topBrief.id,
        requestedById: input.operatorUserId ?? input.reviewerUserId ?? null,
        reviewedById:
          seed.status === OutboundApprovalStatus.PENDING ? null : input.reviewerUserId ?? input.operatorUserId ?? null,
        approvalType: seed.approvalType,
        status: seed.status,
        title: seed.title,
        rationale: seed.rationale,
        decisionNote: seed.status === OutboundApprovalStatus.PENDING ? null : seed.decisionNote,
        reviewedAt: seed.status === OutboundApprovalStatus.PENDING ? null : daysAgo(1),
      },
    });
  }
}

async function seedSavedViews(input: {
  organizationId: string;
  createdById: string | null;
}) {
  await prisma.savedView.createMany({
    data: [
      {
        organizationId: input.organizationId,
        createdById: input.createdById,
        page: SavedViewPage.CANDIDATES,
        title: "Sponsor-ready queue",
        description: "High-readiness files that already have a memo and are close to sponsor movement.",
        queryString: "readiness=high&memoStatus=READY",
      },
      {
        organizationId: input.organizationId,
        createdById: input.createdById,
        page: SavedViewPage.CANDIDATES,
        title: "Needs proof follow-up",
        description: "Files with pending review friction that should stay in evidence strengthening.",
        queryString: "reviewState=pending&readiness=medium",
      },
      {
        organizationId: input.organizationId,
        createdById: input.createdById,
        page: SavedViewPage.CANDIDATES,
        title: "Manual override watchlist",
        description: "Candidates currently sitting in a manual stage override.",
        queryString: "automation=MANUAL_OVERRIDE",
      },
      {
        organizationId: input.organizationId,
        createdById: input.createdById,
        page: SavedViewPage.TASKS,
        title: "Urgent owner queue",
        description: "High-priority tasks that already have a live owner and need active follow-through.",
        queryString: "priority=HIGH&status=OPEN",
      },
      {
        organizationId: input.organizationId,
        createdById: input.createdById,
        page: SavedViewPage.PIPELINE,
        title: "High-fit sponsor paths",
        description: "Strong sponsor matches that should stay in active operator review.",
        queryString: "score=high&stage=UNDER_REVIEW",
      },
    ],
  });
}

async function seedCandidateUpdates(input: {
  candidateKey: string;
  candidateId: string;
  submittedByUserId: string | null;
  incorporatedById: string | null;
}) {
  const proofRequests = await prisma.proofRequest.findMany({
    where: {
      candidateId: input.candidateId,
    },
    orderBy: { createdAt: "asc" },
  });

  const updateSeeds: Record<
    string,
    Array<{
      title: string;
      summary: string;
      submittedByLabel: string;
      artifactType: "PROJECT_SUMMARY" | "MENTOR_NOTE";
      sourceLabel: string;
      rawText: string;
      status: CandidateUpdateStatus;
      incorporationNote: string;
      sourceProofRequestIndex?: number;
    }>
  > = {
    "maya-rios": [
      {
        title: "Community pilot outcome follow-up",
        summary: "Added a clearer quantified result and named the team coordination work that produced it.",
        submittedByLabel: "Candidate follow-up",
        artifactType: "PROJECT_SUMMARY",
        sourceLabel: "Candidate update",
        rawText:
          "Since the original reflection, I can now quantify the pilot outcome more clearly. The texting workflow reached 420 students across three neighborhoods, and the completion rate improved from 58% to 79% over the six-week pilot. I also coordinated two volunteer leads and a district operations contact to keep the outreach sequence running after the first two weeks.",
        status: CandidateUpdateStatus.INCORPORATED,
        incorporationNote: "Quantified outcome has been incorporated into the file and closes the open proof gap on execution depth.",
        sourceProofRequestIndex: 0,
      },
    ],
    "nia-okafor": [
      {
        title: "Long-horizon delivery clarification",
        summary: "Added a new example of sustained execution, but the update still needs third-party corroboration before outreach.",
        submittedByLabel: "Candidate follow-up",
        artifactType: "MENTOR_NOTE",
        sourceLabel: "Mentor follow-up note",
        rawText:
          "I supervised Nia during the second phase of the youth mental health rollout. She maintained the volunteer schedule across an eight-week stretch, surfaced blockers early, and kept partner schools informed, but we still need one stronger written example of how she handled a setback without direct operator intervention.",
        status: CandidateUpdateStatus.NEEDS_FOLLOW_UP,
        incorporationNote: "Useful update, but still needs one stronger corroborated example before the file should move sponsor-facing.",
        sourceProofRequestIndex: 0,
      },
    ],
  };

  for (const seed of updateSeeds[input.candidateKey] ?? []) {
    const artifact = await prisma.artifact.create({
      data: {
        candidateId: input.candidateId,
        artifactType: seed.artifactType,
        title: seed.title,
        rawText: seed.rawText,
        sourceLabel: seed.sourceLabel,
      },
    });

    const sourceProofRequest = typeof seed.sourceProofRequestIndex === "number" ? proofRequests[seed.sourceProofRequestIndex] : null;

    await prisma.candidateUpdate.create({
      data: {
        candidateId: input.candidateId,
        sourceProofRequestId: sourceProofRequest?.id ?? null,
        submittedByUserId: input.submittedByUserId,
        incorporatedById:
          seed.status === CandidateUpdateStatus.INCORPORATED || seed.status === CandidateUpdateStatus.NEEDS_FOLLOW_UP
            ? input.incorporatedById
            : null,
        artifactId: artifact.id,
        title: seed.title,
        summary: seed.summary,
        submittedByLabel: seed.submittedByLabel,
        status: seed.status,
        incorporationNote: seed.incorporationNote,
        incorporatedAt:
          seed.status === CandidateUpdateStatus.INCORPORATED || seed.status === CandidateUpdateStatus.NEEDS_FOLLOW_UP
            ? daysAgo(0)
            : null,
      },
    });
  }
}

async function seedCommitteeReviews(input: {
  candidateKey: string;
  candidateId: string;
  operatorUserId?: string | null;
  reviewerUserId?: string | null;
  coordinatorUserId?: string | null;
}) {
  const seeds: Record<
    string,
    Array<{
      status: CommitteeReviewStatus;
      finalDecision?: CommitteeVoteDecision;
      title: string;
      summary: string;
      finalNote?: string;
      votes: Array<{
        userId: string | null | undefined;
        decision: CommitteeVoteDecision;
        rationale: string;
      }>;
    }>
  > = {
    "maya-rios": [
      {
        status: CommitteeReviewStatus.FINALIZED,
        finalDecision: CommitteeVoteDecision.ADVANCE,
        title: "Committee underwriting review",
        summary: "The committee agreed Maya now has enough execution proof and sponsor fit clarity for sponsor-facing movement.",
        finalNote: "Advance with a targeted climate resilience sponsor path and keep the quantified pilot outcome in the first proof set.",
        votes: [
          {
            userId: input.operatorUserId,
            decision: CommitteeVoteDecision.ADVANCE,
            rationale: "The updated pilot evidence closes the earlier proof gap.",
          },
          {
            userId: input.reviewerUserId,
            decision: CommitteeVoteDecision.ADVANCE,
            rationale: "The sponsor case is now specific enough for advocacy.",
          },
        ],
      },
    ],
    "jonah-park": [
      {
        status: CommitteeReviewStatus.VOTING,
        title: "Committee escalation on leadership scope",
        summary: "The file is analytically strong, but the committee still needs to decide whether the evidence supports sponsor-facing leadership claims.",
        votes: [
          {
            userId: input.operatorUserId,
            decision: CommitteeVoteDecision.REQUEST_MORE_PROOF,
            rationale: "The file still needs one clearer ownership example before sponsor outreach.",
          },
          {
            userId: input.coordinatorUserId,
            decision: CommitteeVoteDecision.HOLD,
            rationale: "Direction is promising, but committee signoff is not there yet.",
          },
        ],
      },
    ],
  };

  for (const seed of seeds[input.candidateKey] ?? []) {
    const review = await prisma.committeeReview.create({
      data: {
        candidateId: input.candidateId,
        createdById: input.operatorUserId ?? input.reviewerUserId ?? null,
        chairUserId: input.coordinatorUserId ?? input.reviewerUserId ?? null,
        status: seed.status,
        finalDecision: seed.finalDecision ?? null,
        title: seed.title,
        summary: seed.summary,
        finalNote: seed.finalNote ?? null,
        dueAt: daysAgo(-5),
        finalizedAt: seed.status === CommitteeReviewStatus.FINALIZED ? daysAgo(0) : null,
      },
    });

    for (const vote of seed.votes) {
      if (!vote.userId) {
        continue;
      }

      await prisma.committeeReviewVote.create({
        data: {
          committeeReviewId: review.id,
          userId: vote.userId,
          decision: vote.decision,
          rationale: vote.rationale,
        },
      });
    }
  }
}

export async function resetAndSeedDemo() {
  await prisma.appSession.deleteMany();
  await prisma.alertDigestDelivery.deleteMany();
  await prisma.pilotMetricSnapshot.deleteMany();
  await prisma.committeeReviewVote.deleteMany();
  await prisma.committeeReview.deleteMany();
  await prisma.outboundEmailEvent.deleteMany();
  await prisma.outboundEmail.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.operatorTask.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.outboundApproval.deleteMany();
  await prisma.candidateUpdateAccessLink.deleteMany();
  await prisma.candidateUpdate.deleteMany();
  await prisma.proofRequest.deleteMany();
  await prisma.disagreementReview.deleteMany();
  await prisma.candidateStageEvent.deleteMany();
  await prisma.operatorAlert.deleteMany();
  await prisma.sponsorOutcome.deleteMany();
  await prisma.sponsorPipelineItem.deleteMany();
  await prisma.candidateProgressSnapshot.deleteMany();
  await prisma.sponsorActivity.deleteMany();
  await prisma.crmSyncRecord.deleteMany();
  await prisma.candidateDecision.deleteMany();
  await prisma.candidateNote.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.sponsorMemo.deleteMany();
  await prisma.evidenceClaim.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.relationshipEdge.deleteMany();
  await prisma.sponsor.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.userPasswordCredential.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.appSetting.deleteMany();

  const workspace = await prisma.organization.create({
    data: {
      name: "SignalSponsor Demo Workspace",
      slug: "signalsponsor-demo",
      description: "Seeded workspace for sponsorship diligence, alert routing, and operator workflow demos.",
    },
  });

  await prisma.user.createMany({
    data: userSeeds,
  });

  const createdUsers = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
  await prisma.userPasswordCredential.createMany({
    data: createdUsers.map((user) => ({
      userId: user.id,
      passwordHash: hashPassword(env.demoUserPassword),
      mustRotate: user.role === "ADMIN",
    })),
  });
  const ownerUserId = createdUsers[0]?.id ?? null;
  const operatorUserId = createdUsers[1]?.id ?? ownerUserId;
  const reviewerUserId = createdUsers[2]?.id ?? operatorUserId;
  const coordinatorUserId = createdUsers[3]?.id ?? reviewerUserId;

  await prisma.organizationMembership.createMany({
    data: createdUsers.map((user, index) => ({
      organizationId: workspace.id,
      userId: user.id,
      membershipRole:
        index === 0 ? MembershipRole.OWNER : index === 1 ? MembershipRole.ADMIN : MembershipRole.MEMBER,
      title:
        index === 0
          ? "Founding operator"
          : index === 1
            ? "Program operator"
            : "Sponsorship reviewer",
    })),
  });

  await prisma.appSetting.createMany({
    data: [
      { key: "AI_MODE", value: "mock" },
      { key: "AI_RUNTIME_MODE", value: "mock" },
      { key: "AI_RUNTIME_NOTE", value: "Using deterministic mock mode." },
      { key: "CRM_SYNC_MODE", value: "mock" },
      { key: "CRM_RUNTIME_MODE", value: "mock" },
      { key: "CRM_RUNTIME_NOTE", value: "Using local mock CRM sync." },
      { key: "EMAIL_SEND_MODE", value: "mock" },
      { key: "EMAIL_RUNTIME_MODE", value: "mock" },
      { key: "EMAIL_RUNTIME_NOTE", value: "Using local mock email delivery." },
      { key: "BACKGROUND_JOBS_MODE", value: "inline" },
      { key: "BACKGROUND_JOBS_RUNTIME_NOTE", value: "Background work runs inline inside operator actions." },
      { key: "FILE_STORAGE_MODE", value: "local" },
      { key: "FILE_STORAGE_PATH", value: ".data/storage" },
      { key: "ALERT_NOTIFY_EMAIL", value: "false" },
      { key: "ALERT_NOTIFY_SLACK", value: "false" },
      { key: "ALERT_NOTIFY_OPS", value: "true" },
      { key: "BLIND_REVIEW_MODE", value: "false" },
      { key: "STRICT_EVIDENCE_MODE", value: "true" },
      { key: "REQUIRE_OUTBOUND_APPROVAL", value: "true" },
      { key: "BLOCK_SPONSOR_FACING_PII", value: "true" },
      { key: "PILOT_TEMPLATE", value: "FOUNDATION" },
      { key: "GUIDED_DEMO_MODE", value: "true" },
      {
        key: "PILOT_RUNTIME_NOTE",
        value: "Pilot positioning defaults to small foundation with guided demo mode enabled.",
      },
      {
        key: "PILOT_PROFILE",
        value: JSON.stringify({
          pilotName: "North Star Foundation sponsorship pilot",
          designPartnerName: "North Star Foundation",
          programName: "Emerging Leaders sponsorship review",
          primaryContactName: "Leah Benton",
          primaryContactEmail: "pilot@northstarfoundation.demo",
          targetLaunchDate: daysFromNowDateOnly(14),
          packSummary:
            "A contained foundation pilot focused on evidence-backed sponsorship decisions, explicit proof-request follow-through, and measured sponsor-path outcomes.",
        }),
      },
      {
        key: "PILOT_LAUNCH_WORKSTREAM",
        value: JSON.stringify({
          FOUNDATION: {
            "choose-one-operator-owner": {
              status: "READY",
              owner: "Program lead",
              note: "Leah Benton owns weekly review cadence and final sponsor-readiness standard.",
              dueAt: daysFromNowDateOnly(3),
              completedAt: daysAgo(9).toISOString(),
              updatedAt: daysAgo(9).toISOString(),
            },
            "seed-a-contained-slate": {
              status: "IN_PROGRESS",
              owner: "Ops analyst",
              note: "Seeded 12 live files. Two still need final artifact cleanup before buyer-facing walkthrough use.",
              dueAt: daysFromNowDateOnly(2),
              updatedAt: daysAgo(1).toISOString(),
            },
            "set-the-review-standard": {
              status: "READY",
              owner: "Review committee",
              note: "Hold, request-more-proof, and sponsor-ready thresholds were documented in the reviewer calibration session.",
              dueAt: daysFromNowDateOnly(1),
              completedAt: daysAgo(6).toISOString(),
              updatedAt: daysAgo(6).toISOString(),
            },
            "capture-a-baseline": {
              status: "IN_PROGRESS",
              owner: "Pilot manager",
              note: "Baseline exists; the next checkpoint is scheduled after the coming sponsor-review cycle.",
              dueAt: daysFromNowDateOnly(7),
              updatedAt: daysAgo(2).toISOString(),
            },
          },
        }),
      },
      { key: "APP_NAME", value: "SignalSponsor" },
      { key: "AUTOMATION_MIN_ARTIFACTS_FOR_REVIEW", value: String(DEFAULT_AUTOMATION_POLICY.minArtifactsForReview) },
      { key: "AUTOMATION_MIN_CLAIMS_FOR_REVIEW", value: String(DEFAULT_AUTOMATION_POLICY.minClaimsForReview) },
      { key: "AUTOMATION_INTAKE_READINESS_MAX", value: String(DEFAULT_AUTOMATION_POLICY.intakeReadinessMax) },
      { key: "AUTOMATION_MEMO_READINESS_MIN", value: String(DEFAULT_AUTOMATION_POLICY.memoReadinessMin) },
      { key: "AUTOMATION_OUTREACH_READINESS_MIN", value: String(DEFAULT_AUTOMATION_POLICY.outreachReadinessMin) },
      { key: "AUTOMATION_OUTREACH_MATCH_MIN", value: String(DEFAULT_AUTOMATION_POLICY.outreachMatchMin) },
      { key: "AUTOMATION_HOLD_READINESS_MAX", value: String(DEFAULT_AUTOMATION_POLICY.holdReadinessMax) },
      { key: "AUTOMATION_STALLED_DELTA_MAX", value: String(DEFAULT_AUTOMATION_POLICY.stalledDeltaMax) },
      { key: "AUTOMATION_MOMENTUM_SURGE_DELTA_MIN", value: String(DEFAULT_AUTOMATION_POLICY.momentumSurgeDeltaMin) },
    ],
  });

  await seedSavedViews({
    organizationId: workspace.id,
    createdById: ownerUserId,
  });

  const sponsorMap = new Map<string, string>();
  const candidateMap = new Map<string, string>();
  let seededDisagreementTask = false;

  for (const sponsor of sponsorSeeds) {
    const created = await prisma.sponsor.create({
      data: {
        fullName: sponsor.fullName,
        organizationId: workspace.id,
        title: sponsor.title,
        organization: sponsor.organization,
        domainExpertise: sponsor.domainExpertise,
        seniorityLevel: sponsor.seniorityLevel,
        sponsorStyle: sponsor.sponsorStyle,
        availabilityStatus: sponsor.availabilityStatus ?? (sponsor.warmIntroAvailable ? SponsorAvailabilityStatus.OPEN : SponsorAvailabilityStatus.LIMITED),
        maxConcurrentPaths: sponsor.maxConcurrentPaths ?? (sponsor.seniorityLevel === "PARTNER" || sponsor.seniorityLevel === "EXECUTIVE" ? 5 : 4),
        availabilityNote: sponsor.availabilityNote ?? null,
        blackoutUntil: typeof sponsor.blackoutUntilDaysFromNow === "number" ? daysAgo(-sponsor.blackoutUntilDaysFromNow) : null,
        blackoutReason: sponsor.blackoutReason ?? null,
        interestTags: sponsor.interestTags,
        geography: sponsor.geography,
        warmIntroAvailable: sponsor.warmIntroAvailable,
        bio: sponsor.bio,
      },
    });

    sponsorMap.set(sponsor.key, created.id);
  }

  for (const candidate of candidateSeeds) {
    const created = await prisma.candidate.create({
      data: {
        fullName: candidate.fullName,
        organizationId: workspace.id,
        headline: candidate.headline,
        bio: candidate.bio,
        region: candidate.region,
        currentStage: candidate.currentStage,
      },
    });

    candidateMap.set(candidate.key, created.id);

    await prisma.artifact.createMany({
      data: candidate.artifacts.map((artifact) => ({
        candidateId: created.id,
        artifactType: artifact.artifactType,
        title: artifact.title,
        rawText: artifact.rawText,
        sourceLabel: artifact.sourceLabel,
        fileName: artifact.fileName,
      })),
    });
  }

  await prisma.relationshipEdge.createMany({
    data: relationshipSeeds.map((edge) => ({
      organizationId: workspace.id,
      fromEntityType: edge.fromEntityType,
      fromEntityId:
        edge.fromEntityType === "CANDIDATE"
          ? resolveEntityId("candidate", edge.fromKey, { candidateMap, sponsorMap })
          : edge.fromEntityType === "SPONSOR"
            ? resolveEntityId("sponsor", edge.fromKey, { candidateMap, sponsorMap })
            : edge.fromKey,
      toEntityType: edge.toEntityType,
      toEntityId:
        edge.toEntityType === "CANDIDATE"
          ? resolveEntityId("candidate", edge.toKey, { candidateMap, sponsorMap })
          : edge.toEntityType === "SPONSOR"
            ? resolveEntityId("sponsor", edge.toKey, { candidateMap, sponsorMap })
            : edge.toKey,
      edgeType: edge.edgeType,
      strength: edge.strength,
      notes: edge.notes,
    })),
  });

  for (const candidate of candidateSeeds) {
    const candidateId = candidateMap.get(candidate.key);

    if (!candidateId) {
      continue;
    }

    const extraction = await extractCandidateEvidence(candidateId, "mock");
    const current = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      include: { artifacts: true, evidenceClaims: true },
    });
    const edges = await prisma.relationshipEdge.findMany({
      where: {
        OR: [{ fromEntityId: candidateId }, { toEntityId: candidateId }],
      },
    });
    const readiness = computeSponsorReadiness(current, current.artifacts, current.evidenceClaims, edges);

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        sponsorReadinessScore: readiness.score,
      },
    });

    if (candidate.key !== "diego-alvarez" && extraction.claims.length > 0) {
      await generateCandidateMemo(candidateId, "mock");
      await generateCandidateRecommendations(candidateId, "mock");
      await generateCandidateOpportunityBriefs(candidateId, "mock");
      await syncCandidateSponsorPipeline(candidateId);
    }

    await seedClaimReviewStates(candidate.key, candidateId, candidate.currentStage);
    await seedRecommendationReviewStates(candidate.key, candidateId, candidate.currentStage);
    await seedWorkflowContext({
      candidateKey: candidate.key,
      candidateId,
      stage: candidate.currentStage,
      ownerUserId,
      operatorUserId,
      reviewerUserId,
      coordinatorUserId,
    });
    await seedProofRequests({
      candidateKey: candidate.key,
      candidateId,
      operatorUserId,
      reviewerUserId,
      coordinatorUserId,
    });
    await seedCandidateUpdates({
      candidateKey: candidate.key,
      candidateId,
      submittedByUserId: operatorUserId,
      incorporatedById: reviewerUserId,
    });
    await seedCommitteeReviews({
      candidateKey: candidate.key,
      candidateId,
      operatorUserId,
      reviewerUserId,
      coordinatorUserId,
    });
    await seedOutboundApprovals({
      candidateKey: candidate.key,
      candidateId,
      operatorUserId,
      reviewerUserId,
    });
    await seedSponsorOperations(workspace.id, candidate.key, candidateId, candidate.currentStage);
    await seedProgressHistory(candidateId, candidate.currentStage);
    await evaluateCandidateAutomation(candidateId);

    if (candidate.key === "maya-rios" || candidate.key === "jonah-park" || candidate.key === "nia-okafor") {
      const currentAudit = await getCurrentDecisionAudit(candidateId, workspace.id);

      if (currentAudit?.audit.hasDisagreement) {
        const review = await upsertDisagreementReview({
          candidateId,
          organizationId: workspace.id,
          assignedUserId: reviewerUserId,
          dueAt: daysAgo(-3),
        });

        if (!seededDisagreementTask) {
          await createTaskFromDisagreementReview(review.id);
          seededDisagreementTask = true;
        }
      }
    }
  }

  const manualOverrideCandidateId = candidateMap.get("jonah-park");

  if (manualOverrideCandidateId) {
    await applyManualStageOverride({
      candidateId: manualOverrideCandidateId,
      stage: CandidateStage.HOLD,
      rationale:
        "Seeded operator override. Hold external outreach until the file includes one clearer example of cross-functional ownership beyond analysis.",
      actorLabel: "Seeded operator override",
    });
  }

  await sendOperatorAlertDigest("all");

  const [teamMembers, openAlerts] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: {
        organizationId: workspace.id,
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.operatorAlert.findMany({
      where: {
        candidate: {
          organizationId: workspace.id,
        },
        status: "OPEN",
      },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
  ]);

  for (const [index, alert] of openAlerts.entries()) {
    const assignee = teamMembers[(index + 1) % teamMembers.length];
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + index + 1);

    await prisma.operatorAlert.update({
      where: { id: alert.id },
      data: {
        assignedUserId: assignee?.userId ?? null,
        dueAt,
      },
    });
  }

  for (const alert of openAlerts.slice(0, 3)) {
    await createTaskFromAlert(alert.id);
  }

  const createdTasks = await prisma.operatorTask.findMany({
    where: {
      organizationId: workspace.id,
    },
    orderBy: { createdAt: "asc" },
  });

  if (createdTasks[0]) {
    await prisma.operatorTask.update({
      where: { id: createdTasks[0].id },
      data: {
        status: TaskStatus.IN_PROGRESS,
      },
    });
  }

  if (createdTasks[1]) {
    await prisma.operatorTask.update({
      where: { id: createdTasks[1].id },
      data: {
        status: TaskStatus.BLOCKED,
      },
    });
  }

  const outreachCandidateId = candidateMap.get("maya-rios");
  const outreachSponsorId = sponsorMap.get("helena-brooks") ?? sponsorMap.values().next().value;

  if (outreachCandidateId && outreachSponsorId) {
    await prisma.operatorTask.create({
      data: {
        organizationId: workspace.id,
        candidateId: outreachCandidateId,
        sponsorId: outreachSponsorId,
        ownerUserId: operatorUserId,
        title: "Complete sponsor packet follow-up",
        detail:
          "Seeded workflow task to finalize the post-meeting packet and confirm the specific sponsor ask after the first diligence conversation.",
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.MEDIUM,
        dueAt: daysAgo(1),
        completedAt: daysAgo(0),
        sourceLabel: "Seeded sponsor operations",
      },
    });

    const outreachBrief = await prisma.opportunityBrief.findFirst({
      where: {
        candidateId: outreachCandidateId,
        sponsorId: outreachSponsorId,
      },
      orderBy: { updatedAt: "desc" },
    });

    const seededOutboundEmail = await prisma.outboundEmail.create({
      data: {
        candidateId: outreachCandidateId,
        sponsorId: outreachSponsorId,
        opportunityBriefId: outreachBrief?.id ?? null,
        requestedById: operatorUserId,
        draftId: "warm-intro",
        draftLabel: "Warm intro note",
        subject: "Maya Rios · neighborhood resilience operator ready for a scoped sponsor conversation",
        body:
          "Helena, sharing a concise sponsor case for Maya Rios. The evidence set shows disciplined pilot delivery, credible community trust, and a narrow ask for one sponsor-backed diligence conversation.",
        providerMode: "MOCK",
        status: "SENT",
        recipientEmail: "helena@signalsponsor.demo",
        threadKey: `${outreachCandidateId}:${outreachSponsorId}`,
        externalMessageId: `seed-outbound-${outreachCandidateId}`,
        payloadJson: JSON.stringify({
          contractVersion: "v2",
          provider: "mock",
          seeded: true,
        }),
        sendNote: "Seeded outbound note stored in the local demo outbox.",
        sentAt: daysAgo(1),
      },
    });

    await prisma.outboundEmailEvent.createMany({
      data: [
        {
          outboundEmailId: seededOutboundEmail.id,
          actorUserId: operatorUserId,
          eventType: OutboundEmailEventType.SENT,
          title: "Seeded warm intro note sent",
          detail: "Seeded initial warm intro note for the active sponsor path.",
          createdAt: daysAgo(1),
          occurredAt: daysAgo(1),
        },
        {
          outboundEmailId: seededOutboundEmail.id,
          actorUserId: coordinatorUserId,
          eventType: OutboundEmailEventType.REPLY_RECEIVED,
          title: "Connector replied with meeting availability",
          detail: "Seeded reply indicating the sponsor is open to a first diligence conversation next week.",
          createdAt: daysAgo(0),
          occurredAt: daysAgo(0),
        },
        {
          outboundEmailId: seededOutboundEmail.id,
          actorUserId: operatorUserId,
          eventType: OutboundEmailEventType.FOLLOW_UP_SCHEDULED,
          title: "Follow-up package scheduled",
          detail: "Seeded follow-up reminding the operator to send the cited evidence set if the meeting is confirmed.",
          createdAt: daysAgo(0),
          occurredAt: daysAgo(0),
        },
      ],
    });

    await prisma.auditLog.createMany({
      data: [
        {
          organizationId: workspace.id,
          candidateId: outreachCandidateId,
          sponsorId: outreachSponsorId,
          actorUserId: operatorUserId,
          targetType: AuditLogTargetType.OUTBOUND_EMAIL,
          action: "outbound_email.sent",
          title: "Seeded outbound email sent",
          detail: "Seeded sponsor-facing email recorded for the strongest active sponsor path.",
          createdAt: daysAgo(1),
        },
        {
          organizationId: workspace.id,
          candidateId: outreachCandidateId,
          sponsorId: outreachSponsorId,
          actorUserId: reviewerUserId,
          targetType: AuditLogTargetType.OUTBOUND_APPROVAL,
          action: "outbound_approval.reviewed",
          title: "Seeded outreach approval reviewed",
          detail: "Seeded approval review shows the sponsor-facing release was explicitly approved.",
          createdAt: daysAgo(1),
        },
        {
          organizationId: workspace.id,
          candidateId: manualOverrideCandidateId ?? null,
          actorUserId: reviewerUserId,
          targetType: AuditLogTargetType.STAGE,
          action: "candidate.manual_stage_override",
          title: "Seeded manual stage override",
          detail: "Seeded operator override keeps Jonah Park on hold until stronger ownership proof is added.",
          createdAt: daysAgo(0),
        },
      ],
    });
  }

  const pilotMetrics = await buildCurrentPilotMetricsForOrganization(workspace.id);

  await prisma.pilotMetricSnapshot.createMany({
    data: [
      {
        organizationId: workspace.id,
        capturedById: ownerUserId,
        snapshotType: PilotMetricSnapshotType.BASELINE,
        title: "Pilot baseline",
        note: "Seeded baseline representing the early operating state before the current workflow matured.",
        candidateCount: pilotMetrics.candidateCount,
        memoReadyCount: Math.max(pilotMetrics.memoReadyCount - 3, 2),
        sponsorReadyCount: Math.max(pilotMetrics.sponsorReadyCount - 2, 1),
        activePipelineCount: Math.max(pilotMetrics.activePipelineCount - 1, 1),
        openAlertsCount: pilotMetrics.openAlertsCount + 2,
        openTasksCount: pilotMetrics.openTasksCount + 2,
        knownOutcomeCount: Math.max(pilotMetrics.knownOutcomeCount - 1, 0),
        positiveOutcomeCount: Math.max(pilotMetrics.positiveOutcomeCount - 1, 0),
        disagreementRate: Math.min(pilotMetrics.disagreementRate + 12, 100),
        averageReviewMinutes: 68,
        sampledReviewCount: 5,
        blindReviewMode: false,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
        capturedAt: daysAgo(28),
      },
      {
        organizationId: workspace.id,
        capturedById: operatorUserId,
        snapshotType: PilotMetricSnapshotType.CHECKPOINT,
        title: "Pilot checkpoint",
        note: "Seeded checkpoint representing the most recent measured review before the current live state.",
        candidateCount: pilotMetrics.candidateCount,
        memoReadyCount: Math.max(pilotMetrics.memoReadyCount - 1, 2),
        sponsorReadyCount: Math.max(pilotMetrics.sponsorReadyCount - 1, 1),
        activePipelineCount: pilotMetrics.activePipelineCount,
        openAlertsCount: Math.max(pilotMetrics.openAlertsCount + 1, 1),
        openTasksCount: Math.max(pilotMetrics.openTasksCount, 1),
        knownOutcomeCount: pilotMetrics.knownOutcomeCount,
        positiveOutcomeCount: pilotMetrics.positiveOutcomeCount,
        disagreementRate: Math.min(pilotMetrics.disagreementRate + 4, 100),
        averageReviewMinutes: 44,
        sampledReviewCount: 7,
        blindReviewMode: false,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
        capturedAt: daysAgo(7),
      },
    ],
  });
}
