import { NextResponse } from "next/server";
import { AuditLogTargetType, MembershipRole } from "@prisma/client";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit/log";
import { getOutreachContext } from "@/lib/outreach/context";
import { buildCrmHandoffRecord, serializeCrmHandoffCsv } from "@/lib/outreach/handoff";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { candidateId } = await params;
  const { searchParams } = new URL(request.url);
  const sponsorId = searchParams.get("sponsor") ?? undefined;
  const format = searchParams.get("format") ?? "json";
  const context = await getOutreachContext(candidateId, sponsorId);

  if (!context || !context.selectedBrief || !context.selectedMatch || !context.outreachPlan || !context.variant) {
    return NextResponse.json({ error: "Outreach context is not ready." }, { status: 404 });
  }

  if (context.crmHandoffRelease.blocked) {
    return NextResponse.json(
      { error: context.crmHandoffRelease.blockers[0] ?? "CRM handoff is still blocked." },
      { status: 409 },
    );
  }

  const record = buildCrmHandoffRecord({
    brief: context.selectedBrief,
    candidate: context.data.candidate,
    sponsor: context.selectedMatch.sponsor,
    connectionPath: context.selectedMatch.connectionPath,
    nextStep: context.outreachPlan.meetingGoal,
    outreachMode: context.outreachPlan.mode,
    risks: context.variant.risks,
    sponsorMatchScore: context.selectedMatch.result.score,
    sponsorReadinessScore: context.data.readiness.score,
    subjectLine: context.outreachPlan.subjectLine,
  });

  if (format === "csv") {
    await recordAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.user.id,
      candidateId,
      sponsorId: context.selectedMatch.sponsor.id,
      targetType: AuditLogTargetType.EXPORT,
      action: "export.crm_handoff.csv",
      title: "CRM handoff export",
      detail: "CRM handoff CSV export generated.",
      payload: {
        format: "csv",
        sponsorId: context.selectedMatch.sponsor.id,
      },
    });
    return new NextResponse(serializeCrmHandoffCsv(record), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"crm-handoff-${candidateId}.csv\"`,
      },
    });
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    candidateId,
    sponsorId: context.selectedMatch.sponsor.id,
    targetType: AuditLogTargetType.EXPORT,
    action: "export.crm_handoff.json",
    title: "CRM handoff export",
    detail: "CRM handoff JSON export generated.",
    payload: {
      format: "json",
      sponsorId: context.selectedMatch.sponsor.id,
    },
  });
  return NextResponse.json(record, {
    headers: {
      "Content-Disposition": `attachment; filename=\"crm-handoff-${candidateId}.json\"`,
    },
  });
}
