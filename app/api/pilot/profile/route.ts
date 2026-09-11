import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireActionSession } from "@/lib/auth/session";
import { pilotProfileSchema } from "@/lib/pilot/workspace";
import { persistPilotProfile } from "@/lib/settings/pilot";

export async function POST(request: Request) {
  try {
    await requireActionSession(MembershipRole.ADMIN);
    const parsed = pilotProfileSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Pilot profile details are incomplete." }, { status: 400 });
    }

    await persistPilotProfile(parsed.data);

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
        error: error instanceof Error ? error.message : "Could not save the pilot profile.",
      },
      { status: 500 },
    );
  }
}
