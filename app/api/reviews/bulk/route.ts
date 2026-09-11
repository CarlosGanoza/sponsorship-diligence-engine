import { ReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCandidateAutomation } from "@/lib/automation";
import { requireActionSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const bulkReviewSchema = z.object({
  entityType: z.enum(["claim", "recommendation"]),
  itemIds: z.array(z.string().min(1)).min(1),
  status: z.nativeEnum(ReviewStatus),
  note: z.string().max(280).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireActionSession();
    const parsed = bulkReviewSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Bulk review selection is invalid." }, { status: 400 });
    }

    const itemIds = Array.from(new Set(parsed.data.itemIds));

    if (parsed.data.entityType === "claim") {
      const claims = await prisma.evidenceClaim.findMany({
        where: {
          id: {
            in: itemIds,
          },
          candidate: {
            organizationId: session.organizationId,
          },
        },
        select: {
          id: true,
          candidateId: true,
        },
      });

      if (claims.length !== itemIds.length) {
        return NextResponse.json(
          { success: false, error: "One or more evidence claims could not be reviewed." },
          { status: 404 },
        );
      }

      await prisma.evidenceClaim.updateMany({
        where: {
          id: {
            in: itemIds,
          },
        },
        data: {
          reviewStatus: parsed.data.status,
          reviewNote: parsed.data.note?.trim() || null,
          reviewedAt: new Date(),
        },
      });

      for (const candidateId of Array.from(new Set(claims.map((claim) => claim.candidateId)))) {
        await evaluateCandidateAutomation(candidateId);
        revalidatePath(`/candidates/${candidateId}`);
      }
    } else {
      const recommendations = await prisma.recommendation.findMany({
        where: {
          id: {
            in: itemIds,
          },
          candidate: {
            organizationId: session.organizationId,
          },
        },
        select: {
          id: true,
          candidateId: true,
          sponsorId: true,
        },
      });

      if (recommendations.length !== itemIds.length) {
        return NextResponse.json(
          { success: false, error: "One or more recommendations could not be reviewed." },
          { status: 404 },
        );
      }

      await prisma.recommendation.updateMany({
        where: {
          id: {
            in: itemIds,
          },
        },
        data: {
          reviewStatus: parsed.data.status,
          reviewNote: parsed.data.note?.trim() || null,
          reviewedAt: new Date(),
        },
      });

      for (const candidateId of Array.from(new Set(recommendations.map((recommendation) => recommendation.candidateId)))) {
        await evaluateCandidateAutomation(candidateId);
        revalidatePath(`/candidates/${candidateId}`);
      }

      for (const sponsorId of Array.from(
        new Set(
          recommendations
            .map((recommendation) => recommendation.sponsorId)
            .filter((sponsorId): sponsorId is string => Boolean(sponsorId)),
        ),
      )) {
        revalidatePath(`/sponsors/${sponsorId}`);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/alerts");
    revalidatePath("/tasks");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not apply bulk review.",
      },
      { status: 500 },
    );
  }
}
