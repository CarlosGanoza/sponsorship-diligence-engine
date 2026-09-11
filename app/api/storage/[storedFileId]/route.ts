import { NextResponse } from "next/server";
import { MembershipRole } from "@prisma/client";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { getStoredFileDownloadRecord, readStoredFileContent } from "@/lib/storage/provider";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storedFileId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { storedFileId } = await params;
  const storedFile = await getStoredFileDownloadRecord(storedFileId, session.organizationId);

  if (!storedFile) {
    return NextResponse.json({ error: "Stored file not found." }, { status: 404 });
  }

  try {
    const buffer = await readStoredFileContent(storedFile.storagePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": storedFile.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${storedFile.originalFileName}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Stored file could not be read.",
      },
      { status: 500 },
    );
  }
}
