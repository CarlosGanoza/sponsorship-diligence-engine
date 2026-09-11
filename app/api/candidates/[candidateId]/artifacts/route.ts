import { ArtifactType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { requireActionSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { getStoredFileAccessRecord } from "@/lib/storage/provider";

const artifactSchema = z.object({
  artifactType: z.nativeEnum(ArtifactType),
  title: z.string().min(3),
  rawText: z.string().min(30),
  sourceLabel: z.string().min(2),
  fileName: z.string().optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
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
    const parsed = artifactSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Artifact text is too short or missing." }, { status: 400 });
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

    const artifact = await prisma.$transaction(async (transaction) =>
      createVersionedArtifact(transaction, {
        candidateId,
        artifactType: parsed.data.artifactType,
        title: parsed.data.title,
        rawText: parsed.data.rawText,
        sourceLabel: parsed.data.sourceLabel,
        fileName: parsed.data.fileName,
        storedFileId: storedFile?.id ?? null,
        replacesArtifact,
      }),
    );

    await captureCandidateProgressSnapshot({
      candidateId,
      label: replacesArtifact ? "Artifact version replaced" : "Artifact added",
      summary: replacesArtifact
        ? `A new version replaced ${replacesArtifact.title} in the underwriting file.`
        : "A new evidence artifact was added to strengthen the underwriting file.",
    });
    await evaluateCandidateAutomation(candidateId);

    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/candidates");
    revalidatePath("/dashboard");
    revalidatePath("/alerts");

    return NextResponse.json({
      success: true,
      artifactId: artifact.id,
      artifactTitle: artifact.title,
      targetTab: "evidence",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not save artifact.",
      },
      { status: 500 },
    );
  }
}
