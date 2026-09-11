import { z } from "zod";
import {
  BackgroundJobStatus,
  BackgroundJobType,
  CrmSyncMode,
  MemoStatus,
  NotificationChannel,
  SponsorActivityStatus,
  SponsorActivityType,
} from "@prisma/client";

import {
  extractCandidateEvidence,
  generateCandidateMemo,
  generateCandidateRecommendations,
} from "@/lib/ai/pipeline";
import { sendOperatorAlertDigest } from "@/lib/alerts/digest";
import { evaluateCandidateAutomation } from "@/lib/automation";
import { syncCrmHandoff } from "@/lib/crm/provider";
import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { generateCandidateOpportunityBriefs } from "@/lib/opportunities/pipeline";
import { getOutreachContext } from "@/lib/outreach/context";
import { buildCrmHandoffRecord } from "@/lib/outreach/handoff";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { markPipelineOutreachDrafted, syncCandidateSponsorPipeline } from "@/lib/workflow/pipeline";

const extractEvidencePayloadSchema = z.object({
  candidateId: z.string().min(1),
});

const generateMemoPayloadSchema = z.object({
  candidateId: z.string().min(1),
});

const generateRecommendationsPayloadSchema = z.object({
  candidateId: z.string().min(1),
});

const generateBriefsPayloadSchema = z.object({
  candidateId: z.string().min(1),
});

const sendDigestPayloadSchema = z.object({
  target: z.union([z.nativeEnum(NotificationChannel), z.literal("all")]).default("all"),
});

const syncCrmHandoffPayloadSchema = z.object({
  candidateId: z.string().min(1),
  sponsorId: z.string().min(1),
});

type BackgroundJobsMode = "inline" | "queue";

type BackgroundJobInput = {
  organizationId: string;
  candidateId?: string;
  requestedById?: string;
  jobType: BackgroundJobType;
  title: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  maxAttempts?: number;
};

const retryDelayMsByAttempt = [0, 5000, 15000, 30000];

async function persistBackgroundJobsRuntimeNote(note: string) {
  const payload = note.trim().slice(0, 280);

  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.appSetting.upsert({
      where: { key: "BACKGROUND_JOBS_RUNTIME_NOTE" },
      update: { value: payload },
      create: { key: "BACKGROUND_JOBS_RUNTIME_NOTE", value: payload },
    });
  } catch {
    // Runtime notes should never block the job runner.
  }
}

export async function resolveBackgroundJobsMode(): Promise<BackgroundJobsMode> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "BACKGROUND_JOBS_MODE" },
    });

    if (setting?.value === "queue" || setting?.value === "inline") {
      return setting.value as BackgroundJobsMode;
    }
  } catch {
    return env.backgroundJobsMode as BackgroundJobsMode;
  }

  return env.backgroundJobsMode as BackgroundJobsMode;
}

function parsePayload(payloadJson: string) {
  return JSON.parse(payloadJson) as unknown;
}

function buildCrmSourceLabel(providerMode: CrmSyncMode) {
  if (providerMode === CrmSyncMode.MOCK) {
    return "Local CRM outbox";
  }

  if (providerMode === CrmSyncMode.WEBHOOK) {
    return "CRM webhook sync";
  }

  return `${providerMode.toLowerCase()} CRM adapter`;
}

async function runCrmHandoffSyncJob(candidateId: string, sponsorId: string) {
  const context = await getOutreachContext(candidateId, sponsorId);

  if (!context || !context.selectedBrief || !context.selectedMatch || !context.outreachPlan || !context.variant) {
    throw new Error("Outreach context is not ready yet.");
  }

  if (context.crmHandoffRelease.blocked) {
    throw new Error(context.crmHandoffRelease.blockers[0] ?? "CRM handoff is still blocked.");
  }

  const record = buildCrmHandoffRecord({
    brief: context.selectedBrief,
    candidate: context.data.candidate,
    sponsor: context.selectedMatch.sponsor,
    connectionPath: context.selectedMatch.connectionPath,
    nextStep: context.outreachPlan.meetingGoal,
    outreachMode: context.outreachPlan.mode,
    risks: context.variant.risks,
    sponsorMatchScore: context.selectedMatch.result.score,
    sponsorReadinessScore: context.data.readiness.score,
    subjectLine: context.outreachPlan.subjectLine,
  });
  const result = await syncCrmHandoff(record);

  await prisma.crmSyncRecord.create({
    data: {
      candidateId,
      sponsorId,
      opportunityBriefId: context.selectedBrief.id,
      objectType: "opportunity_brief",
      providerMode: result.providerMode,
      status: result.status,
      externalRecordId: result.externalRecordId,
      payloadJson: JSON.stringify(record),
      syncNote: result.syncNote,
      syncedAt: new Date(),
    },
  });

  await prisma.sponsorActivity.create({
    data: {
      candidateId,
      sponsorId,
      opportunityBriefId: context.selectedBrief.id,
      activityType: SponsorActivityType.CRM_SYNCED,
      status:
        result.status === "FAILED" ? SponsorActivityStatus.BLOCKED : SponsorActivityStatus.COMPLETED,
      title: "CRM handoff synced",
      detail: result.syncNote,
      sourceLabel: buildCrmSourceLabel(result.providerMode),
      occurredAt: new Date(),
      completedAt: result.status === "FAILED" ? null : new Date(),
    },
  });

  await captureCandidateProgressSnapshot({
    candidateId,
    label: "CRM handoff synced",
    summary: `${buildCrmSourceLabel(result.providerMode)} recorded the sponsor-facing handoff for operator follow-through.`,
  });
  await markPipelineOutreachDrafted(candidateId, sponsorId);
  await evaluateCandidateAutomation(candidateId);

  return {
    providerMode: result.providerMode,
    status: result.status,
  };
}

async function executeBackgroundJob(job: {
  jobType: BackgroundJobType;
  payloadJson: string;
}) {
  const parsedPayload = parsePayload(job.payloadJson);

  switch (job.jobType) {
    case BackgroundJobType.EXTRACT_EVIDENCE: {
      const payload = extractEvidencePayloadSchema.parse(parsedPayload);
      await extractCandidateEvidence(payload.candidateId);
      await captureCandidateProgressSnapshot({
        candidateId: payload.candidateId,
        label: "Evidence extracted",
        summary: "Structured evidence claims were refreshed from the latest artifact set.",
      });
      await evaluateCandidateAutomation(payload.candidateId);
      return { candidateId: payload.candidateId };
    }
    case BackgroundJobType.GENERATE_MEMO: {
      const payload = generateMemoPayloadSchema.parse(parsedPayload);
      await prisma.sponsorMemo.upsert({
        where: { candidateId: payload.candidateId },
        update: {
          status: MemoStatus.PROCESSING,
        },
        create: {
          candidateId: payload.candidateId,
          summary: "Memo generation in progress.",
          rationale: "The system is assembling a sponsor-ready memo from the current evidence set.",
          strengths: "",
          risks: "",
          recommendedAction: "Generating recommendation.",
          memoMarkdown: "# Processing",
          status: MemoStatus.PROCESSING,
        },
      });
      await generateCandidateMemo(payload.candidateId);
      await captureCandidateProgressSnapshot({
        candidateId: payload.candidateId,
        label: "Sponsor memo refreshed",
        summary: "The memo and cited rationale were updated from the current evidence base.",
      });
      await evaluateCandidateAutomation(payload.candidateId);
      return { candidateId: payload.candidateId };
    }
    case BackgroundJobType.GENERATE_RECOMMENDATIONS: {
      const payload = generateRecommendationsPayloadSchema.parse(parsedPayload);
      await generateCandidateRecommendations(payload.candidateId);
      await syncCandidateSponsorPipeline(payload.candidateId);
      await captureCandidateProgressSnapshot({
        candidateId: payload.candidateId,
        label: "Recommendations refreshed",
        summary: "Sponsor targets, next advocacy actions, and warm paths were recomputed.",
      });
      await evaluateCandidateAutomation(payload.candidateId);
      return { candidateId: payload.candidateId };
    }
    case BackgroundJobType.GENERATE_BRIEFS: {
      const payload = generateBriefsPayloadSchema.parse(parsedPayload);
      await generateCandidateOpportunityBriefs(payload.candidateId);
      await syncCandidateSponsorPipeline(payload.candidateId);
      await captureCandidateProgressSnapshot({
        candidateId: payload.candidateId,
        label: "Opportunity briefs prepared",
        summary: "Sponsor-specific asks were packaged into internal opportunity briefs.",
      });
      await evaluateCandidateAutomation(payload.candidateId);
      return { candidateId: payload.candidateId };
    }
    case BackgroundJobType.SEND_ALERT_DIGEST: {
      const payload = sendDigestPayloadSchema.parse(parsedPayload);
      const result = await sendOperatorAlertDigest(payload.target);
      return { deliveryCount: result.deliveries.length, summary: result.summary };
    }
    case BackgroundJobType.SYNC_CRM_HANDOFF: {
      const payload = syncCrmHandoffPayloadSchema.parse(parsedPayload);
      return runCrmHandoffSyncJob(payload.candidateId, payload.sponsorId);
    }
    default:
      throw new Error("Unsupported background job.");
  }
}

export async function enqueueBackgroundJob(input: BackgroundJobInput) {
  if (input.dedupeKey) {
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        organizationId: input.organizationId,
        dedupeKey: input.dedupeKey,
        status: {
          in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.RUNNING, BackgroundJobStatus.RETRYABLE],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.backgroundJob.create({
    data: {
      organizationId: input.organizationId,
      candidateId: input.candidateId ?? null,
      requestedById: input.requestedById ?? null,
      jobType: input.jobType,
      title: input.title,
      payloadJson: JSON.stringify(input.payload),
      dedupeKey: input.dedupeKey ?? null,
      maxAttempts: input.maxAttempts ?? 3,
    },
  });
}

async function claimJob(jobId: string) {
  const now = new Date();
  const claimed = await prisma.backgroundJob.updateMany({
    where: {
      id: jobId,
      status: {
        in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.RETRYABLE],
      },
    },
    data: {
      status: BackgroundJobStatus.RUNNING,
      startedAt: now,
      finishedAt: null,
      errorMessage: null,
      attemptCount: {
        increment: 1,
      },
    },
  });

  return claimed.count > 0;
}

export async function runPendingBackgroundJobs(options?: {
  limit?: number;
}) {
  const limit = options?.limit ?? 5;
  const now = new Date();
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      status: {
        in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.RETRYABLE],
      },
      availableAt: {
        lte: now,
      },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retryable: 0,
  };

  for (const job of jobs) {
    const claimed = await claimJob(job.id);

    if (!claimed) {
      continue;
    }

    const freshJob = await prisma.backgroundJob.findUnique({
      where: { id: job.id },
      select: {
        id: true,
        jobType: true,
        payloadJson: true,
        attemptCount: true,
        maxAttempts: true,
      },
    });

    if (!freshJob) {
      continue;
    }

    summary.processed += 1;

    try {
      const result = await executeBackgroundJob(freshJob);

      await prisma.backgroundJob.update({
        where: { id: freshJob.id },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          resultJson: JSON.stringify(result),
          finishedAt: new Date(),
          errorMessage: null,
        },
      });

      summary.succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown background job failure.";
      const retryIndex = Math.min(freshJob.attemptCount, retryDelayMsByAttempt.length - 1);
      const canRetry = freshJob.attemptCount < freshJob.maxAttempts;

      await prisma.backgroundJob.update({
        where: { id: freshJob.id },
        data: {
          status: canRetry ? BackgroundJobStatus.RETRYABLE : BackgroundJobStatus.FAILED,
          errorMessage: message.slice(0, 500),
          finishedAt: new Date(),
          availableAt: canRetry ? new Date(Date.now() + retryDelayMsByAttempt[retryIndex]) : undefined,
        },
      });

      if (canRetry) {
        summary.retryable += 1;
      } else {
        summary.failed += 1;
      }
    }
  }

  await persistBackgroundJobsRuntimeNote(
    summary.processed === 0
      ? "No runnable background jobs were pending."
      : `Processed ${summary.processed} jobs. ${summary.succeeded} succeeded, ${summary.retryable} scheduled for retry, ${summary.failed} failed.`,
  );

  return summary;
}
