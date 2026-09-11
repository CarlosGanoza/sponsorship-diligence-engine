import { CandidateUpdateAccessLinkStatus, MembershipRole, ProofRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildCandidateUpdateAccessPath } from "@/lib/candidate-updates/access-links";

const candidateUpdateAccessLinkSchema = z.object({
  daysValid: z.coerce.number().int().min(1).max(30).default(7),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const parsed = candidateUpdateAccessLinkSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Secure intake link settings are invalid." }, { status: 400 });
  }

  const { requestId } = await params;
  const proofRequest = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
      status: true,
    },
  });

  if (!proofRequest) {
    return NextResponse.json({ error: "Proof request not found." }, { status: 404 });
  }

  if (proofRequest.status === ProofRequestStatus.RESOLVED || proofRequest.status === ProofRequestStatus.CANCELED) {
    return NextResponse.json({ error: "Closed proof requests cannot accept secure candidate updates." }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.daysValid);
  const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 48);

  const link = await prisma.candidateUpdateAccessLink.upsert({
    where: {
      proofRequestId: proofRequest.id,
    },
    update: {
      token,
      status: CandidateUpdateAccessLinkStatus.ACTIVE,
      expiresAt,
      createdById: session.userId,
    },
    create: {
      candidateId: proofRequest.candidateId,
      proofRequestId: proofRequest.id,
      createdById: session.userId,
      token,
      status: CandidateUpdateAccessLinkStatus.ACTIVE,
      expiresAt,
    },
  });

  revalidatePath(`/candidates/${proofRequest.candidateId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  return NextResponse.json({
    success: true,
    link: {
      id: link.id,
      token: link.token,
      status: link.status,
      expiresAtLabel: link.expiresAt.toLocaleDateString(),
      lastUsedAtLabel: link.lastUsedAt ? link.lastUsedAt.toLocaleDateString() : null,
      path: buildCandidateUpdateAccessPath(link.token),
    },
  });
}
