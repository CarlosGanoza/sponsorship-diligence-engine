import { MembershipRole, ProofRequestType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createProofRequest } from "@/lib/proof-requests";

const proofRequestSchema = z.object({
  requestType: z.nativeEnum(ProofRequestType),
  title: z.string().min(4).max(120),
  detail: z.string().min(12).max(600),
  assignedUserId: z.string().optional(),
  dueAt: z.string().optional(),
  sourceDisagreementReviewId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { candidateId } = await params;
  const parsed = proofRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Proof request details are incomplete." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId: session.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found in this workspace." }, { status: 404 });
  }

  if (parsed.data.assignedUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: session.organizationId,
        userId: parsed.data.assignedUserId,
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Selected assignee is not part of this workspace." }, { status: 400 });
    }
  }

  if (parsed.data.sourceDisagreementReviewId) {
    const review = await prisma.disagreementReview.findFirst({
      where: {
        id: parsed.data.sourceDisagreementReviewId,
        candidateId,
        candidate: {
          organizationId: session.organizationId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Linked disagreement review was not found in this workspace." }, { status: 404 });
    }
  }

  try {
    const created = await createProofRequest({
      candidateId,
      requestedById: session.userId,
      assignedUserId: parsed.data.assignedUserId?.trim() || null,
      dueAt: parsed.data.dueAt ? new Date(`${parsed.data.dueAt}T23:59:00`) : null,
      requestType: parsed.data.requestType,
      title: parsed.data.title.trim(),
      detail: parsed.data.detail.trim(),
      sourceDisagreementReviewId: parsed.data.sourceDisagreementReviewId?.trim() || null,
    });

    await evaluateCandidateAutomation(candidateId);

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    revalidatePath("/candidates");
    revalidatePath("/audits");

    return NextResponse.json({ success: true, requestId: created.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create proof request." },
      { status: 409 },
    );
  }
}
