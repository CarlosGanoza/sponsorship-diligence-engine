import { AuditLogTargetType, SponsorAvailabilityStatus } from "@prisma/client";
import { z } from "zod";

import { recordAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";

export const sponsorAvailabilityInputSchema = z.object({
  availabilityStatus: z.nativeEnum(SponsorAvailabilityStatus),
  maxConcurrentPaths: z.coerce.number().int().min(1).max(20),
  warmIntroAvailable: z.boolean(),
  availabilityNote: z.string().max(240).optional(),
  blackoutUntil: z.string().optional(),
  blackoutReason: z.string().max(240).optional(),
});

export async function updateSponsorAvailabilityForOrganization(input: {
  sponsorId: string;
  organizationId: string;
  actorUserId: string;
  data: z.infer<typeof sponsorAvailabilityInputSchema>;
}) {
  const sponsor = await prisma.sponsor.findFirst({
    where: {
      id: input.sponsorId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      fullName: true,
    },
  });

  if (!sponsor) {
    throw new Error("Sponsor not found in this workspace.");
  }

  const blackoutUntil = input.data.blackoutUntil?.trim() ? new Date(input.data.blackoutUntil.trim()) : null;

  if (blackoutUntil && Number.isNaN(blackoutUntil.getTime())) {
    throw new Error("Blackout timing is invalid.");
  }

  const updatedSponsor = await prisma.sponsor.update({
    where: { id: input.sponsorId },
    data: {
      availabilityStatus: input.data.availabilityStatus,
      maxConcurrentPaths: input.data.maxConcurrentPaths,
      warmIntroAvailable: input.data.warmIntroAvailable,
      availabilityNote: input.data.availabilityNote?.trim() || null,
      blackoutUntil,
      blackoutReason: input.data.blackoutReason?.trim() || null,
    },
    select: {
      id: true,
      availabilityStatus: true,
      maxConcurrentPaths: true,
      warmIntroAvailable: true,
      availabilityNote: true,
      blackoutUntil: true,
      blackoutReason: true,
    },
  });

  await recordAuditLog({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    sponsorId: input.sponsorId,
    targetType: AuditLogTargetType.SPONSOR,
    action: "sponsor.availability_updated",
    title: `Sponsor availability updated · ${sponsor.fullName}`,
    detail:
      input.data.blackoutReason?.trim() ||
      input.data.availabilityNote?.trim() ||
      `Availability ${input.data.availabilityStatus.toLowerCase()} with ${input.data.maxConcurrentPaths} max paths.`,
    payload: {
      availabilityStatus: input.data.availabilityStatus,
      maxConcurrentPaths: input.data.maxConcurrentPaths,
      warmIntroAvailable: input.data.warmIntroAvailable,
      blackoutUntil: blackoutUntil?.toISOString() ?? null,
      blackoutReason: input.data.blackoutReason?.trim() || null,
    },
  });

  return updatedSponsor;
}
