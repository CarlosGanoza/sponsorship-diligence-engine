import { DecisionType, MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const candidateDecisionSchema = z.object({
  decisionType: z.nativeEnum(DecisionType),
  summary: z.string().min(4).max(120),
  rationale: z.string().min(12).max(600),
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
  const parsed = candidateDecisionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Decision details are incomplete." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId: session.organizationId,
    },
    select: {
      id: true,
      currentStage: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found in this workspace." }, { status: 404 });
  }

  const decision = await prisma.candidateDecision.create({
    data: {
      candidateId,
      decidedById: session.userId,
      decisionType: parsed.data.decisionType,
      summary: parsed.data.summary.trim(),
      rationale: parsed.data.rationale.trim(),
      stageAtDecision: candidate.currentStage,
    },
    select: {
      id: true,
      summary: true,
    },
  });

  await evaluateCandidateAutomation(candidateId);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/dashboard");
  revalidatePath("/audits");
  revalidatePath("/analytics");

  return NextResponse.json({ success: true, decision });
}
