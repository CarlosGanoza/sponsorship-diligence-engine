import { MembershipRole, PilotMetricSnapshotType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { capturePilotMetricSnapshot } from "@/lib/pilot/measurements";

export async function POST(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    snapshotType?: string;
    averageReviewMinutes?: number | null;
    sampledReviewCount?: number | null;
  } | null;
  const snapshotType =
    payload?.snapshotType === "baseline" ? PilotMetricSnapshotType.BASELINE : payload?.snapshotType === "checkpoint" ? PilotMetricSnapshotType.CHECKPOINT : null;

  if (!snapshotType) {
    return NextResponse.json({ error: "Snapshot type is invalid." }, { status: 400 });
  }

  const averageReviewMinutes =
    typeof payload?.averageReviewMinutes === "number" && Number.isFinite(payload.averageReviewMinutes)
      ? Math.max(1, Math.min(480, Math.round(payload.averageReviewMinutes)))
      : null;
  const sampledReviewCount =
    typeof payload?.sampledReviewCount === "number" && Number.isFinite(payload.sampledReviewCount)
      ? Math.max(1, Math.min(200, Math.round(payload.sampledReviewCount)))
      : null;

  await capturePilotMetricSnapshot({
    organizationId: session.organizationId,
    capturedById: session.userId,
    snapshotType,
    averageReviewMinutes,
    sampledReviewCount,
  });

  revalidatePath("/roi");
  revalidatePath("/pilot");
  revalidatePath("/settings");

  return NextResponse.json({ success: true });
}
