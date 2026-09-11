import { BackgroundJobType, MemoStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  extractCandidateEvidence,
  generateCandidateMemo,
  generateCandidateRecommendations,
} from "@/lib/ai/pipeline";
import { evaluateCandidateAutomation } from "@/lib/automation";
import { requireActionSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { enqueueBackgroundJob, resolveBackgroundJobsMode } from "@/lib/jobs/queue";
import { generateCandidateOpportunityBriefs } from "@/lib/opportunities/pipeline";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { syncCandidateSponsorPipeline } from "@/lib/workflow/pipeline";

const candidateActionSchema = z.object({
  action: z.enum(["extract", "memo", "match", "brief"]),
});

async function requireCandidateAccess(candidateId: string, organizationId: string) {
  return prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId,
    },
    select: { id: true },
  });
}

function buildMemoProcessingState(candidateId: string) {
  return {
    where: { candidateId },
    update: {
      status: MemoStatus.PROCESSING,
    },
    create: {
      candidateId,
      summary: "Memo generation in progress.",
      rationale: "The system is assembling a sponsor-ready memo from the current evidence set.",
      strengths: "",
      risks: "",
      recommendedAction: "Generating recommendation.",
      memoMarkdown: "# Processing",
      status: MemoStatus.PROCESSING,
    },
  } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const session = await requireActionSession();
    const { candidateId } = await params;
    const parsed = candidateActionSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Candidate action is invalid." }, { status: 400 });
    }

    const candidate = await requireCandidateAccess(candidateId, session.organizationId);

    if (!candidate) {
      return NextResponse.json({ success: false, error: "Candidate not found in this workspace." }, { status: 404 });
    }

    const backgroundJobsMode = await resolveBackgroundJobsMode();

    if (parsed.data.action === "extract") {
      if (backgroundJobsMode === "queue") {
        const job = await enqueueBackgroundJob({
          organizationId: session.organizationId,
          candidateId,
          requestedById: session.user.id,
          jobType: BackgroundJobType.EXTRACT_EVIDENCE,
          title: "Extract evidence claims",
          payload: { candidateId },
          dedupeKey: `extract-evidence:${candidateId}`,
        });

        revalidatePath(`/candidates/${candidateId}`);
        revalidatePath("/dashboard");
        revalidatePath("/settings");

        return NextResponse.json({ success: true, queued: true, jobId: job.id, targetTab: "evidence" });
      }

      await extractCandidateEvidence(candidateId);
      await captureCandidateProgressSnapshot({
        candidateId,
        label: "Evidence extracted",
        summary: "Structured evidence claims were refreshed from the latest artifact set.",
      });
      await evaluateCandidateAutomation(candidateId);
      revalidatePath(`/candidates/${candidateId}`);
      revalidatePath("/dashboard");
      revalidatePath("/candidates");
      revalidatePath("/alerts");

      return NextResponse.json({ success: true, targetTab: "evidence" });
    }

    if (parsed.data.action === "memo") {
      if (backgroundJobsMode === "queue") {
        await prisma.sponsorMemo.upsert(buildMemoProcessingState(candidateId));

        const job = await enqueueBackgroundJob({
          organizationId: session.organizationId,
          candidateId,
          requestedById: session.user.id,
          jobType: BackgroundJobType.GENERATE_MEMO,
          title: "Generate sponsor memo",
          payload: { candidateId },
          dedupeKey: `generate-memo:${candidateId}`,
        });

        revalidatePath(`/candidates/${candidateId}`);
        revalidatePath(`/memos/${candidateId}`);
        revalidatePath("/dashboard");
        revalidatePath("/settings");

        return NextResponse.json({ success: true, queued: true, jobId: job.id, targetTab: "memo" });
      }

      try {
        await prisma.sponsorMemo.upsert(buildMemoProcessingState(candidateId));
        await generateCandidateMemo(candidateId);
        await captureCandidateProgressSnapshot({
          candidateId,
          label: "Sponsor memo refreshed",
          summary: "The memo and cited rationale were updated from the current evidence base.",
        });
        await evaluateCandidateAutomation(candidateId);
        revalidatePath(`/candidates/${candidateId}`);
        revalidatePath(`/memos/${candidateId}`);
        revalidatePath("/dashboard");
        revalidatePath("/alerts");

        return NextResponse.json({ success: true, targetTab: "memo" });
      } catch (error) {
        await prisma.sponsorMemo.updateMany({
          where: { candidateId },
          data: {
            status: MemoStatus.NEEDS_REVIEW,
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Memo generation failed.",
          },
          { status: 500 },
        );
      }
    }

    if (parsed.data.action === "match") {
      if (backgroundJobsMode === "queue") {
        const job = await enqueueBackgroundJob({
          organizationId: session.organizationId,
          candidateId,
          requestedById: session.user.id,
          jobType: BackgroundJobType.GENERATE_RECOMMENDATIONS,
          title: "Generate recommendations",
          payload: { candidateId },
          dedupeKey: `generate-recommendations:${candidateId}`,
        });

        revalidatePath(`/candidates/${candidateId}`);
        revalidatePath("/dashboard");
        revalidatePath("/pipeline");
        revalidatePath("/settings");

        return NextResponse.json({ success: true, queued: true, jobId: job.id, targetTab: "actions" });
      }

      await generateCandidateRecommendations(candidateId);
      await syncCandidateSponsorPipeline(candidateId);
      await captureCandidateProgressSnapshot({
        candidateId,
        label: "Recommendations refreshed",
        summary: "Sponsor targets, next advocacy actions, and warm paths were recomputed.",
      });
      await evaluateCandidateAutomation(candidateId);
      revalidatePath(`/candidates/${candidateId}`);
      revalidatePath("/dashboard");
      revalidatePath("/sponsors");
      revalidatePath("/alerts");
      revalidatePath("/pipeline");

      return NextResponse.json({ success: true, targetTab: "actions" });
    }

    if (backgroundJobsMode === "queue") {
      const job = await enqueueBackgroundJob({
        organizationId: session.organizationId,
        candidateId,
        requestedById: session.user.id,
        jobType: BackgroundJobType.GENERATE_BRIEFS,
        title: "Generate opportunity briefs",
        payload: { candidateId },
        dedupeKey: `generate-briefs:${candidateId}`,
      });

      revalidatePath(`/candidates/${candidateId}`);
      revalidatePath(`/briefs/${candidateId}`);
      revalidatePath("/briefs");
      revalidatePath("/dashboard");
      revalidatePath("/settings");

      return NextResponse.json({ success: true, queued: true, jobId: job.id, targetTab: "briefs" });
    }

    await generateCandidateOpportunityBriefs(candidateId);
    await syncCandidateSponsorPipeline(candidateId);
    await captureCandidateProgressSnapshot({
      candidateId,
      label: "Opportunity briefs prepared",
      summary: "Sponsor-specific asks were packaged into internal opportunity briefs.",
    });
    await evaluateCandidateAutomation(candidateId);
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/briefs/${candidateId}`);
    revalidatePath("/dashboard");
    revalidatePath("/briefs");
    revalidatePath("/sponsors");
    revalidatePath("/alerts");
    revalidatePath("/pipeline");

    return NextResponse.json({ success: true, targetTab: "briefs" });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Candidate action failed.",
      },
      { status: 500 },
    );
  }
}
