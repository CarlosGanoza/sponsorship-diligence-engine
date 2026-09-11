import { CandidateUpdateAccessLinkStatus, ProofRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const CANDIDATE_UPDATE_ACCESS_LINK_STATUS_LABELS: Record<CandidateUpdateAccessLinkStatus, string> = {
  ACTIVE: "Active",
  REVOKED: "Revoked",
};

export function buildCandidateUpdateAccessPath(token: string) {
  return `/updates/${token}`;
}

export async function getCandidateUpdateAccessContext(token: string) {
  const link = await prisma.candidateUpdateAccessLink.findUnique({
    where: { token },
    include: {
      candidate: {
        include: {
          artifacts: {
            where: {
              isCurrentVersion: true,
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            take: 8,
          },
        },
      },
      proofRequest: {
        include: {
          candidateUpdates: {
            orderBy: { submittedAt: "desc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!link) {
    return null;
  }

  const isExpired = link.expiresAt < new Date();
  const proofRequestClosed =
    link.proofRequest.status === ProofRequestStatus.RESOLVED || link.proofRequest.status === ProofRequestStatus.CANCELED;
  const isActive = link.status === CandidateUpdateAccessLinkStatus.ACTIVE && !isExpired && !proofRequestClosed;
  const [recentCandidateUpdates, openProofRequests, requestHistory] = await Promise.all([
    prisma.candidateUpdate.findMany({
      where: {
        candidateId: link.candidateId,
      },
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        incorporationNote: true,
        submittedAt: true,
        artifact: {
          select: {
            id: true,
            title: true,
            artifactType: true,
            versionNumber: true,
          },
        },
        sourceProofRequest: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 6,
    }),
    prisma.proofRequest.findMany({
      where: {
        candidateId: link.candidateId,
        status: {
          in: [ProofRequestStatus.OPEN, ProofRequestStatus.IN_PROGRESS],
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        reminderCount: true,
        lastReminderAt: true,
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 4,
    }),
    prisma.proofRequest.findMany({
      where: {
        candidateId: link.candidateId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        requestType: true,
        dueAt: true,
        createdAt: true,
        resolvedAt: true,
        reminderCount: true,
        resolutionNote: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const candidateSafeStatus = isActive
    ? {
        label: "Awaiting your update",
        detail:
          link.proofRequest.lastReminderAt
            ? "The review team is waiting for additional evidence on this request. A recent reminder was already sent, and new material will be reviewed before it is used anywhere else."
            : "The review team is waiting for additional evidence on this request. New material will be reviewed before it is used anywhere else.",
      }
    : proofRequestClosed
      ? {
          label: "Request closed",
          detail:
            "This proof request is already resolved or closed. The team can issue a new request if more material is still needed.",
        }
      : isExpired
        ? {
            label: "Link expired",
            detail:
              "This secure link has expired. Contact the operator who sent it if you still need to submit an update.",
          }
        : {
            label: "Link inactive",
            detail:
              "This link is not active right now. Contact the operator who sent it if a refreshed submission window is needed.",
          };

  return {
    link,
    candidate: link.candidate,
    proofRequest: link.proofRequest,
    isExpired,
    proofRequestClosed,
    isActive,
    path: buildCandidateUpdateAccessPath(link.token),
    candidateSafeStatus,
    recentCandidateUpdates,
    openProofRequests,
    requestHistory,
    currentArtifacts: link.candidate.artifacts,
    updateStats: {
      submitted: recentCandidateUpdates.length,
      incorporated: recentCandidateUpdates.filter((update) => update.status === "INCORPORATED").length,
      openRequests: openProofRequests.length,
      resolvedRequests: requestHistory.filter((request) => request.status === ProofRequestStatus.RESOLVED).length,
    },
  };
}
