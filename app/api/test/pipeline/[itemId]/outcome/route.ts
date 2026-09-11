import { SponsorOutcomeType, SponsorOutcomeVerdict } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { recordSponsorOutcome } from "@/lib/outcomes";
import { evaluateCandidateAutomation } from "@/lib/automation";
import { captureCandidateProgressSnapshot } from "@/lib/progress";

const sponsorOutcomeSchema = z.object({
  outcomeType: z.nativeEnum(SponsorOutcomeType),
  verdict: z.nativeEnum(SponsorOutcomeVerdict),
  title: z.string().trim().min(3),
  detail: z.string().trim().min(10),
  occurredAt: z.string().trim().min(8),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  if (process.env.PLAYWRIGHT !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { itemId } = await params;
  const parsed = sponsorOutcomeSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Outcome details are invalid." }, { status: 400 });
  }

  const item = await prisma.sponsorPipelineItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      candidateId: true,
      sponsorId: true,
      candidate: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Pipeline item not found." }, { status: 404 });
  }

  const occurredAt = new Date(`${parsed.data.occurredAt}T12:00:00`);

  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Outcome date is invalid." }, { status: 400 });
  }

  await recordSponsorOutcome({
    organizationId: item.candidate.organizationId,
    candidateId: item.candidateId,
    sponsorId: item.sponsorId,
    pipelineItemId: item.id,
    recordedById: null,
    verdict: parsed.data.verdict,
    outcomeType: parsed.data.outcomeType,
    title: parsed.data.title,
    detail: parsed.data.detail,
    occurredAt,
  });

  await captureCandidateProgressSnapshot({
    candidateId: item.candidateId,
    label: parsed.data.verdict === SponsorOutcomeVerdict.POSITIVE ? "Positive sponsor outcome recorded" : "Sponsor outcome recorded",
    summary: parsed.data.detail,
  });
  await evaluateCandidateAutomation(item.candidateId);

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/pilot");
  revalidatePath("/roi");
  revalidatePath(`/candidates/${item.candidateId}`);
  revalidatePath(`/sponsors/${item.sponsorId}`);

  return NextResponse.json({ ok: true });
}
