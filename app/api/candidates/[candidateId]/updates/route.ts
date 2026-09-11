import { ArtifactType, ProofRequestStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { requireActionSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveProofRequest } from "@/lib/proof-requests";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { getStoredFileAccessRecord } from "@/lib/storage/provider";

const candidateUpdateSubmissionSchema = z.object({
  sourceProofRequestId: z.string().optional(),
  title: z.string().min(4).max(120),
  summary: z.string().min(12).max(600),
  submittedByLabel: z.string().min(2).max(80),
  artifactType: z.nativeEnum(ArtifactType),
  sourceLabel: z.string().min(2).max(80),
  fileName: z.string().max(120).optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
  rawText: z.string().min(30),
  resolveLinkedProofRequest: z.boolean().default(true),
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

async function requireStoredFileAccess(
  storedFileId: string | undefined,
  organizationId: string,
  candidateId: string,
) {
  if (!storedFileId) {
    return null;
  }

  return getStoredFileAccessRecord({
    storedFileId,
    organizationId,
    candidateId,
  });
}

async function requireArtifactReplacementAccess(
  replacesArtifactId: string | undefined,
  organizationId: string,
  candidateId: string,
) {
  if (!replacesArtifactId) {
    return null;
  }

  return prisma.artifact.findFirst({
    where: {
      id: replacesArtifactId,
      candidateId,
      isCurrentVersion: true,
      candidate: {
        organizationId,
      },
    },
    select: {
      id: true,
      title: true,
      versionNumber: true,
    },
  });
}

async function createVersionedArtifact(
  transaction: Prisma.TransactionClient,
  input: {
    candidateId: string;
    artifactType: ArtifactType;
    title: string;
    rawText: string;
    sourceLabel: string;
    fileName?: string | null;
    storedFileId?: string | null;
    replacesArtifact?: {
      id: string;
      versionNumber: number;
    } | null;
  },
) {
  if (input.replacesArtifact) {
    await transaction.artifact.update({
      where: { id: input.replacesArtifact.id },
      data: {
        isCurrentVersion: false,
      },
    });
  }

  return transaction.artifact.create({
    data: {
      candidateId: input.candidateId,
      artifactType: input.artifactType,
      title: input.title.trim(),
      rawText: input.rawText.trim(),
      sourceLabel: input.sourceLabel.trim(),
      fileName: input.fileName?.trim() || null,
      storedFileId: input.storedFileId ?? null,
      supersedesArtifactId: input.replacesArtifact?.id ?? null,
      versionNumber: (input.replacesArtifact?.versionNumber ?? 0) + 1,
      isCurrentVersion: true,
    },
    select: {
      id: true,
      title: true,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const session = await requireActionSession();
    const { candidateId } = await params;
    const parsed = candidateUpdateSubmissionSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Candidate update details are incomplete." }, { status: 400 });
    }

    const candidate = await requireCandidateAccess(candidateId, session.organizationId);

    if (!candidate) {
      return NextResponse.json({ success: false, error: "Candidate not found in this workspace." }, { status: 404 });
    }

    const storedFile = await requireStoredFileAccess(
      parsed.data.storedFileId,
      session.organizationId,
      candidateId,
    );

    if (parsed.data.storedFileId && !storedFile) {
      return NextResponse.json(
        { success: false, error: "Stored file is not available for this candidate." },
        { status: 400 },
      );
    }

    let linkedProofRequestId: string | null = null;

    if (parsed.data.sourceProofRequestId) {
      const proofRequest = await prisma.proofRequest.findFirst({
        where: {
          id: parsed.data.sourceProofRequestId,
          candidateId,
          candidate: {
            organizationId: session.organizationId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!proofRequest) {
        return NextResponse.json(
          { success: false, error: "Linked proof request was not found in this workspace." },
          { status: 404 },
        );
      }

      linkedProofRequestId = proofRequest.id;
    }

    const replacesArtifact = await requireArtifactReplacementAccess(
      parsed.data.replacesArtifactId,
      session.organizationId,
      candidateId,
    );

    if (parsed.data.replacesArtifactId && !replacesArtifact) {
      return NextResponse.json(
        { success: false, error: "The selected artifact version is no longer available to replace." },
        { status: 400 },
      );
    }

    const created = await prisma.$transaction(async (transaction) => {
      const artifact = await createVersionedArtifact(transaction, {
        candidateId,
        artifactType: parsed.data.artifactType,
        title: parsed.data.title,
        rawText: parsed.data.rawText,
        sourceLabel: parsed.data.sourceLabel,
        fileName: parsed.data.fileName,
        storedFileId: storedFile?.id ?? null,
        replacesArtifact,
      });

      const update = await transaction.candidateUpdate.create({
        data: {
          candidateId,
          sourceProofRequestId: linkedProofRequestId,
          submittedByUserId: session.user.id,
          artifactId: artifact.id,
          title: parsed.data.title.trim(),
          summary: parsed.data.summary.trim(),
          submittedByLabel: parsed.data.submittedByLabel.trim(),
        },
      });

      return {
        artifact,
        update,
      };
    });

    if (linkedProofRequestId && parsed.data.resolveLinkedProofRequest) {
      await resolveProofRequest({
        requestId: linkedProofRequestId,
        resolvedById: session.user.id,
        resolutionNote: `Resolved via candidate update: ${created.update.title}. ${created.update.summary}`,
        status: ProofRequestStatus.RESOLVED,
      });
    }

    await captureCandidateProgressSnapshot({
      candidateId,
      label: "Candidate update submitted",
      summary: replacesArtifact
        ? `${created.update.title}. ${created.update.summary} This replaced a prior artifact version.`
        : `${created.update.title}. ${created.update.summary}`,
    });
    await evaluateCandidateAutomation(candidateId);

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/candidates");
    revalidatePath("/dashboard");
    revalidatePath("/alerts");

    return NextResponse.json({
      success: true,
      updateId: created.update.id,
      targetTab: "workflow",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not submit candidate update.",
      },
      { status: 500 },
    );
  }
}
