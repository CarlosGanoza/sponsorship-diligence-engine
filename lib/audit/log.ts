import { AuditLogTargetType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type AuditPayload = {
  organizationId: string;
  candidateId?: string | null;
  sponsorId?: string | null;
  actorUserId?: string | null;
  targetType: AuditLogTargetType;
  action: string;
  title: string;
  detail: string;
  payload?: unknown;
};

function serializePayload(payload: unknown) {
  if (payload === undefined) {
    return null;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ error: "Could not serialize audit payload." });
  }
}

export async function recordAuditLog(input: AuditPayload) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        candidateId: input.candidateId ?? null,
        sponsorId: input.sponsorId ?? null,
        actorUserId: input.actorUserId ?? null,
        targetType: input.targetType,
        action: input.action,
        title: input.title.trim().slice(0, 120),
        detail: input.detail.trim().slice(0, 800),
        payloadJson: serializePayload(input.payload),
      },
    });
  } catch {
    // Audit logging should not block runtime workflow.
  }
}
