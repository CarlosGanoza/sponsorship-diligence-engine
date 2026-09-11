import { MembershipRole, SponsorPipelineStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getOutreachContext } from "@/lib/outreach/context";
import { requiresOutboundApprovalForStage } from "@/lib/outreach/approvals";
import { updatePipelineItem } from "@/lib/workflow/pipeline";

const pipelineUpdateSchema = z.object({
  stage: z.nativeEnum(SponsorPipelineStage),
  ownerUserId: z.string().optional(),
  nextDueAt: z.string().optional(),
  nextStep: z.string().max(200).optional(),
  outcomeNote: z.string().max(400).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { itemId } = await params;
  const parsed = pipelineUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Pipeline details are invalid." }, { status: 400 });
  }

  const item = await prisma.sponsorPipelineItem.findFirst({
    where: {
      id: itemId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
      sponsorId: true,
      stage: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Pipeline item not found." }, { status: 404 });
  }

  if (parsed.data.ownerUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.ownerUserId,
      },
      select: {
        userId: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Selected owner is not part of this workspace." }, { status: 400 });
    }
  }

  if (
    requiresOutboundApprovalForStage(parsed.data.stage) &&
    (parsed.data.stage !== item.stage || !requiresOutboundApprovalForStage(item.stage))
  ) {
    const context = await getOutreachContext(item.candidateId, item.sponsorId);

    if (!context || context.outreachRelease.blocked) {
      return NextResponse.json(
        {
          error: `Sponsor-facing stage movement is still blocked. ${context?.outreachRelease.blockers[0] ?? "Request outreach release approval and clear the sponsor-path blockers first."}`,
        },
        { status: 400 },
      );
    }
  }

  await updatePipelineItem({
    itemId,
    stage: parsed.data.stage,
    ownerUserId: parsed.data.ownerUserId?.trim() || null,
    nextDueAt: parsed.data.nextDueAt ? new Date(`${parsed.data.nextDueAt}T23:59:00`) : null,
    nextStep: parsed.data.nextStep?.trim() || null,
    outcomeNote: parsed.data.outcomeNote?.trim() || null,
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath(`/candidates/${item.candidateId}`);
  revalidatePath(`/sponsors/${item.sponsorId}`);

  return NextResponse.json({ success: true });
}
