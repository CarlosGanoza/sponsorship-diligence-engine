import { AuditLogTargetType, MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit/log";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { getPilotProofReportData } from "@/lib/db/queries";
import { buildPilotProofReportMarkdown } from "@/lib/pilot/report";

export async function GET(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN)) {
    return NextResponse.json({ error: "Admin workspace access required." }, { status: 403 });
  }

  const data = await getPilotProofReportData();
  const format = new URL(request.url).searchParams.get("format") === "md" ? "md" : "json";

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    targetType: AuditLogTargetType.EXPORT,
    action: `export.pilot.report.${format}`,
    title: "Pilot proof report export",
    detail: `Measured pilot proof report ${format === "md" ? "markdown" : "JSON"} export generated.`,
    payload: {
      reportTitle: data.report.title,
      stageLabel: data.report.stageLabel,
      generatedAtLabel: data.report.generatedAtLabel,
      format,
    },
  });

  if (format === "md") {
    return new NextResponse(buildPilotProofReportMarkdown(data.report), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="pilot-proof-report.md"',
      },
    });
  }

  return NextResponse.json({
    workspace: {
      organizationName: session.organization.name,
      pilotName: data.pilotProfile.pilotName,
      designPartnerName: data.pilotProfile.designPartnerName,
      programName: data.pilotProfile.programName,
    },
    template: data.template,
    report: data.report,
    commercialReadiness: data.commercialReadiness,
    health: data.health,
  });
}
