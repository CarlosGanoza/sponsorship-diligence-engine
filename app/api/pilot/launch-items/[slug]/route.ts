import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireActionSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getPilotTemplate } from "@/lib/pilot/templates";
import { buildPilotLaunchWorkstream, pilotLaunchItemMutationSchema } from "@/lib/pilot/workspace";
import { persistPilotLaunchItemState } from "@/lib/settings/pilot";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireActionSession(MembershipRole.ADMIN);
    const { slug } = await params;
    const parsed = pilotLaunchItemMutationSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Launch workstream update is invalid." }, { status: 400 });
    }

    const pilotTemplateKey =
      (await prisma.appSetting.findUnique({
        where: { key: "PILOT_TEMPLATE" },
        select: { value: true },
      }))?.value ?? "FOUNDATION";
    const launchState = (await prisma.appSetting.findUnique({
      where: { key: "PILOT_LAUNCH_WORKSTREAM" },
      select: { value: true },
    }))?.value;
    const template = getPilotTemplate(pilotTemplateKey);
    const validSlugs = new Set(buildPilotLaunchWorkstream(template, launchState).items.map((item) => item.slug));

    if (!validSlugs.has(slug)) {
      return NextResponse.json({ success: false, error: "Launch workstream item was not found." }, { status: 404 });
    }

    await persistPilotLaunchItemState({
      template: template.key,
      slug,
      update: parsed.data,
    });

    revalidatePath("/settings");
    revalidatePath("/onboarding");
    revalidatePath("/pilot");
    revalidatePath("/pilot/pack");
    revalidatePath("/commercial");
    revalidatePath("/roi");
    revalidatePath("/demo");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not update the launch workstream.",
      },
      { status: 500 },
    );
  }
}
