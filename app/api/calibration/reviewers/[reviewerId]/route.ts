import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireActionSession } from "@/lib/auth/session";
import { reviewerCalibrationItemMutationSchema } from "@/lib/calibration/workspace";
import { persistReviewerCalibrationItemState } from "@/lib/settings/calibration";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reviewerId: string }> },
) {
  try {
    await requireActionSession(MembershipRole.ADMIN);
    const { reviewerId } = await params;
    const parsed = reviewerCalibrationItemMutationSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Reviewer calibration update is invalid." }, { status: 400 });
    }

    if (!reviewerId.trim()) {
      return NextResponse.json({ success: false, error: "Reviewer calibration item was not found." }, { status: 404 });
    }

    await persistReviewerCalibrationItemState({
      reviewerId,
      update: parsed.data,
    });

    revalidatePath("/calibration");
    revalidatePath("/analytics");
    revalidatePath("/onboarding");
    revalidatePath("/pilot");
    revalidatePath("/pilot/pack");
    revalidatePath("/commercial");
    revalidatePath("/demo");
    revalidatePath("/settings");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not update the reviewer calibration workspace.",
      },
      { status: 500 },
    );
  }
}
