import { NextResponse } from "next/server";
import { StoredFilePurpose } from "@prisma/client";

import { MAX_UPLOAD_SIZE_BYTES, parseArtifactUpload } from "@/lib/artifacts/parser";
import { getCandidateUpdateAccessContext } from "@/lib/candidate-updates/access-links";
import { env } from "@/lib/db/env";
import { buildRateLimitHeaders, consumeRateLimit, getRequestClientLabel } from "@/lib/runtime/rate-limit";
import { persistStoredFile } from "@/lib/storage/provider";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const context = await getCandidateUpdateAccessContext(token);
  const rateLimit = consumeRateLimit({
    bucket: `secure-update-parse:${token.slice(0, 12)}`,
    identifier: getRequestClientLabel(request.headers),
    limit: env.uploadRateLimitMaxRequests,
    windowMs: env.uploadRateLimitWindowMs,
  });

  if (!context || !context.isActive) {
    return NextResponse.json(
      { error: "This secure update link is no longer active." },
      { status: 404, headers: buildRateLimitHeaders(rateLimit) },
    );
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Secure update parsing is rate-limited right now. Try again shortly." },
      { status: 429, headers: buildRateLimitHeaders(rateLimit) },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

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
    const storedFile = await persistStoredFile({
      organizationId: context.candidate.organizationId,
      candidateId: context.candidate.id,
      purpose: StoredFilePurpose.SECURE_CANDIDATE_UPDATE,
      fileName: file.name,
      mimeType: file.type,
      buffer,
      sourceLabel: "Secure candidate update upload",
    });
    const parsed = await parseArtifactUpload({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    return NextResponse.json({
      ...parsed,
      storedFileId: storedFile.id,
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
