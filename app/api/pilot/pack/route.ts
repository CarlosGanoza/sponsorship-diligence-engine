import { AuditLogTargetType, MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit/log";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { getPilotPackData } from "@/lib/db/queries";
import { buildPilotBuyerPackMarkdown } from "@/lib/pilot/pack";

export async function GET(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const data = await getPilotPackData();
  const format = new URL(request.url).searchParams.get("format") === "md" ? "md" : "json";

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    targetType: AuditLogTargetType.EXPORT,
    action: `export.pilot.pack.${format}`,
    title: "Pilot buyer pack export",
    detail: `Pilot buyer pack ${format === "md" ? "markdown" : "JSON"} export generated.`,
    payload: {
      title: data.buyerPack.title,
      recommendationLabel: data.buyerPack.recommendationLabel,
      designPartnerName: data.pilotProfile.designPartnerName,
      format,
    },
  });

  if (format === "md") {
    return new NextResponse(buildPilotBuyerPackMarkdown(data.buyerPack), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="pilot-buyer-pack.md"',
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
    pilotProfile: data.pilotProfile,
    buyerPack: data.buyerPack,
    proofReport: data.report,
    commercialReadiness: data.commercialReadiness,
    health: data.health,
  });
}
