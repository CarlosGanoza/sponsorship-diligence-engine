import { OutboundApprovalType } from "@prisma/client";

import { buildSponsorMemoVariant } from "@/lib/memo/variant";
import { prisma } from "@/lib/db/prisma";
import { getCandidateDetail } from "@/lib/db/queries";
import { buildOutboundReleaseAssessment, buildSponsorPathHistorySummary } from "@/lib/outreach/approvals";
import { buildOutreachPlan } from "@/lib/outreach/plan";
import { formatDate } from "@/lib/utils/format";

export async function getOutreachContext(candidateId: string, selectedSponsorId?: string) {
  const data = await getCandidateDetail(candidateId);

  if (!data) {
    return null;
  }

  const selectedBrief =
    data.opportunityBriefs.find((brief) => brief.sponsorId === selectedSponsorId) ?? data.opportunityBriefs[0] ?? null;
  const selectedMatch = selectedBrief
    ? data.sponsorMatches.find((match) => match.sponsor.id === selectedBrief.sponsorId) ?? null
    : null;
  const sponsorRecommendation =
    selectedBrief
      ? data.recommendations.bestSponsors.find((item) => item.sponsorId === selectedBrief.sponsorId) ?? null
      : null;
  const warmPathRecommendation =
    selectedBrief
      ? data.recommendations.warmPaths.find((item) => item.sponsorId === selectedBrief.sponsorId) ?? null
      : null;

  if (!selectedBrief || !selectedMatch || !data.memo) {
    return {
      data,
      selectedBrief,
      selectedMatch,
      sponsorRecommendation,
      warmPathRecommendation,
      variant: null,
      outreachPlan: null,
      crmSyncRecords: [],
      outboundApprovals: {
        all: [],
        outreachRelease: null,
        crmHandoff: null,
      },
      outreachRelease: {
        blocked: true,
        blockers: ["Outreach context is not ready yet."],
        requiredTypes: [],
        approvalRequired: false,
        approvalByType: new Map(),
      },
      crmHandoffRelease: {
        blocked: true,
        blockers: ["CRM handoff context is not ready yet."],
        requiredTypes: [],
        approvalRequired: false,
        approvalByType: new Map(),
      },
      sponsorActivities: [],
      outboundEmails: [],
    };
  }

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
    nextActionRecommendation: data.recommendations.actions[0] ?? null,
    matchScore: selectedMatch.result.score,
    matchBreakdown: selectedMatch.result.breakdown,
    connectionPath: selectedMatch.connectionPath,
  });

  const outreachPlan = buildOutreachPlan({
    brief: selectedBrief,
    candidate: data.candidate,
    sponsor: selectedMatch.sponsor,
    connectionPath: selectedMatch.connectionPath,
    matchScore: selectedMatch.result.score,
    risks: variant.risks,
    sponsorAngle: variant.sponsorAngle,
    warmPathNote: warmPathRecommendation?.actionSuggestion,
  });

  const [crmSyncRecords, sponsorActivities] = await Promise.all([
    prisma.crmSyncRecord.findMany({
      where: {
        candidateId,
        sponsorId: selectedBrief.sponsorId,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sponsorActivity.findMany({
      where: {
        candidateId,
        sponsorId: selectedBrief.sponsorId,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const outboundEmails = await prisma.outboundEmail.findMany({
    where: {
      candidateId,
      sponsorId: selectedBrief.sponsorId,
    },
    include: {
      requestedBy: true,
      events: {
        include: {
          actor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { occurredAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const outboundApprovals = await prisma.outboundApproval.findMany({
    where: {
      candidateId,
      sponsorId: selectedBrief.sponsorId,
    },
    include: {
      requestedBy: {
        select: {
          name: true,
        },
      },
      reviewedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const openProofRequestCount = data.proofRequests.filter(
    (request) => request.status === "OPEN" || request.status === "IN_PROGRESS",
  ).length;
  const sponsorSpecificBriefs = data.opportunityBriefs.filter((brief) => brief.sponsorId === selectedBrief.sponsorId);
  const sponsorSpecificPipelineItems = data.candidate.sponsorPipelineItems.filter(
    (item) => item.sponsorId === selectedBrief.sponsorId,
  );
  const sponsorSpecificNegativeMemory = [
    ...sponsorSpecificPipelineItems.flatMap((item) => {
      const memory: string[] = [];

      if (item.stage === "PASSED") {
        memory.push("already passed");
      }

      if ((item.outcomeNote ?? "").toLowerCase().includes("timing")) {
        memory.push("wrong timing");
      }

      if ((item.outcomeNote ?? "").toLowerCase().includes("not a fit")) {
        memory.push("not a fit");
      }

      return memory;
    }),
    ...sponsorSpecificPipelineItems.flatMap((item) =>
      item.sponsorOutcomes.filter((outcome) => outcome.verdict !== "POSITIVE"),
    )
      .flatMap((outcome) => {
        const detail = outcome.detail.toLowerCase();
        const memory: string[] = [];

        if (outcome.outcomeType === "TIMING_MISMATCH" || detail.includes("timing")) {
          memory.push("wrong timing");
        }

        if (outcome.outcomeType === "DECLINED") {
          memory.push("already declined");
        }

        if (detail.includes("not a fit")) {
          memory.push("not a fit");
        }

        if (outcome.outcomeType === "NEEDS_MORE_PROOF") {
          memory.push("needs more proof");
        }

        return memory;
      }),
  ];
  const sponsorPathHistory = buildSponsorPathHistorySummary({
    briefCount: sponsorSpecificBriefs.length,
    outboundEmailCount: outboundEmails.length,
    activePipelineStage: sponsorSpecificPipelineItems[0]?.stage ?? null,
    negativeMemory: sponsorSpecificNegativeMemory,
    blackoutActive: selectedMatch.sponsor.blackoutUntil ? selectedMatch.sponsor.blackoutUntil.getTime() > Date.now() : false,
    blackoutReason: selectedMatch.sponsor.blackoutReason ?? null,
    blackoutUntilLabel: selectedMatch.sponsor.blackoutUntil ? formatDate(selectedMatch.sponsor.blackoutUntil) : null,
  });
  const mappedApprovals = outboundApprovals.map((approval) => ({
    ...approval,
    createdAtLabel: formatDate(approval.createdAt),
    updatedAtLabel: formatDate(approval.updatedAt),
    reviewedAtLabel: approval.reviewedAt ? formatDate(approval.reviewedAt) : null,
  }));
  const outreachRelease = buildOutboundReleaseAssessment({
    safetySettings: data.safetySettings,
    safetyReport: data.safetyReport,
    openProofRequestCount,
    staleRecommendationCount: data.recommendationFreshnessSummary.stale,
    approvals: mappedApprovals,
    sponsorPathHistory,
  });
  const crmHandoffRelease = buildOutboundReleaseAssessment({
    safetySettings: data.safetySettings,
    safetyReport: data.safetyReport,
    openProofRequestCount,
    staleRecommendationCount: data.recommendationFreshnessSummary.stale,
    approvals: mappedApprovals,
    forCrmHandoff: true,
    sponsorPathHistory,
  });

  return {
    data,
    selectedBrief,
    selectedMatch,
    sponsorRecommendation,
    warmPathRecommendation,
    variant,
    outreachPlan,
    crmSyncRecords: crmSyncRecords.map((sync) => ({
      ...sync,
      createdAtLabel: formatDate(sync.createdAt),
      updatedAtLabel: formatDate(sync.updatedAt),
    })),
    outboundApprovals: {
      all: mappedApprovals,
      outreachRelease:
        mappedApprovals.find((approval) => approval.approvalType === OutboundApprovalType.OUTREACH_RELEASE) ?? null,
      crmHandoff:
        mappedApprovals.find((approval) => approval.approvalType === OutboundApprovalType.CRM_HANDOFF) ?? null,
    },
    outreachRelease,
    crmHandoffRelease,
    sponsorPathHistory,
    sponsorActivities: sponsorActivities.map((activity) => ({
      ...activity,
      createdAtLabel: formatDate(activity.createdAt),
      updatedAtLabel: formatDate(activity.updatedAt),
    })),
    outboundEmails: outboundEmails.map((email) => ({
      ...email,
      createdAtLabel: formatDate(email.createdAt),
      updatedAtLabel: formatDate(email.updatedAt),
      sentAtLabel: email.sentAt ? formatDate(email.sentAt) : null,
      events: email.events.map((event) => ({
        ...event,
        createdAtLabel: formatDate(event.createdAt),
        occurredAtLabel: formatDate(event.occurredAt),
      })),
    })),
  };
}
