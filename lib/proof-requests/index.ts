import {
  ArtifactType,
  ProofRequestStatus,
  ProofRequestType,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { captureCandidateProgressSnapshot } from "@/lib/progress";

export const PROOF_REQUEST_STATUS_LABELS: Record<ProofRequestStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CANCELED: "Canceled",
};

export const PROOF_REQUEST_TYPE_LABELS: Record<ProofRequestType, string> = {
  MISSING_PROOF: "Missing proof",
  CONTRADICTION_REVIEW: "Contradiction review",
  THIRD_PARTY_CORROBORATION: "Third-party corroboration",
  QUANTIFIED_OUTCOME: "Quantified outcome",
  OWNERSHIP_EXAMPLE: "Ownership example",
  OUTCOME_CLARIFICATION: "Outcome clarification",
};

export const PROOF_REQUEST_ARTIFACT_SUGGESTIONS: Record<ProofRequestType, ArtifactType> = {
  [ProofRequestType.MISSING_PROOF]: ArtifactType.PROJECT_SUMMARY,
  [ProofRequestType.CONTRADICTION_REVIEW]: ArtifactType.REFLECTION,
  [ProofRequestType.THIRD_PARTY_CORROBORATION]: ArtifactType.RECOMMENDATION,
  [ProofRequestType.QUANTIFIED_OUTCOME]: ArtifactType.PROJECT_SUMMARY,
  [ProofRequestType.OWNERSHIP_EXAMPLE]: ArtifactType.PROJECT_SUMMARY,
  [ProofRequestType.OUTCOME_CLARIFICATION]: ArtifactType.REFLECTION,
};

export const PROOF_REQUEST_SLA_DAYS: Record<ProofRequestType, number> = {
  [ProofRequestType.MISSING_PROOF]: 7,
  [ProofRequestType.CONTRADICTION_REVIEW]: 3,
  [ProofRequestType.THIRD_PARTY_CORROBORATION]: 10,
  [ProofRequestType.QUANTIFIED_OUTCOME]: 7,
  [ProofRequestType.OWNERSHIP_EXAMPLE]: 5,
  [ProofRequestType.OUTCOME_CLARIFICATION]: 5,
};

export function getProofRequestArtifactSuggestion(requestType: ProofRequestType) {
  return PROOF_REQUEST_ARTIFACT_SUGGESTIONS[requestType] ?? ArtifactType.PROJECT_SUMMARY;
}

export function getProofRequestSlaDays(requestType: ProofRequestType) {
  return PROOF_REQUEST_SLA_DAYS[requestType] ?? 7;
}

export function buildProofRequestDefaultDueAt(requestType: ProofRequestType, fromDate = new Date()) {
  const dueAt = new Date(fromDate);
  dueAt.setUTCDate(dueAt.getUTCDate() + getProofRequestSlaDays(requestType));
  dueAt.setUTCHours(23, 59, 0, 0);
  return dueAt;
}

export function getProofRequestEffectiveDueAt(input: {
  requestType: ProofRequestType;
  dueAt?: Date | null;
  createdAt: Date;
}) {
  return input.dueAt ?? buildProofRequestDefaultDueAt(input.requestType, input.createdAt);
}

export function buildProofRequestSlaState(input: {
  requestType: ProofRequestType;
  status: ProofRequestStatus;
  dueAt?: Date | null;
  createdAt: Date;
  now?: Date;
}) {
  const effectiveDueAt = getProofRequestEffectiveDueAt(input);

  if (input.status === ProofRequestStatus.RESOLVED || input.status === ProofRequestStatus.CANCELED) {
    return {
      effectiveDueAt,
      label: "Closed",
      detail: "This proof request is no longer in the active SLA queue.",
      severity: "muted" as const,
      overdueDays: 0,
      dueSoon: false,
      overdue: false,
      usedDefaultDueAt: !input.dueAt,
    };
  }

  const now = input.now ?? new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayDelta = Math.ceil((effectiveDueAt.getTime() - now.getTime()) / msPerDay);

  if (dayDelta < 0) {
    const overdueDays = Math.abs(dayDelta);

    return {
      effectiveDueAt,
      label: overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`,
      detail: "This proof request is past its expected evidence follow-through window.",
      severity: "danger" as const,
      overdueDays,
      dueSoon: false,
      overdue: true,
      usedDefaultDueAt: !input.dueAt,
    };
  }

  if (dayDelta <= 2) {
    return {
      effectiveDueAt,
      label: dayDelta === 0 ? "Due today" : dayDelta === 1 ? "Due in 1 day" : `Due in ${dayDelta} days`,
      detail: "This proof request is inside the near-term SLA window.",
      severity: "gold" as const,
      overdueDays: 0,
      dueSoon: true,
      overdue: false,
      usedDefaultDueAt: !input.dueAt,
    };
  }

  return {
    effectiveDueAt,
    label: `Due in ${dayDelta} days`,
    detail: `Current SLA target is ${getProofRequestSlaDays(input.requestType)} days from request creation.`,
    severity: "sage" as const,
    overdueDays: 0,
    dueSoon: false,
    overdue: false,
    usedDefaultDueAt: !input.dueAt,
  };
}

export function getProofRequestSubmissionGuidance(requestType: ProofRequestType) {
  if (requestType === ProofRequestType.THIRD_PARTY_CORROBORATION) {
    return {
      heading: "Best submission for this request",
      checklist: [
        "Use a mentor, manager, or partner perspective rather than a self-description.",
        "Describe what the candidate directly owned, not only that they were promising.",
        "Include one concrete example with observable follow-through.",
      ],
      examplePrompt:
        "Example: I worked directly with the candidate on the pilot rollout. They coordinated the final delivery checklist across two teams and kept the work moving when timing slipped.",
    };
  }

  if (requestType === ProofRequestType.CONTRADICTION_REVIEW) {
    return {
      heading: "Best submission for this request",
      checklist: [
        "Clarify which version of events is correct.",
        "State whether the work was completed, still in progress, or paused.",
        "Explain the candidate’s actual ownership level as plainly as possible.",
      ],
      examplePrompt:
        "Example: The original reflection described an early draft. Since then, the pilot did launch, and I directly owned the rollout checklist and weekly partner coordination.",
    };
  }

  if (requestType === ProofRequestType.QUANTIFIED_OUTCOME || requestType === ProofRequestType.OUTCOME_CLARIFICATION) {
    return {
      heading: "Best submission for this request",
      checklist: [
        "Include at least one measurable result.",
        "Name the timeframe, scope, or cohort affected.",
        "Separate what changed from why the change mattered.",
      ],
      examplePrompt:
        "Example: Over six weeks, the revised process reached 420 residents and increased completion from 58% to 79% across three sites.",
    };
  }

  if (requestType === ProofRequestType.OWNERSHIP_EXAMPLE) {
    return {
      heading: "Best submission for this request",
      checklist: [
        "Name the decision, system, or workstream the candidate owned directly.",
        "Explain who else was involved and what the candidate personally drove.",
        "Include one outcome or follow-through signal if possible.",
      ],
      examplePrompt:
        "Example: I owned the implementation plan, ran the weekly partner check-ins, and made the final call on the rollout sequence when staffing changed.",
    };
  }

  return {
    heading: "Best submission for this request",
    checklist: [
      "Give one concrete example rather than a broad summary.",
      "Use inspectable language that an operator can cite directly.",
      "Focus on what was done, what changed, and why it matters.",
    ],
    examplePrompt:
      "Example: I added a clearer description of the work I directly owned, the partners involved, and the result that followed from that work.",
  };
}

function inferProofRequestType(detail: string) {
  const normalized = detail.toLowerCase();

  if (normalized.includes("conflict") || normalized.includes("contradiction")) {
    return ProofRequestType.CONTRADICTION_REVIEW;
  }

  if (normalized.includes("mentor") || normalized.includes("manager") || normalized.includes("third-party")) {
    return ProofRequestType.THIRD_PARTY_CORROBORATION;
  }

  if (normalized.includes("quantified") || normalized.includes("result")) {
    return ProofRequestType.QUANTIFIED_OUTCOME;
  }

  if (normalized.includes("leadership") || normalized.includes("ownership")) {
    return ProofRequestType.OWNERSHIP_EXAMPLE;
  }

  if (normalized.includes("closed-loop") || normalized.includes("outcome")) {
    return ProofRequestType.OUTCOME_CLARIFICATION;
  }

  return ProofRequestType.MISSING_PROOF;
}

function getPriority(requestType: ProofRequestType) {
  if (requestType === ProofRequestType.CONTRADICTION_REVIEW) {
    return TaskPriority.HIGH;
  }

  if (
    requestType === ProofRequestType.THIRD_PARTY_CORROBORATION ||
    requestType === ProofRequestType.OWNERSHIP_EXAMPLE
  ) {
    return TaskPriority.MEDIUM;
  }

  return TaskPriority.LOW;
}

export function buildProofRequestSuggestions(input: {
  missingProof: string[];
  potentialContradictions: string[];
}) {
  const suggestions = [
    ...input.potentialContradictions.map((detail) => ({
      requestType: ProofRequestType.CONTRADICTION_REVIEW,
      title: "Resolve conflicting evidence",
      detail,
    })),
    ...input.missingProof.map((detail) => ({
      requestType: inferProofRequestType(detail),
      title:
        inferProofRequestType(detail) === ProofRequestType.THIRD_PARTY_CORROBORATION
          ? "Request third-party corroboration"
          : inferProofRequestType(detail) === ProofRequestType.QUANTIFIED_OUTCOME
            ? "Request quantified outcome proof"
            : inferProofRequestType(detail) === ProofRequestType.OWNERSHIP_EXAMPLE
              ? "Request ownership example"
              : inferProofRequestType(detail) === ProofRequestType.OUTCOME_CLARIFICATION
                ? "Clarify delivery outcome"
                : "Request stronger supporting proof",
      detail,
    })),
  ];

  return suggestions.filter(
    (suggestion, index) =>
      suggestions.findIndex(
        (candidate) => candidate.requestType === suggestion.requestType && candidate.detail === suggestion.detail,
      ) === index,
  );
}

export async function createProofRequest(input: {
  candidateId: string;
  requestedById?: string | null;
  assignedUserId?: string | null;
  dueAt?: Date | null;
  requestType: ProofRequestType;
  title: string;
  detail: string;
  sourceDisagreementReviewId?: string | null;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: {
      id: true,
      fullName: true,
      organizationId: true,
    },
  });

  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const created = await prisma.proofRequest.create({
    data: {
      candidateId: input.candidateId,
      requestedById: input.requestedById ?? null,
      assignedUserId: input.assignedUserId ?? null,
      dueAt: input.dueAt ?? buildProofRequestDefaultDueAt(input.requestType),
      requestType: input.requestType,
      title: input.title.trim(),
      detail: input.detail.trim(),
      sourceDisagreementReviewId: input.sourceDisagreementReviewId ?? null,
      status: input.assignedUserId ? ProofRequestStatus.IN_PROGRESS : ProofRequestStatus.OPEN,
    },
    include: {
      requestedBy: true,
      assignedUser: true,
      resolvedBy: true,
      operatorTask: true,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: input.candidateId,
    label: "Proof request opened",
    summary: `${created.title}. ${created.detail}`,
  });

  return created;
}

export async function updateProofRequestWorkflow(input: {
  requestId: string;
  assignedUserId?: string | null;
  dueAt?: Date | null;
}) {
  const existing = await prisma.proofRequest.findUnique({
    where: { id: input.requestId },
    include: {
      operatorTask: true,
    },
  });

  if (!existing) {
    throw new Error("Proof request not found.");
  }

  const updated = await prisma.proofRequest.update({
    where: { id: input.requestId },
    data: {
      assignedUserId: input.assignedUserId ?? null,
      dueAt: input.dueAt ?? null,
      status:
        existing.status === ProofRequestStatus.OPEN && input.assignedUserId
          ? ProofRequestStatus.IN_PROGRESS
          : existing.status,
    },
    include: {
      requestedBy: true,
      assignedUser: true,
      resolvedBy: true,
      operatorTask: true,
    },
  });

  if (existing.operatorTask) {
    await prisma.operatorTask.update({
      where: { id: existing.operatorTask.id },
      data: {
        ownerUserId: input.assignedUserId ?? null,
        dueAt: input.dueAt ?? null,
        status:
          input.assignedUserId && existing.operatorTask.status === TaskStatus.OPEN
            ? TaskStatus.IN_PROGRESS
            : existing.operatorTask.status,
      },
    });
  }

  return updated;
}

export async function createTaskFromProofRequest(requestId: string) {
  const request = await prisma.proofRequest.findUnique({
    where: { id: requestId },
    include: {
      candidate: true,
      operatorTask: true,
    },
  });

  if (!request) {
    throw new Error("Proof request not found.");
  }

  if (request.operatorTask) {
    return request.operatorTask;
  }

  return prisma.operatorTask.create({
    data: {
      organizationId: request.candidate.organizationId,
      candidateId: request.candidateId,
      sourceProofRequestId: request.id,
      ownerUserId: request.assignedUserId,
      title: `${request.candidate.fullName} · ${request.title}`,
      detail: request.detail,
      priority: getPriority(request.requestType),
      dueAt: request.dueAt,
      sourceLabel: "Created from proof request",
    },
  });
}

export async function resolveProofRequest(input: {
  requestId: string;
  resolvedById: string;
  resolutionNote: string;
  status?: Extract<ProofRequestStatus, "RESOLVED" | "CANCELED">;
}) {
  const request = await prisma.proofRequest.findUnique({
    where: { id: input.requestId },
    include: {
      operatorTask: true,
    },
  });

  if (!request) {
    throw new Error("Proof request not found.");
  }

  const status = input.status ?? ProofRequestStatus.RESOLVED;
  const updated = await prisma.proofRequest.update({
    where: { id: input.requestId },
    data: {
      resolvedById: input.resolvedById,
      resolutionNote: input.resolutionNote.trim(),
      resolvedAt: new Date(),
      status,
    },
    include: {
      requestedBy: true,
      assignedUser: true,
      resolvedBy: true,
      operatorTask: true,
    },
  });

  if (request.operatorTask) {
    await prisma.operatorTask.update({
      where: { id: request.operatorTask.id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  await captureCandidateProgressSnapshot({
    candidateId: updated.candidateId,
    label: "Proof request resolved",
    summary: `${updated.title}. ${updated.resolutionNote ?? "Resolved."}`,
  });

  return updated;
}
