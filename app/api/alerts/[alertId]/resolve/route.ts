import { MembershipRole, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { resolveOperatorAlert } from "@/lib/automation";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { alertId } = await params;
  const workspaceAlert = await prisma.operatorAlert.findFirst({
    where: {
      id: alertId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
  });

  if (!workspaceAlert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }

  const alert = await resolveOperatorAlert(alertId, {
    resolvedById: session.userId,
  });

  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
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

  return NextResponse.json({ success: true });
}
