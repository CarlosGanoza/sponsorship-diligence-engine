import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { isPilotTemplateKey } from "@/lib/pilot/templates";
import { persistPilotTemplate } from "@/lib/settings/pilot";

export async function POST(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const formData = await request.formData();
  const template = String(formData.get("template") ?? "");

  if (!isPilotTemplateKey(template)) {
    return NextResponse.redirect(new URL("/settings?pilotTemplateError=1", request.url));
  }

  await persistPilotTemplate(template);

  revalidatePath("/settings");
  revalidatePath("/pilot");
  revalidatePath("/roi");

  return NextResponse.redirect(new URL("/settings?pilotTemplateUpdated=1", request.url));
}
