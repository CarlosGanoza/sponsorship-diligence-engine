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
  { params }: { params: Promise<{ recommendationId: string }> },
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

  const { recommendationId } = await params;
  const recommendation = await prisma.recommendation.findFirst({
    where: {
      id: recommendationId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
      sponsorId: true,
    },
  });

  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  }

  await prisma.recommendation.update({
    where: { id: recommendation.id },
    data: {
      reviewStatus: parsed.data.status,
      reviewNote: parsed.data.note?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  await evaluateCandidateAutomation(recommendation.candidateId);

  revalidatePath(`/candidates/${recommendation.candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath("/sponsors");

  if (recommendation.sponsorId) {
    revalidatePath(`/sponsors/${recommendation.sponsorId}`);
  }

  return NextResponse.json({ success: true });
}
