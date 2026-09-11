import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  if (process.env.PLAYWRIGHT !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { candidateId } = await params;
  const artifacts = await prisma.artifact.findMany({
    where: { candidateId },
    orderBy: [{ isCurrentVersion: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      sourceLabel: true,
      isCurrentVersion: true,
      versionNumber: true,
    },
  });

  return NextResponse.json({
    candidateId,
    total: artifacts.length,
    titles: artifacts.map((artifact) => artifact.title),
    artifacts,
  });
}
