import { MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { sponsorAvailabilityInputSchema, updateSponsorAvailabilityForOrganization } from "@/lib/sponsor/availability";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sponsorId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ success: false, error: "Member workspace access required." }, { status: 403 });
  }

  const { sponsorId } = await params;
  const parsed = sponsorAvailabilityInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Sponsor availability details are invalid." }, { status: 400 });
  }

  try {
    const sponsor = await updateSponsorAvailabilityForOrganization({
      sponsorId,
      organizationId: session.organizationId,
      actorUserId: session.user.id,
      data: parsed.data,
    });

    revalidatePath("/sponsors");
    revalidatePath(`/sponsors/${sponsorId}`);
    revalidatePath("/candidates");
    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      sponsor: {
        availabilityStatus: sponsor.availabilityStatus,
        maxConcurrentPaths: sponsor.maxConcurrentPaths,
        warmIntroAvailable: sponsor.warmIntroAvailable,
        availabilityNote: sponsor.availabilityNote,
        blackoutUntil: sponsor.blackoutUntil ? sponsor.blackoutUntil.toISOString().slice(0, 10) : null,
        blackoutReason: sponsor.blackoutReason,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not update sponsor availability.",
      },
      { status: 400 },
    );
  }
}
