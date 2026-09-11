import { AuditLogTargetType, CandidateStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditLog } from "@/lib/audit/log";
import { applyManualStageOverride, resumeCandidateAutomation } from "@/lib/automation";
import { requireActionSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const automationActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("override"),
    stage: z.nativeEnum(CandidateStage),
    rationale: z.string().min(12).max(400),
    actorLabel: z.string().max(80).optional(),
  }),
  z.object({
    action: z.literal("resume"),
    rationale: z.string().min(12).max(400),
    actorLabel: z.string().max(80).optional(),
  }),
]);

async function requireCandidateAccess(candidateId: string, organizationId: string) {
  return prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId,
    },
    select: { id: true },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const session = await requireActionSession();
    const { candidateId } = await params;
    const parsed = automationActionSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Automation action is invalid." }, { status: 400 });
    }

    const candidate = await requireCandidateAccess(candidateId, session.organizationId);

    if (!candidate) {
      return NextResponse.json({ success: false, error: "Candidate not found in this workspace." }, { status: 404 });
    }

    if (parsed.data.action === "override") {
      const result = await applyManualStageOverride({
        candidateId,
        stage: parsed.data.stage,
        rationale: parsed.data.rationale,
        actorLabel: parsed.data.actorLabel,
      });

      if (!result) {
        return NextResponse.json({ success: false, error: "Candidate not found." }, { status: 404 });
      }

      await recordAuditLog({
        organizationId: session.organizationId,
        actorUserId: session.user.id,
        candidateId,
        targetType: AuditLogTargetType.STAGE,
        action: "candidate.manual_stage_override",
        title: `Manual stage override · ${parsed.data.stage.toLowerCase()}`,
        detail: parsed.data.rationale,
        payload: {
          toStage: parsed.data.stage,
          actorLabel: parsed.data.actorLabel ?? null,
        },
      });
    } else {
      const result = await resumeCandidateAutomation({
        candidateId,
        rationale: parsed.data.rationale,
        actorLabel: parsed.data.actorLabel,
      });

      if (!result) {
        return NextResponse.json({ success: false, error: "Candidate not found." }, { status: 404 });
      }

      await recordAuditLog({
        organizationId: session.organizationId,
        actorUserId: session.user.id,
        candidateId,
        targetType: AuditLogTargetType.STAGE,
        action: "candidate.automation_resumed",
        title: "Candidate automation resumed",
        detail: parsed.data.rationale,
        payload: {
          actorLabel: parsed.data.actorLabel ?? null,
        },
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/candidates");
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/alerts");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Automation action failed.",
      },
      { status: 500 },
    );
  }
}
