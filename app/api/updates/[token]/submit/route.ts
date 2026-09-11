import { ArtifactType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { getCandidateUpdateAccessContext } from "@/lib/candidate-updates/access-links";
import { prisma } from "@/lib/db/prisma";
import { captureCandidateProgressSnapshot } from "@/lib/progress";
import { getStoredFileAccessRecord } from "@/lib/storage/provider";

const publicCandidateUpdateSchema = z.object({
  title: z.string().min(4).max(120),
  summary: z.string().min(12).max(600),
  submittedByLabel: z.string().min(2).max(80),
  artifactType: z.nativeEnum(ArtifactType),
  fileName: z.string().max(120).optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
  rawText: z.string().min(30),
  ownershipScope: z.string().max(240).optional(),
  quantifiedOutcome: z.string().max(240).optional(),
  thirdPartyContext: z.string().max(240).optional(),
  consentAcknowledged: z.literal(true),
});

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
      sourceLabel: "Secure candidate update",
      fileName: input.fileName?.trim() || null,
      storedFileId: input.storedFileId ?? null,
      supersedesArtifactId: input.replacesArtifact?.id ?? null,
      versionNumber: (input.replacesArtifact?.versionNumber ?? 0) + 1,
      isCurrentVersion: true,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = publicCandidateUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Update details are incomplete." }, { status: 400 });
  }

  const context = await getCandidateUpdateAccessContext(token);

  if (!context || !context.isActive) {
    return NextResponse.json({ error: "This secure update link is no longer active." }, { status: 410 });
  }

  const storedFile = parsed.data.storedFileId
    ? await requireStoredFileAccess(
        parsed.data.storedFileId,
        context.candidate.organizationId,
        context.candidate.id,
      )
    : null;

  if (parsed.data.storedFileId && !storedFile) {
    return NextResponse.json({ error: "Stored file is not available for this candidate." }, { status: 400 });
  }

  const replacesArtifact = await requireArtifactReplacementAccess(
    parsed.data.replacesArtifactId,
    context.candidate.organizationId,
    context.candidate.id,
  );

  if (parsed.data.replacesArtifactId && !replacesArtifact) {
    return NextResponse.json({ error: "The selected earlier artifact is no longer available to replace." }, { status: 400 });
  }

  const structuredContext = [
    parsed.data.ownershipScope?.trim()
      ? `Ownership scope: ${parsed.data.ownershipScope.trim()}`
      : null,
    parsed.data.quantifiedOutcome?.trim()
      ? `Quantified result: ${parsed.data.quantifiedOutcome.trim()}`
      : null,
    parsed.data.thirdPartyContext?.trim()
      ? `Third-party context: ${parsed.data.thirdPartyContext.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const normalizedRawText = [parsed.data.rawText.trim(), ...structuredContext].join("\n\n");

  const update = await prisma.$transaction(async (transaction) => {
    const artifact = await createVersionedArtifact(transaction, {
      candidateId: context.candidate.id,
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
      rawText: normalizedRawText,
      fileName: parsed.data.fileName,
      storedFileId: storedFile?.id ?? null,
      replacesArtifact,
    });

    const createdUpdate = await transaction.candidateUpdate.create({
      data: {
        candidateId: context.candidate.id,
        sourceProofRequestId: context.proofRequest.id,
        artifactId: artifact.id,
        title: parsed.data.title.trim(),
        summary: [parsed.data.summary.trim(), ...structuredContext].join(" "),
        submittedByLabel: parsed.data.submittedByLabel.trim(),
      },
    });

    await transaction.candidateUpdateAccessLink.update({
      where: { id: context.link.id },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return createdUpdate;
  });

  await captureCandidateProgressSnapshot({
    candidateId: context.candidate.id,
    label: "Secure candidate update submitted",
    summary: replacesArtifact
      ? `${update.title}. ${update.summary} This replaced a prior artifact version.`
      : `${update.title}. ${update.summary}`,
  });
  await evaluateCandidateAutomation(context.candidate.id);

  revalidatePath(`/candidates/${context.candidate.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath("/tasks");

  return NextResponse.json({
    success: true,
    updateId: update.id,
  });
}
