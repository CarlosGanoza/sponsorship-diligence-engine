import { MembershipRole, ProofRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveProofRequest } from "@/lib/proof-requests";

const resolutionSchema = z.object({
  resolutionNote: z.string().min(12).max(600),
  status: z.enum([ProofRequestStatus.RESOLVED, ProofRequestStatus.CANCELED]),
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

  const { requestId } = await params;
  const parsed = resolutionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Proof request resolution details are invalid." }, { status: 400 });
  }

  const proofRequest = await prisma.proofRequest.findFirst({
    where: {
      id: requestId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      candidateId: true,
    },
  });

  if (!proofRequest) {
    return NextResponse.json({ error: "Proof request not found." }, { status: 404 });
  }

  try {
    await resolveProofRequest({
      requestId,
      resolvedById: session.userId,
      resolutionNote: parsed.data.resolutionNote,
      status: parsed.data.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve proof request." },
      { status: 409 },
    );
  }

  await evaluateCandidateAutomation(proofRequest.candidateId);

  revalidatePath(`/candidates/${proofRequest.candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/candidates");
  revalidatePath("/audits");

  return NextResponse.json({ success: true });
}
