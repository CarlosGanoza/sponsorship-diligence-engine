import { z } from "zod";
import { ReviewStatus } from "@prisma/client";

const packetEvidenceItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  claim: z.string(),
  supportingExcerpt: z.string(),
  artifactTitle: z.string(),
  confidence: z.number(),
  reviewStatus: z.nativeEnum(ReviewStatus),
  reviewNote: z.string().nullable().optional(),
});

const reviewNoteItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  note: z.string().nullable().optional(),
});

export const memoReviewSharePayloadSchema = z.object({
  kind: z.literal("memo"),
  candidateName: z.string(),
  summary: z.string(),
  rationale: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedAction: z.string(),
  status: z.string(),
  sponsorLabel: z.string().nullable().optional(),
  sponsorMeta: z.string().nullable().optional(),
});

export const packetReviewSharePayloadSchema = z.object({
  kind: z.literal("packet"),
  candidateName: z.string(),
  candidateHeadline: z.string(),
  candidateRegion: z.string(),
  sponsorName: z.string(),
  sponsorTitle: z.string(),
  sponsorOrganization: z.string(),
  readinessScore: z.number(),
  matchScore: z.number(),
  fitBreakdown: z.record(z.string(), z.number()),
  memoSummary: z.string(),
  sponsorAngle: z.string(),
  recommendedAsk: z.string(),
  recommendedAction: z.string(),
  warmPath: z.array(z.string()),
  warmPathNote: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  evidence: z.array(packetEvidenceItemSchema),
  flaggedItems: z.array(reviewNoteItemSchema),
});

export const reviewSharePayloadSchema = z.union([memoReviewSharePayloadSchema, packetReviewSharePayloadSchema]);

export type ReviewSharePayload = z.infer<typeof reviewSharePayloadSchema>;

function stringifyPayload(payload: ReviewSharePayload) {
  return JSON.stringify(payload);
}

export function buildMemoReviewSharePayload(input: z.input<typeof memoReviewSharePayloadSchema>) {
  return memoReviewSharePayloadSchema.parse(input);
}

export function buildPacketReviewSharePayload(input: z.input<typeof packetReviewSharePayloadSchema>) {
  return packetReviewSharePayloadSchema.parse(input);
}

export function serializeReviewSharePayload(payload: ReviewSharePayload) {
  return stringifyPayload(payload);
}

export function parseReviewSharePayload(payloadJson: string) {
  const parsed = JSON.parse(payloadJson) as unknown;
  return reviewSharePayloadSchema.parse(parsed);
}

export function buildReviewSharePath(token: string) {
  return `/review/${token}`;
}
