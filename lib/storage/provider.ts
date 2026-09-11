import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { StoredFilePurpose } from "@prisma/client";

import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim() || "upload";

  return trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
}

function resolveStorageRoot() {
  return path.isAbsolute(env.fileStoragePath)
    ? env.fileStoragePath
    : path.join(process.cwd(), env.fileStoragePath);
}

function buildRelativeStoragePath(organizationId: string, fileName: string) {
  const now = new Date();
  const safeName = sanitizeFileName(fileName);

  return path.posix.join(
    organizationId,
    now.getUTCFullYear().toString(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}-${safeName}`,
  );
}

function checksumBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function persistStoredFile(input: {
  organizationId: string;
  candidateId?: string | null;
  uploadedById?: string | null;
  purpose: StoredFilePurpose;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  sourceLabel: string;
}) {
  const relativePath = buildRelativeStoragePath(input.organizationId, input.fileName);
  const absolutePath = path.join(resolveStorageRoot(), relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  return prisma.storedFile.create({
    data: {
      organizationId: input.organizationId,
      candidateId: input.candidateId ?? null,
      uploadedById: input.uploadedById ?? null,
      purpose: input.purpose,
      originalFileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      byteSize: input.buffer.byteLength,
      checksum: checksumBuffer(input.buffer),
      storagePath: relativePath,
      fileExtension: path.extname(input.fileName).replace(/^\./, "") || null,
      sourceLabel: input.sourceLabel,
    },
  });
}

export async function readStoredFileContent(storagePath: string) {
  const absolutePath = path.join(resolveStorageRoot(), storagePath);
  return readFile(absolutePath);
}

export async function getStoredFileAccessRecord(input: {
  storedFileId: string;
  organizationId: string;
  candidateId?: string | null;
}) {
  return prisma.storedFile.findFirst({
    where: {
      id: input.storedFileId,
      organizationId: input.organizationId,
      candidateId: input.candidateId ?? undefined,
      artifact: {
        is: null,
      },
    },
  });
}

export async function getStoredFileDownloadRecord(storedFileId: string, organizationId: string) {
  return prisma.storedFile.findFirst({
    where: {
      id: storedFileId,
      organizationId,
    },
    include: {
      artifact: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });
}

export function getStorageRuntimeSnapshot() {
  return {
    mode: env.fileStorageMode,
    rootPath: resolveStorageRoot(),
  };
}
