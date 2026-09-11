import { RecommendationType } from "@prisma/client";
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
  const recommendations = await prisma.recommendation.findMany({
    where: { candidateId },
    select: {
      id: true,
      recommendationType: true,
      actionSuggestion: true,
      explanation: true,
    },
    orderBy: [{ recommendationType: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    candidateId,
    total: recommendations.length,
    nextActionCount: recommendations.filter(
      (recommendation) => recommendation.recommendationType === RecommendationType.NEXT_ACTION,
    ).length,
    bestSponsorCount: recommendations.filter(
      (recommendation) => recommendation.recommendationType === RecommendationType.BEST_SPONSOR,
    ).length,
    recommendations,
  });
}
