import { AuditLogTargetType, MembershipRole, ProofRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { captureCandidateProgressSnapshot } from "@/lib/progress";

const reminderSchema = z.object({
  note: z.string().max(240).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { requestId } = await params;
  const parsed = reminderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Reminder details are invalid." }, { status: 400 });
  }

  const proofRequest = await prisma.proofRequest.findFirst({
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

  if (!proofRequest) {
    return NextResponse.json({ error: "Proof request not found." }, { status: 404 });
  }

  if (proofRequest.status === ProofRequestStatus.RESOLVED || proofRequest.status === ProofRequestStatus.CANCELED) {
    return NextResponse.json({ error: "Closed proof requests cannot receive reminders." }, { status: 409 });
  }

  const reminderNote =
    parsed.data.note?.trim() ||
    (proofRequest.dueAt
      ? `Reminder sent to gather the requested proof before ${proofRequest.dueAt.toLocaleDateString()}.`
      : "Reminder sent to gather the requested proof for the active underwriting review.");

  await prisma.proofRequest.update({
    where: { id: proofRequest.id },
    data: {
      reminderCount: {
        increment: 1,
      },
      lastReminderAt: new Date(),
      lastReminderNote: reminderNote,
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId: proofRequest.candidateId,
    label: "Proof request reminder sent",
    summary: `${proofRequest.title}. ${reminderNote}`,
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    candidateId: proofRequest.candidateId,
    targetType: AuditLogTargetType.CANDIDATE,
    action: "proof_request.reminder_sent",
    title: "Proof request reminder sent",
    detail: `${proofRequest.candidate.fullName} · ${proofRequest.title}. ${reminderNote}`,
  });

  revalidatePath(`/candidates/${proofRequest.candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/candidates");

  return NextResponse.json({ success: true, reminderNote });
}
