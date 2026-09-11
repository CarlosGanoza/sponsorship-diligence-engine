import { MembershipRole, ReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const reviewSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  note: z.string().max(280).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Review state is invalid." }, { status: 400 });
  }

  const { claimId } = await params;
  const claim = await prisma.evidenceClaim.findFirst({
    where: {
      id: claimId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
    },
  });

  if (!claim) {
    return NextResponse.json({ error: "Evidence claim not found." }, { status: 404 });
  }

  await prisma.evidenceClaim.update({
    where: { id: claim.id },
    data: {
      reviewStatus: parsed.data.status,
      reviewNote: parsed.data.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  await evaluateCandidateAutomation(claim.candidateId);

  revalidatePath(`/candidates/${claim.candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");

  return NextResponse.json({ success: true });
}
