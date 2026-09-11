import {
  AlertStatus,
  BackgroundJobStatus,
  BriefStatus,
  OutboundApprovalType,
  PilotMetricSnapshotType,
  SavedViewPage,
  CrmSyncStatus,
  DisagreementReviewStatus,
  MembershipRole,
  MemoStatus,
  ProofRequestStatus,
  RecommendationType,
  TaskStatus,
  type Artifact,
  type Candidate,
  type CandidateProgressSnapshot,
  type EvidenceClaim,
  type OperatorAlert,
  type RelationshipEdge,
  type Sponsor,
} from "@prisma/client";

import { buildDecisionAuditReport, createDecisionAuditRow } from "@/lib/audits/report";
import { buildWarmPath, buildWarmPathInsight } from "@/lib/ai";
import { getAutomationPolicy } from "@/lib/automation/policy";
import { getAppSession, requirePageSession } from "@/lib/auth/session";
import {
  buildDecisionQualitySummary,
  buildOutcomeLearningPatterns,
  buildReviewerCalibrationRows,
  buildScoreRecalibrationSuggestions,
  deriveCandidateOutcomeRows,
  getCandidateLearningInsight,
} from "@/lib/calibration/report";
import { buildReviewerCalibrationWorkspace } from "@/lib/calibration/workspace";
import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { formatCrmFieldMappingsForEditor } from "@/lib/crm/mappings";
import { buildProofRequestSlaState, buildProofRequestSuggestions } from "@/lib/proof-requests";
import {
  buildCurrentPilotMetricsForOrganization,
  buildMeasuredReviewTimeDeltaRow,
  buildPilotObservedDeltaRows,
  formatPilotSnapshot,
} from "@/lib/pilot/measurements";
import { buildDefaultPilotProfile, buildPilotLaunchWorkstream, parsePilotProfile } from "@/lib/pilot/workspace";
import { buildPilotRoiModel, getPilotTemplate } from "@/lib/pilot/templates";
import { buildCommercialReadinessModel } from "@/lib/pilot/commercial";
import { buildPilotProofReport } from "@/lib/pilot/report";
import { buildPilotBuyerPack } from "@/lib/pilot/pack";
import { buildCandidateTrajectory } from "@/lib/progress";
import {
  buildCommitteeConsensusLabel,
  COMMITTEE_REVIEW_STATUS_LABELS,
  COMMITTEE_VOTE_LABELS,
  summarizeCommitteeVotes,
} from "@/lib/committee/reviews";
import {
  buildRecommendationFreshnessReport,
  summarizeRecommendationFreshness,
} from "@/lib/recommendations/freshness";
import { buildSponsorPathHistorySummary, summarizeOutboundApprovalState } from "@/lib/outreach/approvals";
import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";
import { anonymizeCandidateIdentity, buildCandidateSafetyReport } from "@/lib/safety/guardrails";
import { getSafetySettings } from "@/lib/safety/settings";
import { buildSponsorOperatingProfile, computeSponsorMatch, computeSponsorReadiness } from "@/lib/scoring";
import { getDeploymentHealthSnapshot } from "@/lib/runtime/health";
import { formatDate } from "@/lib/utils/format";
import { parseDelimitedList } from "@/lib/utils/strings";

type SearchValue = string | string[] | undefined;
type AuditWorkspaceSession = {
  organizationId: string;
  organization: {
    name: string;
  };
};

function groupSponsorOperatingContext<
  TActivity extends { sponsorId: string },
  TPipeline extends { sponsorId: string },
  TOutcome extends { sponsorId: string },
>(activities: TActivity[], pipelineItems: TPipeline[], sponsorOutcomes: TOutcome[]) {
  return new Map(
    Array.from(
      new Set([
        ...activities.map((item) => item.sponsorId),
        ...pipelineItems.map((item) => item.sponsorId),
        ...sponsorOutcomes.map((item) => item.sponsorId),
      ]),
    ).map(
      (sponsorId) => [
        sponsorId,
        {
          sponsorActivities: activities.filter((item) => item.sponsorId === sponsorId),
          sponsorPipelineItems: pipelineItems.filter((item) => item.sponsorId === sponsorId),
          sponsorOutcomes: sponsorOutcomes.filter((item) => item.sponsorId === sponsorId),
        },
      ],
    ),
  );
}

function getCurrentArtifacts<T extends { id: string; isCurrentVersion: boolean }>(artifacts: T[]) {
  const currentArtifacts = artifacts.filter((artifact) => artifact.isCurrentVersion);
  return currentArtifacts.length > 0 ? currentArtifacts : artifacts;
}

function filterClaimsForArtifacts<TClaim extends { artifactId: string }, TArtifact extends { id: string; isCurrentVersion: boolean }>(
  claims: TClaim[],
  artifacts: TArtifact[],
) {
  const currentArtifactIds = new Set(getCurrentArtifacts(artifacts).map((artifact) => artifact.id));
  return claims.filter((claim) => currentArtifactIds.has(claim.artifactId));
}

function sortProofRequestsForWorkflow<
  TRequest extends { status: ProofRequestStatus; updatedAt: Date; createdAt: Date },
>(requests: TRequest[]) {
  const statusPriority: Record<ProofRequestStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 1,
    RESOLVED: 2,
    CANCELED: 3,
  };

  return [...requests].sort((left, right) => {
    const priorityDelta = statusPriority[left.status] - statusPriority[right.status];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime() || right.createdAt.getTime() - left.createdAt.getTime();
  });
}

type CandidateFilterShape = Candidate & {
  artifacts: Artifact[];
  evidenceClaims: EvidenceClaim[];
  operatorAlerts: OperatorAlert[];
  progressSnapshots: CandidateProgressSnapshot[];
  sponsorMemo: { status: MemoStatus } | null;
  recommendations: {
    id: string;
    reviewStatus: import("@prisma/client").ReviewStatus;
    recommendationType?: RecommendationType;
    sponsorId?: string | null;
    score?: number;
    updatedAt?: Date;
  }[];
  opportunityBriefs: { id: string; status: BriefStatus }[];
  candidateUpdates?: { updatedAt: Date }[];
  proofRequests?: { updatedAt: Date; status: ProofRequestStatus }[];
};

export function searchValueToString(value: SearchValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export async function getGlobalCommandIndex(organizationId: string) {
  const [candidates, sponsors, briefs, tasks, alerts, pipelineItems] = await Promise.all([
    prisma.candidate.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        fullName: true,
        headline: true,
        currentStage: true,
      },
    }),
    prisma.sponsor.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        fullName: true,
        title: true,
        organization: true,
      },
    }),
    prisma.opportunityBrief.findMany({
      where: {
        candidate: {
          organizationId,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
        sponsor: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.operatorTask.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.operatorAlert.findMany({
      where: {
        candidate: {
          organizationId,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
        sponsor: {
          select: {
            fullName: true,
          },
        },
      },
    }),
  ]);

  return [
    {
      id: "shortcut:dashboard",
      kind: "Shortcut",
      label: "Dashboard",
      description: "Open the operator overview, review queues, and readiness snapshots.",
      meta: "navigation",
      href: "/dashboard",
    },
    {
      id: "shortcut:demo",
      kind: "Shortcut",
      label: "Guided demo",
      description: "Open the recommended buyer walkthrough, talk track, and proof sequence for the current pilot posture.",
      meta: "navigation",
      href: "/demo",
    },
    {
      id: "shortcut:onboarding",
      kind: "Shortcut",
      label: "Pilot launch",
      description: "Open the design-partner onboarding guide, calibration plan, and buyer-ready launch checklist.",
      meta: "navigation",
      href: "/onboarding",
    },
    {
      id: "shortcut:commercial",
      kind: "Shortcut",
      label: "Commercial proof",
      description: "Open the buyer-readiness scorecard, objection handling, and commercial next-step view.",
      meta: "navigation",
      href: "/commercial",
    },
    {
      id: "shortcut:candidates",
      kind: "Shortcut",
      label: "Candidates",
      description: "Browse candidate underwriting files and search the current portfolio.",
      meta: "navigation",
      href: "/candidates",
    },
    {
      id: "shortcut:new-candidate",
      kind: "Shortcut",
      label: "New candidate",
      description: "Create a fresh candidate underwriting file from the intake form.",
      meta: "quick action",
      href: "/candidates/new",
    },
    {
      id: "shortcut:sponsors",
      kind: "Shortcut",
      label: "Sponsors",
      description: "Review the sponsor directory, operating context, and portfolio history.",
      meta: "navigation",
      href: "/sponsors",
    },
    {
      id: "shortcut:briefs",
      kind: "Shortcut",
      label: "Briefs",
      description: "Open current opportunity briefs and sponsor-targeted ask packaging.",
      meta: "navigation",
      href: "/briefs",
    },
    {
      id: "shortcut:pipeline",
      kind: "Shortcut",
      label: "Pipeline",
      description: "Inspect live sponsor motion, blockers, duplicate risk, and outcomes.",
      meta: "navigation",
      href: "/pipeline",
    },
    {
      id: "shortcut:tasks",
      kind: "Shortcut",
      label: "Tasks",
      description: "Open the operator follow-through queue and assigned workflow tasks.",
      meta: "navigation",
      href: "/tasks",
    },
    {
      id: "shortcut:alerts",
      kind: "Shortcut",
      label: "Alerts",
      description: "Review open alerts, ownership queues, and due items needing attention.",
      meta: "navigation",
      href: "/alerts",
    },
    {
      id: "shortcut:analytics",
      kind: "Shortcut",
      label: "Analytics",
      description: "Inspect decision quality, sponsor activity, and workflow operating data.",
      meta: "navigation",
      href: "/analytics",
    },
    {
      id: "shortcut:calibration",
      kind: "Shortcut",
      label: "Calibration",
      description: "Run reviewer calibration, persist action state, and close the gap between analytics and operating follow-through.",
      meta: "navigation",
      href: "/calibration",
    },
    {
      id: "shortcut:audits",
      kind: "Shortcut",
      label: "Audits",
      description: "Review disagreement patterns, fairness exports, and audit summaries.",
      meta: "navigation",
      href: "/audits",
    },
    {
      id: "shortcut:settings",
      kind: "Shortcut",
      label: "Settings",
      description: "Configure automation policy, runtime health, alerts, and integrations.",
      meta: "navigation",
      href: "/settings",
    },
    {
      id: "shortcut:pilot-pack",
      kind: "Shortcut",
      label: "Pilot brief",
      description: "Open the printable buyer-facing pilot brief with rollout, governance, and ROI framing.",
      meta: "navigation",
      href: "/pilot/pack",
    },
    {
      id: "shortcut:pilot-report",
      kind: "Shortcut",
      label: "Proof report",
      description: "Open the measured pilot proof report that separates observed movement from modeled assumptions.",
      meta: "navigation",
      href: "/pilot/report",
    },
    ...candidates.map((candidate) => ({
      id: `candidate:${candidate.id}`,
      kind: "Candidate",
      label: candidate.fullName,
      description: candidate.headline,
      meta: candidate.currentStage.replaceAll("_", " ").toLowerCase(),
      href: `/candidates/${candidate.id}`,
    })),
    ...sponsors.map((sponsor) => ({
      id: `sponsor:${sponsor.id}`,
      kind: "Sponsor",
      label: sponsor.fullName,
      description: `${sponsor.title} · ${sponsor.organization}`,
      meta: "directory",
      href: `/sponsors/${sponsor.id}`,
    })),
    ...briefs.map((brief) => ({
      id: `brief:${brief.id}`,
      kind: "Brief",
      label: brief.title,
      description: `${brief.candidate.fullName} → ${brief.sponsor.fullName}`,
      meta: brief.status.replaceAll("_", " ").toLowerCase(),
      href: `/briefs/${brief.candidateId}?sponsor=${brief.sponsorId}`,
    })),
    ...tasks.map((task) => ({
      id: `task:${task.id}`,
      kind: "Task",
      label: task.title,
      description: task.candidate?.fullName ?? task.detail,
      meta: task.status.replaceAll("_", " ").toLowerCase(),
      href: "/tasks",
    })),
    ...alerts.map((alert) => ({
      id: `alert:${alert.id}`,
      kind: "Alert",
      label: alert.title,
      description: alert.candidate.fullName,
      meta: alert.status.replaceAll("_", " ").toLowerCase(),
      href: "/alerts",
    })),
    ...pipelineItems.map((item) => ({
      id: `pipeline:${item.id}`,
      kind: "Pipeline",
      label: `${item.candidate.fullName} × ${item.sponsor.fullName}`,
      description: item.nextStep ?? item.rationale,
      meta: item.stage.replaceAll("_", " ").toLowerCase(),
      href: "/pipeline",
    })),
  ];
}

export async function getSavedViews(page: SavedViewPage) {
  const session = await requirePageSession();

  return prisma.savedView.findMany({
    where: {
      organizationId: session.organizationId,
      page,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

function filterCandidates<T extends CandidateFilterShape>(
  candidates: T[],
  edges: RelationshipEdge[],
  blindReviewMode: boolean,
  filters: {
    query?: string;
    readiness?: string;
    memoStatus?: string;
    stage?: string;
    automation?: string;
    opportunityFit?: string;
    reviewState?: string;
  },
) {
  return candidates
    .map((candidate) => {
      const currentArtifacts = getCurrentArtifacts(candidate.artifacts);
      const currentClaims = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts);
      const readiness = computeSponsorReadiness(
        candidate,
        currentArtifacts,
        currentClaims,
        edges.filter((edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id),
      );
      const claimReview = summarizeReviewStatuses(currentClaims.map((claim) => claim.reviewStatus));
      const recommendationReview = summarizeReviewStatuses(
        candidate.recommendations.map((recommendation) => recommendation.reviewStatus),
      );
      const reviewSummary = combineReviewSummaries([claimReview, recommendationReview]);

      return {
        ...candidate,
        ...(blindReviewMode
          ? anonymizeCandidateIdentity(candidate)
          : {
              displayName: candidate.fullName,
              displayHeadline: candidate.headline,
              displayRegion: candidate.region,
            }),
        readiness,
        trajectory: buildCandidateTrajectory(candidate.progressSnapshots),
        claimReview,
        recommendationReview,
        reviewSummary,
      };
    })
    .filter((candidate) => {
      const query = filters.query?.toLowerCase().trim();
      const haystack = `${candidate.fullName} ${candidate.headline} ${candidate.bio}`.toLowerCase();

      if (query && !haystack.includes(query)) {
        return false;
      }

      if (filters.readiness === "high" && candidate.readiness.score < 70) {
        return false;
      }

      if (filters.readiness === "medium" && (candidate.readiness.score < 45 || candidate.readiness.score >= 70)) {
        return false;
      }

      if (filters.readiness === "low" && candidate.readiness.score >= 45) {
        return false;
      }

      if (filters.memoStatus && filters.memoStatus !== "all") {
        const status = candidate.sponsorMemo?.status ?? MemoStatus.NOT_STARTED;
        if (status !== filters.memoStatus) {
          return false;
        }
      }

      if (filters.stage && filters.stage !== "all" && candidate.currentStage !== filters.stage) {
        return false;
      }

      if (filters.automation && filters.automation !== "all" && candidate.automationMode !== filters.automation) {
        return false;
      }

      if (filters.opportunityFit) {
        const claimText = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts)
          .map((claim) => claim.claim)
          .join(" ")
          .toLowerCase();
        if (!claimText.includes(filters.opportunityFit.toLowerCase())) {
          return false;
        }
      }

      if (filters.reviewState && filters.reviewState !== "all" && candidate.reviewSummary.status !== filters.reviewState) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.readiness.score - left.readiness.score);
}

type CandidateSponsorMatchShape = Candidate & {
  artifacts: Artifact[];
  evidenceClaims: EvidenceClaim[];
};

function sortLiveSponsorMatches<T extends { result: ReturnType<typeof computeSponsorMatch> }>(matches: T[]) {
  return matches.sort((left, right) => {
    if (right.result.score !== left.result.score) {
      return right.result.score - left.result.score;
    }

    if (right.result.operationalDelta !== left.result.operationalDelta) {
      return right.result.operationalDelta - left.result.operationalDelta;
    }

    return right.result.baseFitScore - left.result.baseFitScore;
  });
}

function buildTopLiveSponsor(
  candidate: CandidateSponsorMatchShape,
  sponsors: Sponsor[],
  edges: RelationshipEdge[],
  sponsorOperatingContext: Map<string, Parameters<typeof computeSponsorMatch>[5]>,
) {
  const currentArtifacts = getCurrentArtifacts(candidate.artifacts);
  const currentClaims = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts);
  return sortLiveSponsorMatches(
    sponsors.map((sponsor) => ({
      sponsor,
      result: computeSponsorMatch(
        candidate,
        sponsor,
        currentArtifacts,
        currentClaims,
        edges,
        sponsorOperatingContext.get(sponsor.id),
      ),
      connectionPath: buildWarmPath(candidate, sponsor, edges),
      warmPathInsight: buildWarmPathInsight(candidate, sponsor, edges),
    })),
  )[0] ?? null;
}

function buildAdvocacyPriorityScore(readinessScore: number, topSponsorScore?: number | null) {
  return Math.round(readinessScore * 0.6 + (topSponsorScore ?? 0) * 0.4);
}

async function buildAuditDataForWorkspace(session: AuditWorkspaceSession) {
  const [candidates, edges, safetySettings, members] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        artifacts: true,
        evidenceClaims: true,
        recommendations: true,
        candidateNotes: {
          select: {
            title: true,
            content: true,
          },
          orderBy: { createdAt: "desc" },
          take: 6,
        },
        candidateUpdates: {
          select: {
            title: true,
            summary: true,
          },
          orderBy: { submittedAt: "desc" },
          take: 6,
        },
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
        disagreementReviews: {
          include: {
            assignedUser: true,
            reviewedBy: true,
            operatorTask: true,
          },
          orderBy: { createdAt: "desc" },
          take: 6,
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
      orderBy: { updatedAt: "desc" },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    getSafetySettings(),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const rows = candidates.map((candidate) => {
    const currentArtifacts = getCurrentArtifacts(candidate.artifacts);
    const currentClaims = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts);
    const readiness = computeSponsorReadiness(
      candidate,
      currentArtifacts,
      currentClaims,
      edges.filter((edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id),
    );
    const claimReview = summarizeReviewStatuses(currentClaims.map((claim) => claim.reviewStatus));
    const recommendationReview = summarizeReviewStatuses(
      candidate.recommendations.map((recommendation) => recommendation.reviewStatus),
    );
    const reviewSummary = combineReviewSummaries([claimReview, recommendationReview]);
    const candidateDisplay = safetySettings.blindReviewMode
      ? anonymizeCandidateIdentity(candidate)
      : {
          displayName: candidate.fullName,
          displayHeadline: candidate.headline,
          displayRegion: candidate.region,
        };

    return createDecisionAuditRow({
      candidate,
      displayName: candidateDisplay.displayName,
      displayHeadline: candidateDisplay.displayHeadline,
      displayRegion: candidateDisplay.displayRegion,
      artifacts: currentArtifacts,
      claims: currentClaims,
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
    });
  });
  const reviewsByCandidateId = new Map(
    candidates.map((candidate) => [
      candidate.id,
      (() => {
        const review =
          candidate.disagreementReviews.find((review) =>
            review.status === DisagreementReviewStatus.OPEN ||
            review.status === DisagreementReviewStatus.IN_PROGRESS ||
            review.status === DisagreementReviewStatus.ESCALATED,
          ) ?? candidate.disagreementReviews[0] ?? null;

        if (!review) {
          return null;
        }

        return {
          ...review,
          dueAt: review.dueAt ? review.dueAt.toISOString() : null,
          dueAtLabel: review.dueAt ? formatDate(review.dueAt) : null,
          resolvedAtLabel: review.resolvedAt ? formatDate(review.resolvedAt) : null,
        };
      })(),
    ]),
  );
  const report = buildDecisionAuditReport(rows);

  return {
    workspace: {
      name: session.organization.name,
    },
    safetySettings,
    summary: report.summary,
    candidateRows: report.rows.map((row) => ({
      ...row,
      humanDecisionAtLabel: row.humanDecisionAt ? formatDate(row.humanDecisionAt) : null,
      disagreementReview: reviewsByCandidateId.get(row.candidateId) ?? null,
    })),
    patternBreakdowns: report.patternBreakdowns,
    caveats: report.caveats,
    teamMembers: members.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
    })),
  };
}

export async function getDashboardData() {
  const session = await requirePageSession();
  const [
    candidates,
    artifactsCount,
    memos,
    recommendationsCount,
    sponsors,
    edges,
    workspaceActivities,
    workspacePipelineItems,
    workspaceSponsorOutcomes,
    briefs,
    crmSyncCount,
    recentCrmSyncs,
    sponsorActivityCount,
    recentSponsorActivities,
    openAlertCount,
    recentAlerts,
    openProofRequestCount,
    recentProofRequests,
    openTaskCount,
    recentTasks,
    activePipelineCount,
    recentPipeline,
    recentBackgroundJobs,
    safetySettings,
  ] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        artifacts: true,
        evidenceClaims: true,
        operatorAlerts: {
          where: {
            status: AlertStatus.OPEN,
          },
          orderBy: { createdAt: "desc" },
          include: {
            operatorTask: true,
          },
        },
        sponsorMemo: {
          select: {
            status: true,
          },
        },
        recommendations: {
          select: {
            id: true,
            reviewStatus: true,
            recommendationType: true,
            sponsorId: true,
            score: true,
            updatedAt: true,
          },
        },
        opportunityBriefs: {
          select: {
            id: true,
            status: true,
          },
        },
        candidateUpdates: {
          select: {
            updatedAt: true,
          },
        },
        proofRequests: {
          select: {
            updatedAt: true,
            status: true,
          },
        },
        candidateNotes: {
          select: {
            id: true,
          },
        },
        candidateDecisions: {
          select: {
            id: true,
          },
        },
        progressSnapshots: {
          orderBy: { capturedAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.artifact.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
    }),
    prisma.sponsorMemo.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        candidate: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.recommendation.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
    }),
    prisma.sponsor.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        candidateId: true,
        activityType: true,
        status: true,
        detail: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        candidateId: true,
        stage: true,
        outcomeNote: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sponsorOutcome.findMany({
      where: {
        organizationId: session.organizationId,
      },
      select: {
        sponsorId: true,
        candidateId: true,
        verdict: true,
        detail: true,
        occurredAt: true,
        recordedAt: true,
        updatedAt: true,
      },
    }),
    prisma.opportunityBrief.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        candidate: true,
        sponsor: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.crmSyncRecord.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: {
          in: [CrmSyncStatus.SYNCED, CrmSyncStatus.FALLBACK],
        },
      },
    }),
    prisma.crmSyncRecord.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        candidate: true,
        sponsor: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.sponsorActivity.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        candidate: true,
        sponsor: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.operatorAlert.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: AlertStatus.OPEN,
      },
    }),
    prisma.operatorAlert.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: AlertStatus.OPEN,
      },
      include: {
        candidate: true,
        operatorTask: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.proofRequest.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: {
          in: [ProofRequestStatus.OPEN, ProofRequestStatus.IN_PROGRESS],
        },
      },
    }),
    prisma.proofRequest.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: {
          in: [ProofRequestStatus.OPEN, ProofRequestStatus.IN_PROGRESS],
        },
      },
      include: {
        candidate: true,
        assignedUser: true,
        operatorTask: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    }),
    prisma.operatorTask.count({
      where: {
        organizationId: session.organizationId,
        status: {
          in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        },
      },
    }),
    prisma.operatorTask.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        candidate: true,
        sponsor: true,
        owner: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
    }),
    prisma.sponsorPipelineItem.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        stage: {
          in: [
            "RECOMMENDED",
            "UNDER_REVIEW",
            "BRIEF_READY",
            "OUTREACH_DRAFTED",
            "CONTACTED",
            "INTRO_REQUESTED",
            "INTRO_CONFIRMED",
            "MEETING_SCHEDULED",
            "ADVOCATING",
          ],
        },
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        candidate: {
          include: {
            artifacts: true,
            evidenceClaims: true,
            candidateUpdates: {
              select: {
                updatedAt: true,
              },
            },
            proofRequests: {
              select: {
                updatedAt: true,
                status: true,
              },
            },
          },
        },
        sponsor: true,
        owner: true,
        recommendation: true,
      },
    }),
    prisma.backgroundJob.findMany({
      where: {
        organizationId: session.organizationId,
        status: {
          in: [
            BackgroundJobStatus.PENDING,
            BackgroundJobStatus.RUNNING,
            BackgroundJobStatus.RETRYABLE,
            BackgroundJobStatus.FAILED,
          ],
        },
      },
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    getSafetySettings(),
  ]);

  const sponsorOperatingContext = groupSponsorOperatingContext(
    workspaceActivities,
    workspacePipelineItems,
    workspaceSponsorOutcomes,
  );
  const enriched = candidates.map((candidate) => {
    const currentArtifacts = getCurrentArtifacts(candidate.artifacts);
    const currentClaims = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts);
    const readiness = computeSponsorReadiness(
      candidate,
      currentArtifacts,
      currentClaims,
      edges.filter((edge) => edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id),
    );
    const topSponsorNow = buildTopLiveSponsor(candidate, sponsors, edges, sponsorOperatingContext);
    const topSponsorRecommendation =
      topSponsorNow
        ? candidate.recommendations.find(
            (recommendation) =>
              recommendation.recommendationType === RecommendationType.BEST_SPONSOR &&
              recommendation.sponsorId === topSponsorNow.sponsor.id,
          ) ?? null
        : null;
    const topSponsorRecommendationFreshness =
      topSponsorNow && topSponsorRecommendation
        ? buildRecommendationFreshnessReport({
            recommendation: topSponsorRecommendation,
            currentScore: topSponsorNow.result.score,
            currentRightNowLabel: topSponsorNow.result.rightNowLabel,
            candidate,
            sponsor: topSponsorNow.sponsor,
            artifacts: currentArtifacts,
            claims: currentClaims,
            candidateUpdates: candidate.candidateUpdates,
            proofRequests: candidate.proofRequests,
            sponsorActivities: sponsorOperatingContext.get(topSponsorNow.sponsor.id)?.sponsorActivities,
            sponsorPipelineItems: sponsorOperatingContext.get(topSponsorNow.sponsor.id)?.sponsorPipelineItems,
            sponsorOutcomes: sponsorOperatingContext.get(topSponsorNow.sponsor.id)?.sponsorOutcomes,
          })
        : null;

    return ({
    ...candidate,
    ...(safetySettings.blindReviewMode
      ? anonymizeCandidateIdentity(candidate)
      : {
          displayName: candidate.fullName,
          displayHeadline: candidate.headline,
          displayRegion: candidate.region,
        }),
    readiness,
    topSponsorNow,
    topSponsorRecommendationFreshness,
    advocacyPriorityScore: buildAdvocacyPriorityScore(readiness.score, topSponsorNow?.result.score ?? null),
    trajectory: buildCandidateTrajectory(candidate.progressSnapshots),
    claimReview: summarizeReviewStatuses(currentClaims.map((claim) => claim.reviewStatus)),
    recommendationReview: summarizeReviewStatuses(
      candidate.recommendations.map((recommendation) => recommendation.reviewStatus),
    ),
  })});

  const enrichedWithReview = enriched.map((candidate) => ({
    ...candidate,
    reviewSummary: combineReviewSummaries([candidate.claimReview, candidate.recommendationReview]),
  }));

  const sponsorReadyQueue = enrichedWithReview
    .filter((candidate) => candidate.readiness.score >= 70)
    .sort((left, right) => right.advocacyPriorityScore - left.advocacyPriorityScore)
    .slice(0, 5);
  const reviewQueue = enrichedWithReview.filter(
    (candidate) =>
      candidate.readiness.status === "needs_review" || candidate.reviewSummary.status === "flagged",
  );
  const operatorReviewQueue = enrichedWithReview
    .filter((candidate) => candidate.reviewSummary.status === "pending" || candidate.reviewSummary.status === "flagged")
    .slice(0, 5);
  const memoReadyCount = enrichedWithReview.filter((candidate) => candidate.sponsorMemo?.status === MemoStatus.READY).length;
  const recommendationReadyCount = enrichedWithReview.filter((candidate) => candidate.recommendations.length > 0).length;
  const staleRecommendationCount = enrichedWithReview.filter(
    (candidate) => candidate.topSponsorRecommendationFreshness?.severity === "stale",
  ).length;
  const briefReadyCount = enrichedWithReview.filter((candidate) =>
    candidate.opportunityBriefs.some((brief) => brief.status === BriefStatus.READY),
  ).length;
  const upwardMoverCount = enrichedWithReview.filter((candidate) => candidate.trajectory.deltaFromPrevious >= 5).length;
  const averageReadinessMovement = Math.round(
    enrichedWithReview.reduce((sum, candidate) => sum + candidate.trajectory.deltaFromPrevious, 0) /
      Math.max(enrichedWithReview.length, 1),
  );
  const approvedCandidates = enrichedWithReview.filter((candidate) => candidate.reviewSummary.status === "approved").length;
  const pendingReviewItems = enrichedWithReview.reduce((sum, candidate) => sum + candidate.reviewSummary.pending, 0);
  const flaggedReviewItems = enrichedWithReview.reduce((sum, candidate) => sum + candidate.reviewSummary.flagged, 0);
  const momentumQueue = enrichedWithReview
    .filter((candidate) => candidate.trajectory.hasSnapshots)
    .sort((left, right) => right.trajectory.deltaFromPrevious - left.trajectory.deltaFromPrevious)
    .slice(0, 5);
  const stallRiskQueue = enrichedWithReview
    .filter(
      (candidate) =>
        candidate.trajectory.hasSnapshots &&
        (candidate.trajectory.momentum === "needs_attention" ||
          (candidate.trajectory.deltaFromPrevious <= 1 && candidate.readiness.score < 70)),
    )
    .sort((left, right) => left.trajectory.deltaFromPrevious - right.trajectory.deltaFromPrevious)
    .slice(0, 5);
  const livePipeline = recentPipeline
    .map((item) => {
      const currentArtifacts = getCurrentArtifacts(item.candidate.artifacts);
      const currentClaims = filterClaimsForArtifacts(item.candidate.evidenceClaims, item.candidate.artifacts);
      const currentMatch = computeSponsorMatch(
        item.candidate,
        item.sponsor,
        currentArtifacts,
        currentClaims,
        edges,
        sponsorOperatingContext.get(item.sponsorId),
      );
      const recommendationFreshness = item.recommendation
        ? buildRecommendationFreshnessReport({
            recommendation: item.recommendation,
            currentScore: currentMatch.score,
            currentRightNowLabel: currentMatch.rightNowLabel,
            candidate: item.candidate,
            sponsor: item.sponsor,
            artifacts: currentArtifacts,
            claims: currentClaims,
            candidateUpdates: item.candidate.candidateUpdates,
            proofRequests: item.candidate.proofRequests,
            sponsorActivities: sponsorOperatingContext.get(item.sponsorId)?.sponsorActivities,
            sponsorPipelineItems: sponsorOperatingContext.get(item.sponsorId)?.sponsorPipelineItems,
            sponsorOutcomes: sponsorOperatingContext.get(item.sponsorId)?.sponsorOutcomes,
          })
        : null;

      return {
        ...item,
        currentMatch,
        recommendationFreshness,
      };
    })
    .sort((left, right) => right.currentMatch.score - left.currentMatch.score)
    .slice(0, 6);

  const proofRequestRows = recentProofRequests.map((request) => {
    const sla = buildProofRequestSlaState({
      requestType: request.requestType,
      status: request.status,
      dueAt: request.dueAt,
      createdAt: request.createdAt,
    });

    return {
      ...request,
      displayCandidateName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(request.candidate).displayName
        : request.candidate.fullName,
      createdAtLabel: formatDate(request.createdAt),
      updatedAtLabel: formatDate(request.updatedAt),
      dueAtLabel: request.dueAt ? formatDate(request.dueAt) : null,
      lastReminderAtLabel: request.lastReminderAt ? formatDate(request.lastReminderAt) : null,
      sla: {
        ...sla,
        effectiveDueAtLabel: formatDate(sla.effectiveDueAt),
      },
    };
  });
  const overdueProofRequestCount = proofRequestRows.filter((request) => request.sla.overdue).length;
  const dueSoonProofRequestCount = proofRequestRows.filter((request) => request.sla.dueSoon).length;

  return {
    kpis: [
      { label: "Candidates", value: candidates.length, detail: "Active demo records" },
      { label: "Evidence artifacts", value: artifactsCount, detail: "Uploaded proof objects" },
      { label: "Sponsor memos", value: memoReadyCount, detail: "Ready for review" },
      { label: "Recommendations", value: recommendationsCount, detail: "Traceable outputs" },
      { label: "Opportunity briefs", value: briefReadyCount, detail: "Action-ready asks" },
      { label: "CRM syncs", value: crmSyncCount, detail: "Recorded handoffs" },
      { label: "Sponsor activity", value: sponsorActivityCount, detail: "Tracked sponsor events" },
      { label: "Open alerts", value: openAlertCount, detail: "Operator actions waiting" },
      { label: "Open proof requests", value: openProofRequestCount, detail: "Evidence gaps to close" },
      { label: "Overdue proof", value: overdueProofRequestCount, detail: "Past the proof-request SLA" },
      { label: "Due soon", value: dueSoonProofRequestCount, detail: "Proof requests due within 48 hours" },
      { label: "Open tasks", value: openTaskCount, detail: "Assigned workflow items" },
      { label: "Active pipeline", value: activePipelineCount, detail: "Sponsor paths in motion" },
      { label: "Upward movers", value: upwardMoverCount, detail: "Candidates gaining conviction" },
      { label: "Avg movement", value: averageReadinessMovement >= 0 ? `+${averageReadinessMovement}` : `${averageReadinessMovement}`, detail: "Latest readiness delta" },
    ],
    candidates: enrichedWithReview,
    sponsorReadyQueue,
    momentumQueue,
    stallRiskQueue,
    reviewQueue,
    operatorReviewQueue,
    recommendationStatus: {
      ready: recommendationReadyCount,
      pending: candidates.length - recommendationReadyCount,
      needsReview: reviewQueue.length,
      stale: staleRecommendationCount,
    },
    operatorReviewStatus: {
      approvedCandidates,
      pendingItems: pendingReviewItems,
      flaggedItems: flaggedReviewItems,
    },
    alerts: recentAlerts.map((alert) => ({
      ...alert,
      displayCandidateName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(alert.candidate).displayName
        : alert.candidate.fullName,
      createdAtLabel: formatDate(alert.createdAt),
      updatedAtLabel: formatDate(alert.updatedAt),
    })),
    proofRequests: proofRequestRows,
    safetySettings,
    tasks: recentTasks.map((task) => ({
      ...task,
      displayCandidateName: task.candidate
        ? safetySettings.blindReviewMode
          ? anonymizeCandidateIdentity(task.candidate).displayName
          : task.candidate.fullName
        : null,
      createdAtLabel: formatDate(task.createdAt),
      updatedAtLabel: formatDate(task.updatedAt),
      dueAtLabel: task.dueAt ? formatDate(task.dueAt) : null,
    })),
    backgroundJobs: recentBackgroundJobs.map((job) => ({
      ...job,
      candidateDisplayName: job.candidate?.fullName
        ? safetySettings.blindReviewMode
          ? anonymizeCandidateIdentity({
              fullName: job.candidate.fullName,
              headline: "",
              region: "",
            } as Candidate).displayName
          : job.candidate.fullName
        : null,
      createdAtLabel: formatDate(job.createdAt),
      updatedAtLabel: formatDate(job.updatedAt),
    })),
    pipeline: livePipeline.map((item) => ({
      ...item,
      displayCandidateName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(item.candidate).displayName
        : item.candidate.fullName,
      createdAtLabel: formatDate(item.createdAt),
      updatedAtLabel: formatDate(item.updatedAt),
      nextDueAtLabel: item.nextDueAt ? formatDate(item.nextDueAt) : null,
    })),
    memos: memos.map((memo) => ({
      ...memo,
      candidateDisplayName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(memo.candidate).displayName
        : memo.candidate.fullName,
    })),
    briefs: briefs.map((brief) => ({
      ...brief,
      candidateDisplayName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(brief.candidate).displayName
        : brief.candidate.fullName,
    })),
    crmSyncs: recentCrmSyncs.map((sync) => ({
      ...sync,
      candidateDisplayName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(sync.candidate).displayName
        : sync.candidate.fullName,
    })),
    sponsorActivities: recentSponsorActivities.map((activity) => ({
      ...activity,
      candidateDisplayName: safetySettings.blindReviewMode
        ? anonymizeCandidateIdentity(activity.candidate).displayName
        : activity.candidate.fullName,
    })),
  };
}

export async function getCandidatesList(filters: {
  query?: string;
  readiness?: string;
  memoStatus?: string;
  stage?: string;
  automation?: string;
  opportunityFit?: string;
  reviewState?: string;
}) {
  const session = await requirePageSession();
  const [candidates, edges, safetySettings] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        artifacts: true,
        evidenceClaims: true,
        operatorAlerts: {
          where: {
            status: AlertStatus.OPEN,
          },
          orderBy: { createdAt: "desc" },
        },
        sponsorMemo: {
          select: {
            status: true,
          },
        },
        recommendations: {
          select: {
            id: true,
            reviewStatus: true,
          },
        },
        opportunityBriefs: {
          select: {
            id: true,
            status: true,
          },
        },
        progressSnapshots: {
          orderBy: { capturedAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    getSafetySettings(),
  ]);

  return filterCandidates(candidates, edges, safetySettings.blindReviewMode, filters);
}

export async function getCandidateDetail(candidateId: string) {
  const session = await requirePageSession();
  const [
    candidate,
    sponsors,
    edges,
    recommendations,
    teamMembers,
    safetySettings,
    auditWorkspace,
    workspaceActivities,
    workspacePipelineItems,
    workspaceSponsorOutcomes,
  ] = await Promise.all([
    prisma.candidate.findFirst({
      where: { id: candidateId, organizationId: session.organizationId },
      include: {
        artifacts: {
          include: {
            storedFile: true,
            supersedesArtifact: {
              select: {
                id: true,
                title: true,
                versionNumber: true,
              },
            },
            replacementArtifacts: {
              select: {
                id: true,
                title: true,
                versionNumber: true,
                createdAt: true,
              },
              orderBy: { versionNumber: "desc" },
            },
          },
          orderBy: [{ isCurrentVersion: "desc" }, { updatedAt: "desc" }],
        },
        evidenceClaims: true,
        operatorAlerts: {
          where: {
            status: AlertStatus.OPEN,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            operatorTask: true,
          },
        },
        sponsorMemo: true,
        stageEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        candidateNotes: {
          include: {
            author: true,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        candidateDecisions: {
          include: {
            decidedBy: true,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        disagreementReviews: {
          include: {
            assignedUser: true,
            reviewedBy: true,
            operatorTask: true,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        proofRequests: {
          include: {
            requestedBy: true,
            assignedUser: true,
            resolvedBy: true,
            operatorTask: true,
            candidateUpdateAccessLink: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        candidateUpdates: {
          include: {
            sourceProofRequest: true,
            submittedBy: true,
            incorporatedBy: true,
            artifact: {
              include: {
                storedFile: true,
                supersedesArtifact: {
                  select: {
                    id: true,
                    title: true,
                    versionNumber: true,
                  },
                },
              },
            },
          },
          orderBy: { submittedAt: "desc" },
          take: 10,
        },
        committeeReviews: {
          include: {
            createdBy: true,
            chairUser: true,
            votes: {
              include: {
                user: true,
              },
              orderBy: { updatedAt: "desc" },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
        },
        outboundEmails: {
          include: {
            requestedBy: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
        },
        operatorTasks: {
          include: {
            owner: true,
            sponsor: true,
            sourceAlert: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 12,
        },
        sponsorPipelineItems: {
          include: {
            sponsor: true,
            owner: true,
            recommendation: true,
            opportunityBrief: true,
            sponsorOutcomes: {
              orderBy: { occurredAt: "desc" },
              take: 3,
              include: {
                recordedBy: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 12,
        },
        sponsorActivities: {
          include: {
            sponsor: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        },
        backgroundJobs: {
          where: {
            status: {
              in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.RUNNING, BackgroundJobStatus.RETRYABLE, BackgroundJobStatus.FAILED],
            },
          },
          include: {
            requestedBy: true,
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 8,
        },
        progressSnapshots: {
          orderBy: { capturedAt: "asc" },
        },
        opportunityBriefs: {
          include: {
            sponsor: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.sponsor.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.recommendation.findMany({
      where: {
        candidateId,
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        sponsor: true,
      },
      orderBy: [{ recommendationType: "asc" }, { score: "desc" }],
    }),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
    getSafetySettings(),
    buildAuditDataForWorkspace({
      organizationId: session.organizationId,
      organization: {
        name: session.organization.name,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        candidateId: true,
        activityType: true,
        status: true,
        detail: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        candidateId: true,
        stage: true,
        outcomeNote: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sponsorOutcome.findMany({
      where: {
        organizationId: session.organizationId,
      },
      select: {
        sponsorId: true,
        candidateId: true,
        verdict: true,
        detail: true,
        occurredAt: true,
        recordedAt: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!candidate) {
    return null;
  }

  const candidateEdges = edges.filter((edge) => edge.fromEntityId === candidateId || edge.toEntityId === candidateId);
  const currentArtifacts = getCurrentArtifacts(candidate.artifacts);
  const currentClaims = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts);
  const readiness = computeSponsorReadiness(candidate, currentArtifacts, currentClaims, candidateEdges);
  const claimReviewSummary = summarizeReviewStatuses(
    currentClaims.map((claim) => claim.reviewStatus),
  );
  const claimsByArtifact = candidate.artifacts.map((artifact) => ({
    artifact,
    claims: currentClaims.filter((claim) => claim.artifactId === artifact.id),
  }));
  const sponsorOperatingContext = groupSponsorOperatingContext(workspaceActivities, workspacePipelineItems, workspaceSponsorOutcomes);
  const sponsorMatches = sortLiveSponsorMatches(
    sponsors.map((sponsor) => ({
      sponsor,
      result: computeSponsorMatch(
        candidate,
        sponsor,
        currentArtifacts,
        currentClaims,
        edges,
        sponsorOperatingContext.get(sponsor.id),
      ),
      connectionPath: buildWarmPath(candidate, sponsor, edges),
      warmPathInsight: buildWarmPathInsight(candidate, sponsor, edges),
    })),
  ).slice(0, 6);
  const sponsorMatchById = new Map(sponsorMatches.map((match) => [match.sponsor.id, match]));
  const fallbackRecommendationMatch = sponsorMatches[0] ?? null;
  const recommendationsWithFreshness = recommendations.map((recommendation) => {
    const matchedSponsor = recommendation.sponsorId ? sponsorMatchById.get(recommendation.sponsorId) ?? null : null;
    const currentResult = matchedSponsor?.result ?? fallbackRecommendationMatch?.result ?? null;

    return {
      ...recommendation,
      freshness: buildRecommendationFreshnessReport({
        recommendation,
        currentScore: currentResult?.score ?? recommendation.score,
        currentRightNowLabel: currentResult?.rightNowLabel ?? null,
        candidate,
        sponsor: recommendation.sponsor,
        artifacts: currentArtifacts,
        claims: currentClaims,
        candidateUpdates: candidate.candidateUpdates,
        proofRequests: candidate.proofRequests,
        sponsorActivities: recommendation.sponsorId
          ? sponsorOperatingContext.get(recommendation.sponsorId)?.sponsorActivities
          : undefined,
        sponsorPipelineItems: recommendation.sponsorId
          ? sponsorOperatingContext.get(recommendation.sponsorId)?.sponsorPipelineItems
          : undefined,
        sponsorOutcomes: recommendation.sponsorId
          ? sponsorOperatingContext.get(recommendation.sponsorId)?.sponsorOutcomes
          : undefined,
      }),
    };
  });

  const memo = candidate.sponsorMemo
    ? {
        ...candidate.sponsorMemo,
        strengthsList: parseDelimitedList(candidate.sponsorMemo.strengths),
        risksList: parseDelimitedList(candidate.sponsorMemo.risks),
      }
    : null;

  const topRecommendations = {
    bestSponsors: recommendationsWithFreshness.filter((item) => item.recommendationType === RecommendationType.BEST_SPONSOR),
    warmPaths: recommendationsWithFreshness.filter((item) => item.recommendationType === RecommendationType.WARM_PATH),
    actions: recommendationsWithFreshness.filter((item) => item.recommendationType === RecommendationType.NEXT_ACTION),
    opportunityTypes: recommendationsWithFreshness.filter((item) => item.recommendationType === RecommendationType.OPPORTUNITY_TYPE),
  };
  const recommendationReviewSummary = summarizeReviewStatuses(
    recommendationsWithFreshness.map((recommendation) => recommendation.reviewStatus),
  );
  const overallReviewSummary = combineReviewSummaries([claimReviewSummary, recommendationReviewSummary]);
  const recommendationFreshnessSummary = summarizeRecommendationFreshness(
    recommendationsWithFreshness.map((recommendation) => recommendation.freshness),
  );
  const trajectory = buildCandidateTrajectory(candidate.progressSnapshots);
  const candidateDisplay = safetySettings.blindReviewMode
    ? anonymizeCandidateIdentity(candidate)
    : {
        displayName: candidate.fullName,
        displayHeadline: candidate.headline,
        displayRegion: candidate.region,
      };
  const safetyReport = buildCandidateSafetyReport({
    candidate,
    artifacts: currentArtifacts,
    claims: currentClaims,
    recommendations: recommendationsWithFreshness,
    readinessScore: readiness.score,
    memo: memo
      ? {
          executiveSummary: memo.summary,
        whyWorthBacking: memo.rationale,
        recommendedNextAction: memo.recommendedAction,
      }
      : null,
    candidateUpdates: candidate.candidateUpdates.map((update) => ({
      title: update.title,
      summary: update.summary,
    })),
    operatorNotes: candidate.candidateNotes.map((note) => ({
      title: note.title,
      content: note.content,
    })),
    additionalNarratives: [
      ...recommendationsWithFreshness.slice(0, 4).flatMap((recommendation) => [
        { label: `${recommendation.recommendationType} explanation`, text: recommendation.explanation },
        { label: `${recommendation.recommendationType} action`, text: recommendation.actionSuggestion },
      ]),
      ...candidate.opportunityBriefs.slice(0, 3).flatMap((brief) => [
        { label: `Brief summary · ${brief.title}`, text: brief.summary },
        { label: `Brief why now · ${brief.title}`, text: brief.whyNow },
        { label: `Brief ask · ${brief.title}`, text: brief.sponsorAsk },
      ]),
    ],
  });
  const proofRequestSuggestions = buildProofRequestSuggestions({
    missingProof: safetyReport.missingProof,
    potentialContradictions: safetyReport.potentialContradictions,
  });
  const decisionAudit = createDecisionAuditRow({
    candidate,
    displayName: candidateDisplay.displayName,
    displayHeadline: candidateDisplay.displayHeadline,
    displayRegion: candidateDisplay.displayRegion,
    artifacts: currentArtifacts,
    claims: currentClaims,
    recommendations,
    candidateDecisions: candidate.candidateDecisions,
    readinessScore: readiness.score,
    reviewState: overallReviewSummary.status,
    memoStatus: memo?.status ?? null,
    memo: memo
      ? {
          executiveSummary: memo.summary,
          whyWorthBacking: memo.rationale,
          recommendedNextAction: memo.recommendedAction,
        }
      : null,
    candidateUpdates: candidate.candidateUpdates.map((update) => ({
      title: update.title,
      summary: update.summary,
    })),
    operatorNotes: candidate.candidateNotes.map((note) => ({
      title: note.title,
      content: note.content,
    })),
    additionalNarratives: recommendationsWithFreshness.slice(0, 4).flatMap((recommendation) => [
      { label: `${recommendation.recommendationType} explanation`, text: recommendation.explanation },
      { label: `${recommendation.recommendationType} action`, text: recommendation.actionSuggestion },
    ]),
  });
  const workspaceOutcomes = deriveCandidateOutcomeRows({
    candidateIds: auditWorkspace.candidateRows.map((row) => row.candidateId),
    activities: workspaceActivities,
    pipelineItems: workspacePipelineItems,
    structuredOutcomes: workspaceSponsorOutcomes,
  });
  const outcomeLearningPatterns = buildOutcomeLearningPatterns({
    rows: auditWorkspace.candidateRows,
    outcomes: workspaceOutcomes,
  });
  const learningInsight = getCandidateLearningInsight({
    row: decisionAudit,
    patterns: outcomeLearningPatterns,
  });
  const activeDisagreementReview =
    candidate.disagreementReviews.find((review) =>
      review.status === DisagreementReviewStatus.OPEN ||
      review.status === DisagreementReviewStatus.IN_PROGRESS ||
      review.status === DisagreementReviewStatus.ESCALATED,
    ) ?? null;

  return {
    candidate,
    candidateDisplay,
    readiness,
    trajectory,
    memo,
    claimReviewSummary,
    recommendationReviewSummary,
    recommendationFreshnessSummary,
    overallReviewSummary,
    operatorAlerts: candidate.operatorAlerts.map((alert) => ({
      ...alert,
      createdAtLabel: formatDate(alert.createdAt),
      updatedAtLabel: formatDate(alert.updatedAt),
    })),
    stageEvents: candidate.stageEvents.map((event) => ({
      ...event,
      createdAtLabel: formatDate(event.createdAt),
    })),
    candidateNotes: candidate.candidateNotes.map((note) => ({
      ...note,
      createdAtLabel: formatDate(note.createdAt),
      updatedAtLabel: formatDate(note.updatedAt),
    })),
    candidateDecisions: candidate.candidateDecisions.map((decision) => ({
      ...decision,
      createdAtLabel: formatDate(decision.createdAt),
    })),
    disagreementReviews: candidate.disagreementReviews.map((review) => ({
      ...review,
      createdAtLabel: formatDate(review.createdAt),
      updatedAtLabel: formatDate(review.updatedAt),
      dueAtLabel: review.dueAt ? formatDate(review.dueAt) : null,
      resolvedAtLabel: review.resolvedAt ? formatDate(review.resolvedAt) : null,
    })),
    proofRequests: sortProofRequestsForWorkflow(candidate.proofRequests).map((request) => ({
      ...request,
      sla: {
        ...buildProofRequestSlaState({
          requestType: request.requestType,
          status: request.status,
          dueAt: request.dueAt,
          createdAt: request.createdAt,
        }),
      },
      dueAt: request.dueAt ? request.dueAt.toISOString().slice(0, 10) : null,
      createdAtLabel: formatDate(request.createdAt),
      updatedAtLabel: formatDate(request.updatedAt),
      dueAtLabel: request.dueAt ? formatDate(request.dueAt) : null,
      resolvedAtLabel: request.resolvedAt ? formatDate(request.resolvedAt) : null,
      lastReminderAtLabel: request.lastReminderAt ? formatDate(request.lastReminderAt) : null,
      effectiveDueAtLabel: formatDate(
        buildProofRequestSlaState({
          requestType: request.requestType,
          status: request.status,
          dueAt: request.dueAt,
          createdAt: request.createdAt,
        }).effectiveDueAt,
      ),
      candidateUpdateAccessLink: request.candidateUpdateAccessLink
        ? {
            ...request.candidateUpdateAccessLink,
            expiresAtLabel: formatDate(request.candidateUpdateAccessLink.expiresAt),
            lastUsedAtLabel: request.candidateUpdateAccessLink.lastUsedAt
              ? formatDate(request.candidateUpdateAccessLink.lastUsedAt)
              : null,
          }
        : null,
    })),
    candidateUpdates: candidate.candidateUpdates.map((update) => ({
      ...update,
      submittedAtLabel: formatDate(update.submittedAt),
      incorporatedAtLabel: update.incorporatedAt ? formatDate(update.incorporatedAt) : null,
      createdAtLabel: formatDate(update.createdAt),
      updatedAtLabel: formatDate(update.updatedAt),
    })),
    backgroundJobs: candidate.backgroundJobs.map((job) => ({
      ...job,
      createdAtLabel: formatDate(job.createdAt),
      updatedAtLabel: formatDate(job.updatedAt),
      availableAtLabel: formatDate(job.availableAt),
      startedAtLabel: job.startedAt ? formatDate(job.startedAt) : null,
      finishedAtLabel: job.finishedAt ? formatDate(job.finishedAt) : null,
    })),
    committeeReviews: candidate.committeeReviews.map((review) => ({
      ...review,
      createdAtLabel: formatDate(review.createdAt),
      updatedAtLabel: formatDate(review.updatedAt),
      dueAtLabel: review.dueAt ? formatDate(review.dueAt) : null,
      finalizedAtLabel: review.finalizedAt ? formatDate(review.finalizedAt) : null,
      statusLabel: COMMITTEE_REVIEW_STATUS_LABELS[review.status],
      finalDecisionLabel: review.finalDecision ? COMMITTEE_VOTE_LABELS[review.finalDecision] : null,
      consensusLabel: buildCommitteeConsensusLabel(review),
      voteSummary: summarizeCommitteeVotes(review.votes),
      votes: review.votes.map((vote) => ({
        ...vote,
        decisionLabel: COMMITTEE_VOTE_LABELS[vote.decision],
        createdAtLabel: formatDate(vote.createdAt),
        updatedAtLabel: formatDate(vote.updatedAt),
      })),
    })),
    outboundEmails: candidate.outboundEmails.map((email) => ({
      ...email,
      createdAtLabel: formatDate(email.createdAt),
      updatedAtLabel: formatDate(email.updatedAt),
      sentAtLabel: email.sentAt ? formatDate(email.sentAt) : null,
    })),
    activeDisagreementReview: activeDisagreementReview
      ? {
          ...activeDisagreementReview,
          dueAt: activeDisagreementReview.dueAt ? activeDisagreementReview.dueAt.toISOString() : null,
          createdAtLabel: formatDate(activeDisagreementReview.createdAt),
          updatedAtLabel: formatDate(activeDisagreementReview.updatedAt),
          dueAtLabel: activeDisagreementReview.dueAt ? formatDate(activeDisagreementReview.dueAt) : null,
          resolvedAtLabel: activeDisagreementReview.resolvedAt ? formatDate(activeDisagreementReview.resolvedAt) : null,
        }
      : null,
    operatorTasks: candidate.operatorTasks.map((task) => ({
      ...task,
      createdAtLabel: formatDate(task.createdAt),
      updatedAtLabel: formatDate(task.updatedAt),
      dueAtLabel: task.dueAt ? formatDate(task.dueAt) : null,
    })),
    sponsorPipelineItems: candidate.sponsorPipelineItems.map((item) => ({
      ...item,
      createdAtLabel: formatDate(item.createdAt),
      updatedAtLabel: formatDate(item.updatedAt),
      nextDueAtLabel: item.nextDueAt ? formatDate(item.nextDueAt) : null,
      sponsorOutcomes: item.sponsorOutcomes.map((outcome) => ({
        ...outcome,
        occurredAtLabel: formatDate(outcome.occurredAt),
        recordedAtLabel: formatDate(outcome.recordedAt),
      })),
    })),
    sponsorActivities: candidate.sponsorActivities.map((activity) => ({
      ...activity,
      createdAtLabel: formatDate(activity.createdAt),
      updatedAtLabel: formatDate(activity.updatedAt),
    })),
    safetyReport,
    learningInsight,
    proofRequestSuggestions,
    decisionAudit: {
      ...decisionAudit,
      humanDecisionAtLabel: decisionAudit.humanDecisionAt ? formatDate(decisionAudit.humanDecisionAt) : null,
    },
    safetySettings,
    claimsByArtifact,
    replaceableArtifacts: currentArtifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      artifactType: artifact.artifactType,
      sourceLabel: artifact.sourceLabel,
      versionNumber: artifact.versionNumber,
    })),
    sponsorMatches,
    opportunityBriefs: candidate.opportunityBriefs.map((brief) => ({
      ...brief,
      talkingPointsList: parseDelimitedList(brief.talkingPoints),
      proofToBringList: parseDelimitedList(brief.proofToBring),
      successIndicatorsList: parseDelimitedList(brief.successIndicators),
    })),
    recommendations: topRecommendations,
    flaggedReviewItems: [
      ...candidate.evidenceClaims
        .filter((claim) => claim.reviewStatus === "FLAGGED")
        .map((claim) => ({
          id: claim.id,
          kind: "Evidence claim",
          label: claim.claim,
          note: claim.reviewNote,
        })),
      ...recommendationsWithFreshness
        .filter((recommendation) => recommendation.reviewStatus === "FLAGGED")
        .map((recommendation) => ({
          id: recommendation.id,
          kind: recommendation.recommendationType.replaceAll("_", " "),
          label: recommendation.actionSuggestion,
          note: recommendation.reviewNote,
        })),
    ],
    reviewWorkbench: {
      claims: candidate.evidenceClaims
        .filter((claim) => claim.reviewStatus !== "APPROVED")
        .sort((left, right) => right.confidence - left.confidence)
        .map((claim) => ({
          id: claim.id,
          entityType: "claim" as const,
          title: claim.claim,
          detail: claim.supportingExcerpt,
          status: claim.reviewStatus,
          note: claim.reviewNote,
          meta: `${claim.category.replaceAll("_", " ")} · ${Math.round(claim.confidence * 100)}% confidence`,
        })),
      recommendations: recommendationsWithFreshness
        .filter((recommendation) => recommendation.reviewStatus !== "APPROVED")
        .sort((left, right) => right.score - left.score)
        .map((recommendation) => ({
          id: recommendation.id,
          entityType: "recommendation" as const,
          title: recommendation.actionSuggestion,
          detail: recommendation.explanation,
          status: recommendation.reviewStatus,
          note: recommendation.reviewNote,
          meta: `${recommendation.recommendationType.replaceAll("_", " ")} · ${Math.round(recommendation.score)} score · ${recommendation.freshness.label}`,
        })),
    },
    traceability: candidate.evidenceClaims
      .slice()
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 6)
      .map((claim) => ({
        ...claim,
        tagsList: parseDelimitedList(claim.tags),
        artifactTitle: candidate.artifacts.find((artifact) => artifact.id === claim.artifactId)?.title ?? "Unknown artifact",
      })),
    teamMembers: teamMembers.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
    })),
  };
}

export async function getSponsorsList(filters: {
  query?: string;
  domain?: string;
  seniority?: string;
  style?: string;
  geography?: string;
}) {
  const session = await requirePageSession();
  const sponsors = await prisma.sponsor.findMany({
    where: {
      organizationId: session.organizationId,
    },
    include: {
      sponsorActivities: {
        select: {
          activityType: true,
          status: true,
          detail: true,
        },
      },
      sponsorOutcomes: {
        select: {
          verdict: true,
        },
      },
      sponsorPipelineItems: {
        select: {
          stage: true,
          outcomeNote: true,
        },
      },
      recommendations: {
        include: {
          candidate: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return sponsors
    .filter((sponsor) => {
      const query = filters.query?.toLowerCase().trim();
      const haystack = `${sponsor.fullName} ${sponsor.organization} ${sponsor.title} ${sponsor.bio}`.toLowerCase();

      if (query && !haystack.includes(query)) {
        return false;
      }

      if (filters.domain && filters.domain !== "all" && !sponsor.domainExpertise.toLowerCase().includes(filters.domain.toLowerCase())) {
        return false;
      }

      if (filters.seniority && filters.seniority !== "all" && sponsor.seniorityLevel !== filters.seniority) {
        return false;
      }

      if (filters.style && filters.style !== "all" && sponsor.sponsorStyle !== filters.style) {
        return false;
      }

      if (filters.geography && filters.geography !== "all" && !sponsor.geography.toLowerCase().includes(filters.geography.toLowerCase())) {
        return false;
      }

      return true;
    })
    .map((sponsor) => ({
      ...sponsor,
      expertiseList: parseDelimitedList(sponsor.domainExpertise),
      interestList: parseDelimitedList(sponsor.interestTags),
      activeMatches: sponsor.recommendations.filter(
        (recommendation) => recommendation.recommendationType === RecommendationType.BEST_SPONSOR,
      ),
      operatingProfile: buildSponsorOperatingProfile({
        sponsorActivities: sponsor.sponsorActivities,
        sponsorPipelineItems: sponsor.sponsorPipelineItems,
        sponsorOutcomes: sponsor.sponsorOutcomes,
        availabilityStatus: sponsor.availabilityStatus,
        maxConcurrentPaths: sponsor.maxConcurrentPaths,
        blackoutUntil: sponsor.blackoutUntil,
        blackoutReason: sponsor.blackoutReason,
      }),
    }));
}

export async function getSponsorDetail(sponsorId: string) {
  const session = await requirePageSession();
  const sponsor = await prisma.sponsor.findFirst({
    where: { id: sponsorId, organizationId: session.organizationId },
    include: {
      crmSyncRecords: {
        orderBy: { updatedAt: "desc" },
      },
      outboundEmails: {
        include: {
          candidate: true,
          requestedBy: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      outboundApprovals: {
        include: {
          candidate: true,
          reviewedBy: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      opportunityBriefs: {
        include: {
          candidate: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      sponsorActivities: {
        include: {
          candidate: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      sponsorOutcomes: {
        include: {
          candidate: true,
          recordedBy: true,
        },
        orderBy: { occurredAt: "desc" },
      },
      sponsorPipelineItems: {
        include: {
          candidate: true,
          owner: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      recommendations: {
        include: {
          candidate: true,
        },
        orderBy: { score: "desc" },
      },
    },
  });

  if (!sponsor) {
    return null;
  }

  const portfolioCandidateIds = Array.from(
    new Set([
      ...sponsor.sponsorPipelineItems.map((item) => item.candidateId),
      ...sponsor.opportunityBriefs.map((brief) => brief.candidateId),
      ...sponsor.outboundEmails.map((email) => email.candidateId),
      ...sponsor.outboundApprovals.map((approval) => approval.candidateId),
      ...sponsor.sponsorOutcomes.map((outcome) => outcome.candidateId),
    ]),
  );

  const portfolioRows = portfolioCandidateIds
    .map((candidateId) => {
      const pipelineItem = sponsor.sponsorPipelineItems.find((item) => item.candidateId === candidateId) ?? null;
      const briefs = sponsor.opportunityBriefs.filter((brief) => brief.candidateId === candidateId);
      const emails = sponsor.outboundEmails.filter((email) => email.candidateId === candidateId);
      const approvals = sponsor.outboundApprovals.filter((approval) => approval.candidateId === candidateId);
      const outcomes = sponsor.sponsorOutcomes.filter((outcome) => outcome.candidateId === candidateId);
      const candidate =
        pipelineItem?.candidate ??
        briefs[0]?.candidate ??
        emails[0]?.candidate ??
        approvals[0]?.candidate ??
        outcomes[0]?.candidate ??
        sponsor.recommendations.find((recommendation) => recommendation.candidateId === candidateId)?.candidate ??
        null;

      if (!candidate) {
        return null;
      }

      const latestOutcome = outcomes[0] ?? null;
      const latestApproval = approvals[0] ?? null;
      const negativeMemory = Array.from(
        new Set(
          [
            pipelineItem?.stage === "PASSED" ? "already passed" : null,
            pipelineItem?.outcomeNote?.toLowerCase().includes("timing") ? "wrong timing" : null,
            pipelineItem?.outcomeNote?.toLowerCase().includes("not a fit") ? "not a fit" : null,
            ...outcomes.flatMap((outcome) => {
              const detail = outcome.detail.toLowerCase();
              const memory: string[] = [];

              if (outcome.verdict === "NEGATIVE" && outcome.outcomeType === "DECLINED") {
                memory.push("already declined");
              }

              if (outcome.outcomeType === "TIMING_MISMATCH" || detail.includes("timing")) {
                memory.push("wrong timing");
              }

              if (detail.includes("not a fit")) {
                memory.push("not a fit");
              }

              if (outcome.outcomeType === "NEEDS_MORE_PROOF") {
                memory.push("needs more proof");
              }

              return memory;
            }),
          ].filter((value): value is string => Boolean(value)),
        ),
      ).slice(0, 4);
      const duplicateAskSignals = [
        briefs.length > 1 ? `${briefs.length} brief variants` : null,
        emails.length > 1 ? `${emails.length} outbound sends` : null,
        pipelineItem &&
        pipelineItem.stage !== "PASSED" &&
        pipelineItem.stage !== "CLOSED" &&
        (briefs.length > 0 || emails.length > 0)
          ? `live ${pipelineItem.stage.replaceAll("_", " ").toLowerCase()} path`
          : null,
      ].filter((value): value is string => Boolean(value));
      const lastTouchedAt = new Date(
        Math.max(
          pipelineItem?.updatedAt.getTime() ?? 0,
          ...briefs.map((brief) => brief.updatedAt.getTime()),
          ...emails.map((email) => email.updatedAt.getTime()),
          ...approvals.map((approval) => approval.updatedAt.getTime()),
          ...outcomes.map((outcome) => outcome.updatedAt.getTime()),
        ),
      );

      return {
        candidateId,
        candidate,
        currentStage: pipelineItem?.stage ?? null,
        currentStageLabel: pipelineItem ? pipelineItem.stage.replaceAll("_", " ") : "No live path",
        briefCount: briefs.length,
        outboundEmailCount: emails.length,
        latestOutcome,
        latestApproval,
        duplicateAskRisk: duplicateAskSignals.length > 0,
        duplicateAskReason: duplicateAskSignals.join("; "),
        negativeMemory,
        blackoutActive: Boolean(sponsor.blackoutUntil && sponsor.blackoutUntil.getTime() > Date.now()),
        blackoutReason: sponsor.blackoutReason ?? null,
        blackoutUntilLabel: sponsor.blackoutUntil ? formatDate(sponsor.blackoutUntil) : null,
        lastTouchedAt,
        lastTouchedAtLabel: formatDate(lastTouchedAt),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => right.lastTouchedAt.getTime() - left.lastTouchedAt.getTime());

  return {
    ...sponsor,
    expertiseList: parseDelimitedList(sponsor.domainExpertise),
    interestList: parseDelimitedList(sponsor.interestTags),
    blackoutUntilLabel: sponsor.blackoutUntil ? formatDate(sponsor.blackoutUntil) : null,
    portfolioRows,
    opportunityBriefs: sponsor.opportunityBriefs.map((brief) => ({
      ...brief,
      createdAtLabel: formatDate(brief.createdAt),
      updatedAtLabel: formatDate(brief.updatedAt),
      talkingPointsList: parseDelimitedList(brief.talkingPoints),
      proofToBringList: parseDelimitedList(brief.proofToBring),
      successIndicatorsList: parseDelimitedList(brief.successIndicators),
    })),
    crmSyncRecords: sponsor.crmSyncRecords.map((sync) => ({
      ...sync,
      createdAtLabel: formatDate(sync.createdAt),
      updatedAtLabel: formatDate(sync.updatedAt),
    })),
    sponsorActivities: sponsor.sponsorActivities.map((activity) => ({
      ...activity,
      createdAtLabel: formatDate(activity.createdAt),
      updatedAtLabel: formatDate(activity.updatedAt),
    })),
    sponsorOutcomes: sponsor.sponsorOutcomes.map((outcome) => ({
      ...outcome,
      occurredAtLabel: formatDate(outcome.occurredAt),
      recordedAtLabel: formatDate(outcome.recordedAt),
    })),
    sponsorPipelineItems: sponsor.sponsorPipelineItems.map((item) => ({
      ...item,
      createdAtLabel: formatDate(item.createdAt),
      updatedAtLabel: formatDate(item.updatedAt),
      nextDueAtLabel: item.nextDueAt ? formatDate(item.nextDueAt) : null,
    })),
    outboundEmails: sponsor.outboundEmails.map((email) => ({
      ...email,
      createdAtLabel: formatDate(email.createdAt),
      updatedAtLabel: formatDate(email.updatedAt),
    })),
    outboundApprovals: sponsor.outboundApprovals.map((approval) => ({
      ...approval,
      createdAtLabel: formatDate(approval.createdAt),
      updatedAtLabel: formatDate(approval.updatedAt),
      reviewedAtLabel: approval.reviewedAt ? formatDate(approval.reviewedAt) : null,
    })),
    recommendations: sponsor.recommendations.map((recommendation) => ({
      ...recommendation,
      createdAtLabel: formatDate(recommendation.createdAt),
    })),
    operatingProfile: buildSponsorOperatingProfile({
      sponsorActivities: sponsor.sponsorActivities,
      sponsorPipelineItems: sponsor.sponsorPipelineItems,
      sponsorOutcomes: sponsor.sponsorOutcomes,
      availabilityStatus: sponsor.availabilityStatus,
      maxConcurrentPaths: sponsor.maxConcurrentPaths,
      blackoutUntil: sponsor.blackoutUntil,
      blackoutReason: sponsor.blackoutReason,
    }),
  };
}

export async function getOpportunityBriefsList(filters: {
  query?: string;
  status?: string;
  type?: string;
}) {
  const session = await requirePageSession();
  const briefs = await prisma.opportunityBrief.findMany({
    where: {
      candidate: {
        organizationId: session.organizationId,
      },
    },
    include: {
      candidate: true,
      sponsor: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return briefs
    .filter((brief) => {
      const query = filters.query?.toLowerCase().trim();
      const haystack = `${brief.title} ${brief.summary} ${brief.candidate.fullName} ${brief.sponsor.fullName}`.toLowerCase();

      if (query && !haystack.includes(query)) {
        return false;
      }

      if (filters.status && filters.status !== "all" && brief.status !== filters.status) {
        return false;
      }

      if (filters.type && filters.type !== "all" && brief.opportunityType !== filters.type) {
        return false;
      }

      return true;
    })
    .map((brief) => ({
      ...brief,
      talkingPointsList: parseDelimitedList(brief.talkingPoints),
      proofToBringList: parseDelimitedList(brief.proofToBring),
      successIndicatorsList: parseDelimitedList(brief.successIndicators),
      updatedAtLabel: formatDate(brief.updatedAt),
    }));
}

export async function getSettingsSnapshot() {
  const session = await requirePageSession(MembershipRole.ADMIN);
  const [
    settings,
    counts,
    recentDigestDeliveries,
    recentStoredFiles,
    recentBackgroundJobs,
    recoveryBackgroundJobs,
    recoveryCrmSyncs,
    crmSyncHealthRows,
    recentAuditLogs,
    teamMembers,
    automationPolicy,
    currentUserSessions,
    workspaceInvites,
  ] = await Promise.all([
    prisma.appSetting.findMany(),
    Promise.all([
      prisma.candidate.count({ where: { organizationId: session.organizationId } }),
      prisma.sponsor.count({ where: { organizationId: session.organizationId } }),
      prisma.artifact.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.evidenceClaim.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.recommendation.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.opportunityBrief.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.crmSyncRecord.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.sponsorActivity.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.candidateProgressSnapshot.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.operatorAlert.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.candidateStageEvent.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.outboundApproval.count({ where: { candidate: { organizationId: session.organizationId } } }),
      prisma.pilotMetricSnapshot.count({ where: { organizationId: session.organizationId } }),
      prisma.alertDigestDelivery.count(),
      prisma.storedFile.count({ where: { organizationId: session.organizationId } }),
      prisma.backgroundJob.count({ where: { organizationId: session.organizationId } }),
      prisma.backgroundJob.count({
        where: {
          organizationId: session.organizationId,
          status: {
            in: ["FAILED", "RETRYABLE"],
          },
        },
      }),
      prisma.crmSyncRecord.count({
        where: {
          candidate: { organizationId: session.organizationId },
          status: {
            in: [CrmSyncStatus.FAILED, CrmSyncStatus.FALLBACK],
          },
        },
      }),
    ]),
    prisma.alertDigestDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.storedFile.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.backgroundJob.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
        requestedBy: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.backgroundJob.findMany({
      where: {
        organizationId: session.organizationId,
        status: {
          in: ["FAILED", "RETRYABLE"],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
        requestedBy: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.crmSyncRecord.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: {
          in: [CrmSyncStatus.FAILED, CrmSyncStatus.FALLBACK],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        candidate: {
          select: {
            fullName: true,
          },
        },
        sponsor: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.crmSyncRecord.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        providerMode: true,
        objectType: true,
        status: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: session.organizationId,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        actor: {
          select: {
            name: true,
          },
        },
        candidate: {
          select: {
            fullName: true,
          },
        },
        sponsor: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
    getAutomationPolicy(),
    prisma.appSession.findMany({
      where: {
        organizationId: session.organizationId,
        userId: session.user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
    prisma.workspaceInvite.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        createdBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
  ]);

  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
  const pilotTemplateKey = settingMap.get("PILOT_TEMPLATE") ?? "FOUNDATION";
  const pilotTemplate = getPilotTemplate(pilotTemplateKey);
  const pilotProfile = parsePilotProfile(
    settingMap.get("PILOT_PROFILE"),
    buildDefaultPilotProfile({
      workspaceName: session.organization.name,
      template: pilotTemplate,
    }),
  );
  const pilotLaunchWorkstream = buildPilotLaunchWorkstream(
    pilotTemplate,
    settingMap.get("PILOT_LAUNCH_WORKSTREAM"),
  );
  const crmSyncHealth = Array.from(
    crmSyncHealthRows.reduce(
      (accumulator, row) => {
        const key = `${row.providerMode}:${row.objectType}`;
        const current = accumulator.get(key) ?? {
          providerMode: row.providerMode,
          objectType: row.objectType,
          total: 0,
          synced: 0,
          failed: 0,
          fallback: 0,
        };

        current.total += 1;

        if (row.status === CrmSyncStatus.SYNCED) {
          current.synced += 1;
        } else if (row.status === CrmSyncStatus.FAILED) {
          current.failed += 1;
        } else {
          current.fallback += 1;
        }

        accumulator.set(key, current);
        return accumulator;
      },
      new Map<
        string,
        {
          providerMode: string;
          objectType: string;
          total: number;
          synced: number;
          failed: number;
          fallback: number;
        }
      >(),
    ).values(),
  ).sort((left, right) => right.total - left.total);

  return {
    aiMode: settingMap.get("AI_MODE") ?? "mock",
    aiRuntimeMode: settingMap.get("AI_RUNTIME_MODE") ?? "mock",
    aiRuntimeNote: settingMap.get("AI_RUNTIME_NOTE") ?? "Using deterministic mock mode.",
    crmMode: settingMap.get("CRM_SYNC_MODE") ?? "mock",
    crmRuntimeMode: settingMap.get("CRM_RUNTIME_MODE") ?? "mock",
    crmRuntimeNote: settingMap.get("CRM_RUNTIME_NOTE") ?? "Using local mock CRM sync.",
    crmFieldMappings: {
      hubspot: formatCrmFieldMappingsForEditor("hubspot", settingMap.get("CRM_FIELD_MAPPING_HUBSPOT")),
      salesforce: formatCrmFieldMappingsForEditor("salesforce", settingMap.get("CRM_FIELD_MAPPING_SALESFORCE")),
      airtable: formatCrmFieldMappingsForEditor("airtable", settingMap.get("CRM_FIELD_MAPPING_AIRTABLE")),
    },
    emailSendMode: settingMap.get("EMAIL_SEND_MODE") ?? "mock",
    emailRuntimeMode: settingMap.get("EMAIL_RUNTIME_MODE") ?? "mock",
    emailRuntimeNote: settingMap.get("EMAIL_RUNTIME_NOTE") ?? "Using local mock email delivery.",
    backgroundJobsMode: settingMap.get("BACKGROUND_JOBS_MODE") ?? env.backgroundJobsMode,
    backgroundJobsRuntimeNote:
      settingMap.get("BACKGROUND_JOBS_RUNTIME_NOTE") ??
      (env.backgroundJobsMode === "queue"
        ? "Background worker mode is configured."
        : "Background work runs inline inside operator actions."),
    fileStorageMode: settingMap.get("FILE_STORAGE_MODE") ?? env.fileStorageMode,
    fileStoragePath: settingMap.get("FILE_STORAGE_PATH") ?? env.fileStoragePath,
    alertNotifyEmail: (settingMap.get("ALERT_NOTIFY_EMAIL") ?? "false") === "true",
    alertNotifySlack: (settingMap.get("ALERT_NOTIFY_SLACK") ?? "false") === "true",
    alertNotifyOps: (settingMap.get("ALERT_NOTIFY_OPS") ?? "true") === "true",
    blindReviewMode: (settingMap.get("BLIND_REVIEW_MODE") ?? "false") === "true",
    strictEvidenceMode: (settingMap.get("STRICT_EVIDENCE_MODE") ?? "true") === "true",
    requireOutboundApproval: (settingMap.get("REQUIRE_OUTBOUND_APPROVAL") ?? "true") === "true",
    blockSponsorFacingPii: (settingMap.get("BLOCK_SPONSOR_FACING_PII") ?? "true") === "true",
    pilotTemplate: pilotTemplateKey,
    guidedDemoMode: (settingMap.get("GUIDED_DEMO_MODE") ?? "true") === "true",
    pilotRuntimeNote:
      settingMap.get("PILOT_RUNTIME_NOTE") ?? "Pilot positioning defaults to small foundation with guided demo mode enabled.",
    pilotProfile,
    pilotLaunchWorkstream,
    appName: settingMap.get("APP_NAME") ?? "SignalSponsor",
    automationPolicy,
    workspace: {
      id: session.organization.id,
      name: session.organization.name,
      slug: session.organization.slug,
    },
    currentUser: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      membershipRole: session.membership.membershipRole,
    },
    currentSessionId: session.id,
    counts: {
      candidates: counts[0],
      sponsors: counts[1],
      artifacts: counts[2],
      claims: counts[3],
      recommendations: counts[4],
      briefs: counts[5],
      crmSyncs: counts[6],
      sponsorActivity: counts[7],
      progressSnapshots: counts[8],
      alerts: counts[9],
      stageEvents: counts[10],
      outboundApprovals: counts[11],
      pilotSnapshots: counts[12],
      digestDeliveries: counts[13],
      storedFiles: counts[14],
      backgroundJobs: counts[15],
      recoveryJobs: counts[16],
      recoveryCrmSyncs: counts[17],
    },
    recentDigestDeliveries: recentDigestDeliveries.map((delivery) => ({
      ...delivery,
      createdAtLabel: formatDate(delivery.createdAt),
    })),
    recentStoredFiles: recentStoredFiles.map((file) => ({
      ...file,
      createdAtLabel: formatDate(file.createdAt),
    })),
    recentBackgroundJobs: recentBackgroundJobs.map((job) => ({
      ...job,
      createdAtLabel: formatDate(job.createdAt),
      updatedAtLabel: formatDate(job.updatedAt),
      availableAtLabel: formatDate(job.availableAt),
      startedAtLabel: job.startedAt ? formatDate(job.startedAt) : null,
      finishedAtLabel: job.finishedAt ? formatDate(job.finishedAt) : null,
    })),
    recoveryBackgroundJobs: recoveryBackgroundJobs.map((job) => ({
      ...job,
      createdAtLabel: formatDate(job.createdAt),
      updatedAtLabel: formatDate(job.updatedAt),
      availableAtLabel: formatDate(job.availableAt),
      startedAtLabel: job.startedAt ? formatDate(job.startedAt) : null,
      finishedAtLabel: job.finishedAt ? formatDate(job.finishedAt) : null,
    })),
    recoveryCrmSyncs: recoveryCrmSyncs.map((sync) => ({
      ...sync,
      createdAtLabel: formatDate(sync.createdAt),
      updatedAtLabel: formatDate(sync.updatedAt),
      syncedAtLabel: sync.syncedAt ? formatDate(sync.syncedAt) : null,
    })),
    recentAuditLogs: recentAuditLogs.map((log) => ({
      ...log,
      createdAtLabel: formatDate(log.createdAt),
    })),
    crmSyncHealth,
    teamMembers: teamMembers.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
      title: membership.title,
    })),
    currentUserSessions: currentUserSessions.map((appSession) => ({
      id: appSession.id,
      createdAtLabel: formatDate(appSession.createdAt),
      expiresAtLabel: formatDate(appSession.expiresAt),
      isCurrent: appSession.id === session.id,
    })),
    workspaceInvites: workspaceInvites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      inviteeName: invite.inviteeName,
      membershipRole: invite.membershipRole,
      title: invite.title,
      status: invite.status === "ACTIVE" && invite.expiresAt < new Date() ? "EXPIRED" : invite.status,
      expiresAtLabel: formatDate(invite.expiresAt),
      createdByName: invite.createdBy?.name ?? null,
      path: `/accept-invite/${invite.token}`,
    })),
  };
}

export async function getPilotMeasurementData() {
  const session = await requirePageSession();
  const [snapshots, baselineSnapshot, currentMetrics] = await Promise.all([
    prisma.pilotMetricSnapshot.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        capturedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        capturedAt: "desc",
      },
      take: 8,
    }),
    prisma.pilotMetricSnapshot.findFirst({
      where: {
        organizationId: session.organizationId,
        snapshotType: PilotMetricSnapshotType.BASELINE,
      },
      include: {
        capturedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        capturedAt: "desc",
      },
    }),
    buildCurrentPilotMetricsForOrganization(session.organizationId),
  ]);

  const recentSnapshots = snapshots.map((snapshot) => formatPilotSnapshot(snapshot));
  const baseline = baselineSnapshot ? formatPilotSnapshot(baselineSnapshot) : null;
  const latestCheckpoint =
    recentSnapshots.find((snapshot) => snapshot.snapshotType === PilotMetricSnapshotType.CHECKPOINT) ?? null;
  const measuredReviewTimeDelta =
    baseline && latestCheckpoint
      ? buildMeasuredReviewTimeDeltaRow({
          baseline,
          checkpoint: latestCheckpoint,
        })
      : null;

  return {
    currentMetrics,
    baseline,
    latestCheckpoint,
    recentSnapshots,
    observedDeltas: baseline
      ? [
          ...buildPilotObservedDeltaRows({ baseline, current: currentMetrics }),
          ...(measuredReviewTimeDelta ? [measuredReviewTimeDelta] : []),
        ]
      : [],
  };
}

export async function getAlertsCenterData() {
  const session = await requirePageSession();
  const [openAlerts, deliveries, teamMembers] = await Promise.all([
    prisma.operatorAlert.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: AlertStatus.OPEN,
      },
      include: {
        candidate: true,
        assignedUser: true,
        operatorTask: true,
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    }),
    prisma.alertDigestDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    stats: {
      total: openAlerts.length,
      action: openAlerts.filter((alert) => alert.severity === "ACTION").length,
      caution: openAlerts.filter((alert) => alert.severity === "CAUTION").length,
      info: openAlerts.filter((alert) => alert.severity === "INFO").length,
      manualOverrides: openAlerts.filter((alert) => alert.alertType === "MANUAL_OVERRIDE").length,
    },
    alerts: openAlerts.map((alert) => ({
      ...alert,
      createdAtLabel: formatDate(alert.createdAt),
      updatedAtLabel: formatDate(alert.updatedAt),
      dueAtLabel: alert.dueAt ? formatDate(alert.dueAt) : null,
    })),
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      createdAtLabel: formatDate(delivery.createdAt),
    })),
    teamMembers: teamMembers.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
    })),
  };
}

export async function getAnalyticsData() {
  const session = await requirePageSession();
  const [candidates, alerts, activities, sponsorOutcomes, syncs, stageEvents, members, tasks, pipelineItems, audits] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        sponsorMemo: {
          select: {
            status: true,
          },
        },
        recommendations: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.operatorAlert.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        assignedUser: true,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
    }),
    prisma.sponsorOutcome.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.crmSyncRecord.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
    }),
    prisma.candidateStageEvent.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        candidate: true,
      },
    }),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
    prisma.operatorTask.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
    }),
    buildAuditDataForWorkspace({
      organizationId: session.organizationId,
      organization: {
        name: session.organization.name,
      },
    }),
  ]);

  const stageBreakdown = [
    { label: "Intake", value: candidates.filter((candidate) => candidate.currentStage === "INTAKE").length },
    { label: "Review", value: candidates.filter((candidate) => candidate.currentStage === "REVIEW").length },
    { label: "Memo ready", value: candidates.filter((candidate) => candidate.currentStage === "MEMO_READY").length },
    { label: "Outreach", value: candidates.filter((candidate) => candidate.currentStage === "SPONSOR_OUTREACH").length },
    { label: "Hold", value: candidates.filter((candidate) => candidate.currentStage === "HOLD").length },
  ];

  const assigneeBreakdown = members.map((membership) => {
    const assigned = alerts.filter((alert) => alert.assignedUserId === membership.userId && alert.status === "OPEN").length;
    const resolved = alerts.filter((alert) => alert.resolvedById === membership.userId && alert.status === "RESOLVED").length;
    const openTasks = tasks.filter(
      (task) =>
        task.ownerUserId === membership.userId &&
        (task.status === TaskStatus.OPEN || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.BLOCKED),
    ).length;
    const completedTasks = tasks.filter(
      (task) => task.ownerUserId === membership.userId && task.status === TaskStatus.COMPLETED,
    ).length;
    const activePipeline = pipelineItems.filter(
      (item) =>
        item.ownerUserId === membership.userId &&
        item.stage !== "PASSED" &&
        item.stage !== "CLOSED",
    ).length;

    return {
      id: membership.user.id,
      name: membership.user.name,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
      openAlerts: assigned,
      resolvedAlerts: resolved,
      openTasks,
      completedTasks,
      activePipeline,
    };
  });

  const overdueAlerts = alerts.filter((alert) => alert.status === "OPEN" && alert.dueAt && alert.dueAt < new Date()).length;
  const dueSoonAlerts = alerts.filter((alert) => {
    if (alert.status !== "OPEN" || !alert.dueAt) {
      return false;
    }

    const hoursUntilDue = (alert.dueAt.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilDue >= 0 && hoursUntilDue <= 48;
  }).length;

  const outcomes = deriveCandidateOutcomeRows({
    candidateIds: candidates.map((candidate) => candidate.id),
    activities: activities.map((activity) => ({
      candidateId: activity.candidateId,
      activityType: activity.activityType,
      status: activity.status,
      detail: activity.detail,
    })),
    pipelineItems: pipelineItems.map((item) => ({
      candidateId: item.candidateId,
      stage: item.stage,
      outcomeNote: item.outcomeNote,
    })),
    structuredOutcomes: sponsorOutcomes.map((outcome) => ({
      candidateId: outcome.candidateId,
      verdict: outcome.verdict,
      detail: outcome.detail,
      occurredAt: outcome.occurredAt,
    })),
  });
  const decisionQuality = buildDecisionQualitySummary({
    rows: audits.candidateRows,
    outcomes,
  });
  const reviewerCalibration = buildReviewerCalibrationRows({
    rows: audits.candidateRows,
    decisionOwners: audits.candidateRows.map((row) => ({
      candidateId: row.candidateId,
      decidedById: row.humanDecidedById,
      decidedByName: row.humanDecidedByName,
    })),
    outcomes,
  });
  const outcomeLearningPatterns = buildOutcomeLearningPatterns({
    rows: audits.candidateRows,
    outcomes,
  });
  const recalibrationSuggestions = buildScoreRecalibrationSuggestions({
    rows: audits.candidateRows,
    outcomes,
  });
  const positiveOutcomes = outcomes.filter((item) => item.verdict === "positive").length;
  const negativeOutcomes = outcomes.filter((item) => item.verdict === "negative").length;
  const activeOutcomes = outcomes.filter((item) => item.verdict === "in_progress").length;
  const knownOutcomeCount = positiveOutcomes + negativeOutcomes;

  return {
    workspace: {
      name: session.organization.name,
    },
    kpis: [
      { label: "Open alerts", value: alerts.filter((alert) => alert.status === "OPEN").length, detail: "Current operator queue" },
      { label: "Overdue alerts", value: overdueAlerts, detail: "Past SLA due date" },
      { label: "Due soon", value: dueSoonAlerts, detail: "Within 48 hours" },
      { label: "Sponsor activity", value: activities.length, detail: "Tracked external ops events" },
      { label: "Known outcomes", value: knownOutcomeCount, detail: "Positive or negative sponsor results" },
      { label: "Positive outcomes", value: positiveOutcomes, detail: "Sponsor paths with favorable results" },
      { label: "Negative outcomes", value: negativeOutcomes, detail: "Sponsor paths that stalled or closed" },
      { label: "CRM syncs", value: syncs.length, detail: "Recorded handoffs" },
      { label: "Stage events", value: stageEvents.length, detail: "Latest workflow changes" },
      { label: "Open tasks", value: tasks.filter((task) => task.status !== TaskStatus.COMPLETED).length, detail: "Current operator workload" },
      { label: "Active pipeline", value: pipelineItems.filter((item) => item.stage !== "PASSED" && item.stage !== "CLOSED").length, detail: "Sponsor paths in motion" },
    ],
    stageBreakdown,
    assigneeBreakdown,
    outcomes: {
      positive: positiveOutcomes,
      negative: negativeOutcomes,
      inProgress: activeOutcomes,
      none: outcomes.filter((item) => item.verdict === "none").length,
      rows: outcomes,
    },
    decisionQuality,
    reviewerCalibration,
    outcomeLearningPatterns,
    recalibrationSuggestions,
    recentStageEvents: stageEvents.map((event) => ({
      ...event,
      createdAtLabel: formatDate(event.createdAt),
    })),
  };
}

export async function getAuditData() {
  const session = await requirePageSession();

  return buildAuditDataForWorkspace({
    organizationId: session.organizationId,
    organization: {
      name: session.organization.name,
    },
  });
}

export async function getCalibrationWorkspaceData() {
  const [settings, analytics, stateRow] = await Promise.all([
    getSettingsSnapshot(),
    getAnalyticsData(),
    prisma.appSetting.findUnique({
      where: { key: "REVIEWER_CALIBRATION_WORKSPACE" },
      select: { value: true },
    }),
  ]);

  const template = getPilotTemplate(settings.pilotTemplate);

  return {
    template,
    pilotProfile: settings.pilotProfile,
    calibrationWorkspace: buildReviewerCalibrationWorkspace({
      reviewers: analytics.reviewerCalibration,
      template,
      rawValue: stateRow?.value,
    }),
    reviewerCalibration: analytics.reviewerCalibration,
    recalibrationSuggestions: analytics.recalibrationSuggestions,
    outcomes: analytics.outcomes,
  };
}

export async function getCommercialProofData() {
  const [settings, pilotData, health] = await Promise.all([
    getSettingsSnapshot(),
    getPilotMeasurementData(),
    getDeploymentHealthSnapshot(),
  ]);

  const template = getPilotTemplate(settings.pilotTemplate);
  const checkpointCount = pilotData.recentSnapshots.filter((snapshot) => snapshot.snapshotType === "CHECKPOINT").length;
  const readiness = buildCommercialReadinessModel({
    candidateCount: pilotData.currentMetrics.candidateCount,
    memoReadyCount: pilotData.currentMetrics.memoReadyCount,
    sponsorReadyCount: pilotData.currentMetrics.sponsorReadyCount,
    activePipelineCount: pilotData.currentMetrics.activePipelineCount,
    knownOutcomeCount: pilotData.currentMetrics.knownOutcomeCount,
    positiveOutcomeCount: pilotData.currentMetrics.positiveOutcomeCount,
    openAlerts: pilotData.currentMetrics.openAlertsCount,
    openTasks: pilotData.currentMetrics.openTasksCount,
    checkpointCount,
    hasMeasuredBaseline: Boolean(pilotData.baseline),
    guidedDemoMode: settings.guidedDemoMode,
    blindReviewMode: settings.blindReviewMode,
    strictEvidenceMode: settings.strictEvidenceMode,
    requireOutboundApproval: settings.requireOutboundApproval,
    healthStatus: health.status === "down" ? "unhealthy" : health.status,
  });

  return {
    settings,
    pilotData,
    health,
    template,
    checkpointCount,
    readiness,
  };
}

export async function getPilotLaunchData() {
  const [settings, dashboard, health] = await Promise.all([
    getSettingsSnapshot(),
    getDashboardData(),
    getDeploymentHealthSnapshot(),
  ]);

  const template = getPilotTemplate(settings.pilotTemplate);

  return {
    settings,
    dashboard,
    health,
    template,
  };
}

export async function getExecutiveRoiData() {
  const [settings, pilotData, health] = await Promise.all([
    getSettingsSnapshot(),
    getPilotMeasurementData(),
    getDeploymentHealthSnapshot(),
  ]);

  const template = getPilotTemplate(settings.pilotTemplate);
  const roiModel = buildPilotRoiModel(template.key, {
    candidateCount: pilotData.currentMetrics.candidateCount,
    memoReadyCount: pilotData.currentMetrics.memoReadyCount,
    sponsorReadyCount: pilotData.currentMetrics.sponsorReadyCount,
    activePipelineCount: pilotData.currentMetrics.activePipelineCount,
    openAlerts: pilotData.currentMetrics.openAlertsCount,
    openTasks: pilotData.currentMetrics.openTasksCount,
    knownOutcomeCount: pilotData.currentMetrics.knownOutcomeCount,
    positiveOutcomeCount: pilotData.currentMetrics.positiveOutcomeCount,
    disagreementRate: pilotData.currentMetrics.disagreementRate,
    blindReviewMode: pilotData.currentMetrics.blindReviewMode,
    strictEvidenceMode: pilotData.currentMetrics.strictEvidenceMode,
    requireOutboundApproval: pilotData.currentMetrics.requireOutboundApproval,
  });

  return {
    settings,
    pilotData,
    health,
    template,
    roiModel,
    healthCheckedAtLabel: formatDate(health.checkedAt),
  };
}

export async function getPilotProofReportData() {
  const [commercialData, analytics, stateRow] = await Promise.all([
    getCommercialProofData(),
    getAnalyticsData(),
    prisma.appSetting.findUnique({
      where: { key: "REVIEWER_CALIBRATION_WORKSPACE" },
      select: { value: true },
    }),
  ]);

  const { settings, pilotData, health, template, readiness: commercialReadiness } = commercialData;
  const calibrationWorkspace = buildReviewerCalibrationWorkspace({
    reviewers: analytics.reviewerCalibration,
    template,
    rawValue: stateRow?.value,
  });
  const roiModel = buildPilotRoiModel(template.key, {
    candidateCount: pilotData.currentMetrics.candidateCount,
    memoReadyCount: pilotData.currentMetrics.memoReadyCount,
    sponsorReadyCount: pilotData.currentMetrics.sponsorReadyCount,
    activePipelineCount: pilotData.currentMetrics.activePipelineCount,
    openAlerts: pilotData.currentMetrics.openAlertsCount,
    openTasks: pilotData.currentMetrics.openTasksCount,
    knownOutcomeCount: pilotData.currentMetrics.knownOutcomeCount,
    positiveOutcomeCount: pilotData.currentMetrics.positiveOutcomeCount,
    disagreementRate: pilotData.currentMetrics.disagreementRate,
    blindReviewMode: pilotData.currentMetrics.blindReviewMode,
    strictEvidenceMode: pilotData.currentMetrics.strictEvidenceMode,
    requireOutboundApproval: pilotData.currentMetrics.requireOutboundApproval,
  });
  const report = buildPilotProofReport({
    template,
    pilotProfile: settings.pilotProfile,
    launchWorkstream: settings.pilotLaunchWorkstream,
    currentMetrics: pilotData.currentMetrics,
    baseline: pilotData.baseline,
    latestCheckpoint: pilotData.latestCheckpoint,
    recentSnapshots: pilotData.recentSnapshots,
    observedDeltas: pilotData.observedDeltas,
    roiModel,
    commercialReadiness,
    calibrationWorkspace,
    healthStatus: health.status === "down" ? "unhealthy" : health.status,
  });

  return {
    template,
    pilotProfile: settings.pilotProfile,
    launchWorkstream: settings.pilotLaunchWorkstream,
    pilotData,
    calibrationWorkspace,
    roiModel,
    commercialReadiness,
    health,
    report,
  };
}

export async function getPilotPackData() {
  const data = await getPilotProofReportData();

  return {
    ...data,
    buyerPack: buildPilotBuyerPack({
      template: data.template,
      pilotProfile: data.pilotProfile,
      proofReport: data.report,
      commercialReadiness: data.commercialReadiness,
      roiModel: data.roiModel,
    }),
  };
}

export async function getAuditExportData() {
  const session = await getAppSession();

  if (!session) {
    return null;
  }

  return buildAuditDataForWorkspace({
    organizationId: session.organizationId,
    organization: {
      name: session.organization.name,
    },
  });
}

export async function getSponsorPipelineData(filters?: {
  query?: string;
  stage?: string;
  owner?: string;
  score?: string;
}) {
  const session = await requirePageSession();
  const [
    items,
    members,
    edges,
    sponsorActivities,
    sponsorPipelineItems,
    sponsorOutcomes,
    opportunityBriefs,
    outboundEmails,
    outboundApprovals,
    recoveryJobCount,
    recoveryCrmSyncCount,
  ] = await Promise.all([
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      include: {
        candidate: {
          include: {
            artifacts: true,
            evidenceClaims: true,
            candidateUpdates: {
              select: {
                updatedAt: true,
              },
            },
            proofRequests: {
              select: {
                updatedAt: true,
                status: true,
              },
            },
          },
        },
        sponsor: true,
        owner: true,
        opportunityBrief: true,
        recommendation: true,
        sponsorOutcomes: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          include: {
            recordedBy: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        candidateId: true,
        activityType: true,
        status: true,
        detail: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        candidateId: true,
        stage: true,
        outcomeNote: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.sponsorOutcome.findMany({
      where: {
        organizationId: session.organizationId,
      },
      select: {
        sponsorId: true,
        candidateId: true,
        verdict: true,
        detail: true,
        occurredAt: true,
        recordedAt: true,
        updatedAt: true,
      },
    }),
    prisma.opportunityBrief.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        candidateId: true,
        sponsorId: true,
        updatedAt: true,
      },
    }),
    prisma.outboundEmail.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        candidateId: true,
        sponsorId: true,
        updatedAt: true,
      },
    }),
    prisma.outboundApproval.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        id: true,
        candidateId: true,
        sponsorId: true,
        approvalType: true,
        status: true,
        decisionNote: true,
        title: true,
        rationale: true,
        createdAt: true,
        reviewedAt: true,
      },
    }),
    prisma.backgroundJob.count({
      where: {
        organizationId: session.organizationId,
        status: {
          in: ["FAILED", "RETRYABLE"],
        },
      },
    }),
    prisma.crmSyncRecord.count({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
        status: {
          in: [CrmSyncStatus.FAILED, CrmSyncStatus.FALLBACK],
        },
      },
    }),
  ]);

  const sponsorOperatingContext = groupSponsorOperatingContext(
    sponsorActivities,
    sponsorPipelineItems,
    sponsorOutcomes,
  );
  const briefCountByPath = opportunityBriefs.reduce((accumulator, brief) => {
    const key = `${brief.candidateId}:${brief.sponsorId}`;
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
    return accumulator;
  }, new Map<string, number>());
  const outboundEmailCountByPath = outboundEmails.reduce((accumulator, email) => {
    const key = `${email.candidateId}:${email.sponsorId}`;
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
    return accumulator;
  }, new Map<string, number>());
  const outboundApprovalByPath = outboundApprovals.reduce((accumulator, approval) => {
    if (approval.approvalType !== OutboundApprovalType.OUTREACH_RELEASE) {
      return accumulator;
    }

    accumulator.set(`${approval.candidateId}:${approval.sponsorId}`, approval);
    return accumulator;
  }, new Map<string, (typeof outboundApprovals)[number]>());
  const rankedItems = items
    .map((item) => {
      const currentArtifacts = getCurrentArtifacts(item.candidate.artifacts);
      const currentClaims = filterClaimsForArtifacts(item.candidate.evidenceClaims, item.candidate.artifacts);
      const pairKey = `${item.candidateId}:${item.sponsorId}`;
      const sponsorContext = sponsorOperatingContext.get(item.sponsorId);
      const currentMatch = computeSponsorMatch(
        item.candidate,
        item.sponsor,
        currentArtifacts,
        currentClaims,
        edges,
        sponsorContext,
      );
      const sponsorSpecificPipelineItems = (sponsorContext?.sponsorPipelineItems ?? []).filter(
        (pipelineItem) => pipelineItem.candidateId === item.candidateId,
      );
      const sponsorSpecificOutcomes = (sponsorContext?.sponsorOutcomes ?? []).filter(
        (outcome) => outcome.candidateId === item.candidateId,
      );
      const negativeMemory = Array.from(
        new Set(
          [
            ...sponsorSpecificPipelineItems.flatMap((pipelineItem) => {
              const memory: string[] = [];

              if (pipelineItem.stage === "PASSED") {
                memory.push("already passed");
              }

              if ((pipelineItem.outcomeNote ?? "").toLowerCase().includes("timing")) {
                memory.push("wrong timing");
              }

              if ((pipelineItem.outcomeNote ?? "").toLowerCase().includes("not a fit")) {
                memory.push("not a fit");
              }

              return memory;
            }),
            ...sponsorSpecificOutcomes.flatMap((outcome) => {
              const detail = outcome.detail.toLowerCase();
              const memory: string[] = [];

              if (outcome.verdict === "NEGATIVE" && detail.includes("declin")) {
                memory.push("already declined");
              }

              if (detail.includes("timing")) {
                memory.push("wrong timing");
              }

              if (detail.includes("not a fit")) {
                memory.push("not a fit");
              }

              if (detail.includes("more proof")) {
                memory.push("needs more proof");
              }

              return memory;
            }),
          ].filter((value): value is string => Boolean(value)),
        ),
      ).slice(0, 4);
      const sponsorPathHistory = buildSponsorPathHistorySummary({
        briefCount: briefCountByPath.get(pairKey) ?? 0,
        outboundEmailCount: outboundEmailCountByPath.get(pairKey) ?? 0,
        activePipelineStage: sponsorSpecificPipelineItems[0]?.stage ?? item.stage,
        negativeMemory,
        blackoutActive: currentMatch.operatingProfile.blackoutActive,
        blackoutReason: currentMatch.operatingProfile.blackoutReason ?? null,
        blackoutUntilLabel: currentMatch.operatingProfile.blackoutUntil
          ? formatDate(currentMatch.operatingProfile.blackoutUntil)
          : null,
      });
      const outreachApproval = outboundApprovalByPath.get(pairKey) ?? null;
      const outreachApprovalSummary = summarizeOutboundApprovalState({
        approvalType: OutboundApprovalType.OUTREACH_RELEASE,
        approval: outreachApproval,
        blocked: sponsorPathHistory.duplicateAskRisk || sponsorPathHistory.blackoutActive,
        blockers: [
          sponsorPathHistory.duplicateAskReason
            ? `Overlapping sponsor motion is already recorded: ${sponsorPathHistory.duplicateAskReason}.`
            : null,
          sponsorPathHistory.blackoutActive
            ? sponsorPathHistory.blackoutReason
              ? `Sponsor timing blackout: ${sponsorPathHistory.blackoutReason}.`
              : `Sponsor timing blackout${sponsorPathHistory.blackoutUntilLabel ? ` through ${sponsorPathHistory.blackoutUntilLabel}` : ""}.`
            : null,
        ].filter((value): value is string => Boolean(value)),
      });
      const recommendationFreshness = item.recommendation
        ? buildRecommendationFreshnessReport({
            recommendation: item.recommendation,
            currentScore: currentMatch.score,
            currentRightNowLabel: currentMatch.rightNowLabel,
            candidate: item.candidate,
            sponsor: item.sponsor,
            artifacts: currentArtifacts,
            claims: currentClaims,
            candidateUpdates: item.candidate.candidateUpdates,
            proofRequests: item.candidate.proofRequests,
            sponsorActivities: sponsorContext?.sponsorActivities,
            sponsorPipelineItems: sponsorContext?.sponsorPipelineItems,
            sponsorOutcomes: sponsorContext?.sponsorOutcomes,
          })
        : null;

      return {
        ...item,
        currentMatch,
        sponsorPathHistory,
        outreachApproval,
        outreachApprovalSummary,
        recommendationFreshness,
      };
    })
    .sort((left, right) => {
      if (right.currentMatch.score !== left.currentMatch.score) {
        return right.currentMatch.score - left.currentMatch.score;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });

  const filtered = rankedItems.filter((item) => {
    const query = filters?.query?.toLowerCase().trim();
    const haystack = `${item.candidate.fullName} ${item.sponsor.fullName} ${item.sponsor.organization} ${item.rationale} ${item.nextStep ?? ""}`.toLowerCase();

    if (query && !haystack.includes(query)) {
      return false;
    }

    if (filters?.stage && filters.stage !== "all" && item.stage !== filters.stage) {
      return false;
    }

    if (filters?.owner && filters.owner !== "all") {
      if (filters.owner === "unowned") {
        return !item.ownerUserId;
      }

      return item.ownerUserId === filters.owner;
    }

    if (filters?.score === "high" && item.currentMatch.score < 70) {
      return false;
    }

    if (filters?.score === "medium" && (item.currentMatch.score < 50 || item.currentMatch.score >= 70)) {
      return false;
    }

    if (filters?.score === "low" && item.currentMatch.score >= 50) {
      return false;
    }

    return true;
  });

  return {
    stats: {
      total: filtered.length,
      active: filtered.filter((item) => item.stage !== "PASSED" && item.stage !== "CLOSED").length,
      advocacy: filtered.filter((item) => item.stage === "ADVOCATING").length,
      meetingScheduled: filtered.filter((item) => item.stage === "MEETING_SCHEDULED").length,
      blocked: filtered.filter((item) => item.stage === "PASSED").length,
      stale: filtered.filter((item) => item.recommendationFreshness?.severity === "stale").length,
      duplicateRisk: filtered.filter((item) => item.sponsorPathHistory.duplicateAskRisk).length,
      blackout: filtered.filter((item) => item.currentMatch.operatingProfile.blackoutActive).length,
      unreleased: filtered.filter(
        (item) =>
          item.outreachApprovalSummary.state !== "approved" ||
          item.sponsorPathHistory.duplicateAskRisk ||
          item.currentMatch.operatingProfile.blackoutActive,
      ).length,
      recoveryJobs: recoveryJobCount,
      recoveryCrmSyncs: recoveryCrmSyncCount,
    },
    items: filtered.map((item) => ({
      ...item,
      createdAtLabel: formatDate(item.createdAt),
      updatedAtLabel: formatDate(item.updatedAt),
      nextDueAtLabel: item.nextDueAt ? formatDate(item.nextDueAt) : null,
      latestOutcome: item.sponsorOutcomes[0]
        ? {
            ...item.sponsorOutcomes[0],
            occurredAtLabel: formatDate(item.sponsorOutcomes[0].occurredAt),
            recordedAtLabel: formatDate(item.sponsorOutcomes[0].recordedAt),
          }
        : null,
    })),
    teamMembers: members.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
    })),
  };
}

export async function getTasksData() {
  return getTasksDataWithFilters({});
}

export async function getTasksDataWithFilters(filters: {
  query?: string;
  status?: string;
  owner?: string;
  priority?: string;
}) {
  const session = await requirePageSession();
  const [tasks, members] = await Promise.all([
    prisma.operatorTask.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        candidate: true,
        sponsor: true,
        owner: true,
        sourceAlert: true,
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.organizationMembership.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        user: true,
      },
      orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const filtered = tasks.filter((task) => {
    const query = filters.query?.toLowerCase().trim();
    const haystack = `${task.title} ${task.detail} ${task.sourceLabel} ${task.candidate?.fullName ?? ""} ${task.sponsor?.fullName ?? ""}`.toLowerCase();

    if (query && !haystack.includes(query)) {
      return false;
    }

    if (filters.status && filters.status !== "all" && task.status !== filters.status) {
      return false;
    }

    if (filters.owner && filters.owner !== "all") {
      if (filters.owner === "unowned") {
        return !task.ownerUserId;
      }

      return task.ownerUserId === filters.owner;
    }

    if (filters.priority && filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }

    return true;
  });

  return {
    stats: {
      total: filtered.length,
      open: filtered.filter((task) => task.status === "OPEN").length,
      inProgress: filtered.filter((task) => task.status === "IN_PROGRESS").length,
      blocked: filtered.filter((task) => task.status === "BLOCKED").length,
      completed: filtered.filter((task) => task.status === "COMPLETED").length,
    },
    tasks: filtered.map((task) => ({
      ...task,
      createdAtLabel: formatDate(task.createdAt),
      updatedAtLabel: formatDate(task.updatedAt),
      dueAtLabel: task.dueAt ? formatDate(task.dueAt) : null,
    })),
    teamMembers: members.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      role: membership.user.role,
      membershipRole: membership.membershipRole,
    })),
  };
}

export async function getCandidateCompareData(candidateIds?: string[]) {
  const session = await requirePageSession();
  const [candidates, sponsors, sponsorActivities, sponsorPipelineItems, sponsorOutcomes, edges, safetySettings] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        organizationId: session.organizationId,
      },
      include: {
        artifacts: true,
        evidenceClaims: true,
        operatorAlerts: {
          where: {
            status: AlertStatus.OPEN,
          },
        },
        sponsorMemo: {
          select: {
            status: true,
          },
        },
        recommendations: {
          select: {
            id: true,
            reviewStatus: true,
          },
        },
        opportunityBriefs: {
          select: {
            id: true,
            status: true,
          },
        },
        progressSnapshots: {
          orderBy: { capturedAt: "asc" },
        },
        candidateNotes: {
          select: {
            id: true,
          },
        },
        candidateDecisions: {
          select: {
            id: true,
          },
        },
        committeeReviews: {
          include: {
            votes: {
              select: {
                decision: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        sponsorPipelineItems: {
          select: {
            id: true,
            stage: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sponsor.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        activityType: true,
        status: true,
        detail: true,
      },
    }),
    prisma.sponsorPipelineItem.findMany({
      where: {
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        sponsorId: true,
        stage: true,
        outcomeNote: true,
      },
    }),
    prisma.sponsorOutcome.findMany({
      where: {
        organizationId: session.organizationId,
      },
      select: {
        sponsorId: true,
        verdict: true,
      },
    }),
    prisma.relationshipEdge.findMany({
      where: {
        organizationId: session.organizationId,
      },
    }),
    getSafetySettings(),
  ]);

  const sponsorOperatingContext = groupSponsorOperatingContext(
    sponsorActivities,
    sponsorPipelineItems,
    sponsorOutcomes,
  );
  const enriched = filterCandidates(candidates, edges, safetySettings.blindReviewMode, {});
  const selectedIds = candidateIds && candidateIds.length > 0 ? candidateIds : enriched.slice(0, 3).map((candidate) => candidate.id);

  return {
    selected: enriched
      .filter((candidate) => selectedIds.includes(candidate.id))
      .map((candidate) => {
        const currentClaims = filterClaimsForArtifacts(candidate.evidenceClaims, candidate.artifacts);
        const currentArtifacts = getCurrentArtifacts(candidate.artifacts);
        const topClaims = currentClaims
          .slice()
          .sort((left, right) => right.confidence - left.confidence)
          .slice(0, 3);
        const topSponsor = sponsors
          .map((sponsor) => ({
            sponsor,
            result: computeSponsorMatch(
              candidate,
              sponsor,
              currentArtifacts,
              currentClaims,
              edges,
              sponsorOperatingContext.get(sponsor.id),
            ),
          }))
          .sort((left, right) => right.result.score - left.result.score)[0];

        return {
          ...candidate,
          topClaims,
          topSponsor,
          noteCount: candidate.candidateNotes.length,
          decisionCount: candidate.candidateDecisions.length,
          latestCommitteeReview: candidate.committeeReviews[0]
            ? {
                status: candidate.committeeReviews[0].status,
                statusLabel: COMMITTEE_REVIEW_STATUS_LABELS[candidate.committeeReviews[0].status],
                consensusLabel: buildCommitteeConsensusLabel(candidate.committeeReviews[0]),
                voteSummary: summarizeCommitteeVotes(candidate.committeeReviews[0].votes),
              }
            : null,
          activePipelineCount: candidate.sponsorPipelineItems.filter(
            (item) => item.stage !== "PASSED" && item.stage !== "CLOSED",
          ).length,
        };
      }),
    availableCandidates: enriched.map((candidate) => ({
      id: candidate.id,
      fullName: candidate.displayName,
      readinessScore: candidate.readiness.score,
    })),
    safetySettings,
  };
}
