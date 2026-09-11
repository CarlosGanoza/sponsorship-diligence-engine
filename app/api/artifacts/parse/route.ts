import { NextResponse } from "next/server";
import { MembershipRole, StoredFilePurpose } from "@prisma/client";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { MAX_UPLOAD_SIZE_BYTES, parseArtifactUpload } from "@/lib/artifacts/parser";
import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { buildRateLimitHeaders, consumeRateLimit, getRequestClientLabel } from "@/lib/runtime/rate-limit";
import { persistStoredFile } from "@/lib/storage/provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAppSession();
  const rateLimit = consumeRateLimit({
    bucket: "artifact-parse",
    identifier: `${session?.organizationId ?? "anonymous"}:${getRequestClientLabel(request.headers)}`,
    limit: env.uploadRateLimitMaxRequests,
    windowMs: env.uploadRateLimitWindowMs,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: buildRateLimitHeaders(rateLimit) },
    );
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json(
      { error: "Member workspace access required." },
      { status: 403, headers: buildRateLimitHeaders(rateLimit) },
    );
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Upload parsing is rate-limited right now. Try again shortly." },
      { status: 429, headers: buildRateLimitHeaders(rateLimit) },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const candidateId = formData.get("candidateId");
    const purposeInput = formData.get("purpose");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file was provided for parsing." },
        { status: 400, headers: buildRateLimitHeaders(rateLimit) },
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Uploaded file is too large for MVP parsing. Keep files under 8 MB." },
        { status: 413, headers: buildRateLimitHeaders(rateLimit) },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const purpose =
      purposeInput === StoredFilePurpose.CANDIDATE_UPDATE_UPLOAD
        ? StoredFilePurpose.CANDIDATE_UPDATE_UPLOAD
        : StoredFilePurpose.ARTIFACT_UPLOAD;

    let storedFileId: string | undefined;

    if (typeof candidateId === "string" && candidateId.trim()) {
      const candidate = await prisma.candidate.findFirst({
        where: {
          id: candidateId,
          organizationId: session.organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!candidate) {
        return NextResponse.json(
          { error: "Candidate not found in this workspace." },
          { status: 404, headers: buildRateLimitHeaders(rateLimit) },
        );
      }

      const storedFile = await persistStoredFile({
        organizationId: session.organizationId,
        candidateId: candidate.id,
        uploadedById: session.user.id,
        purpose,
        fileName: file.name,
        mimeType: file.type,
        buffer,
        sourceLabel: purpose === StoredFilePurpose.CANDIDATE_UPDATE_UPLOAD ? "Candidate update upload" : "Candidate upload",
      });

      storedFileId = storedFile.id;
    }

    const parsed = await parseArtifactUpload({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    return NextResponse.json({
      ...parsed,
      storedFileId,
    }, { headers: buildRateLimitHeaders(rateLimit) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not parse uploaded artifact.",
      },
      { status: 400, headers: buildRateLimitHeaders(rateLimit) },
    );
  }
}
