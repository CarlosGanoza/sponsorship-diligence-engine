import { BackgroundJobType, MembershipRole, NotificationChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { sendOperatorAlertDigest } from "@/lib/alerts/digest";
import { enqueueBackgroundJob, resolveBackgroundJobsMode } from "@/lib/jobs/queue";

export async function POST(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    target?: NotificationChannel | "all";
  } | null;
  const target =
    payload?.target === "all" ||
    payload?.target === NotificationChannel.EMAIL_DIGEST ||
    payload?.target === NotificationChannel.SLACK_DIGEST ||
    payload?.target === NotificationChannel.OPS_QUEUE
      ? payload.target
      : "all";

  if ((await resolveBackgroundJobsMode()) === "queue") {
    const job = await enqueueBackgroundJob({
      organizationId: session.organizationId,
      requestedById: session.userId,
      jobType: BackgroundJobType.SEND_ALERT_DIGEST,
      title: "Deliver operator alert digest",
      payload: { target },
      dedupeKey: `alert-digest:${target}`,
    });

    revalidatePath("/settings");
    revalidatePath("/alerts");

    return NextResponse.json({ success: true, queued: true, jobId: job.id, summary: "Digest queued for worker delivery." });
  }

  const result = await sendOperatorAlertDigest(target);

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return NextResponse.json({ success: true, summary: result.summary });
}
