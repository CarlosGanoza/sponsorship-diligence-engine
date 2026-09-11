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
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      candidateNotes: {
        orderBy: { createdAt: "desc" },
        select: {
          title: true,
          content: true,
        },
        take: 20,
      },
      candidateDecisions: {
        orderBy: { createdAt: "desc" },
        select: {
          summary: true,
          rationale: true,
        },
        take: 20,
      },
      evidenceClaims: {
        orderBy: { reviewedAt: "desc" },
        select: {
          id: true,
          claim: true,
          reviewNote: true,
          reviewStatus: true,
        },
        take: 50,
      },
      candidateUpdates: {
        orderBy: { createdAt: "desc" },
        select: {
          title: true,
          status: true,
          summary: true,
        },
        take: 20,
      },
      disagreementReviews: {
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          resolutionType: true,
          rationale: true,
        },
        take: 20,
      },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  return NextResponse.json({
    candidateId: candidate.id,
    notes: candidate.candidateNotes,
    decisions: candidate.candidateDecisions,
    claimReviews: candidate.evidenceClaims,
    updates: candidate.candidateUpdates,
    disagreementReviews: candidate.disagreementReviews,
  });
}
