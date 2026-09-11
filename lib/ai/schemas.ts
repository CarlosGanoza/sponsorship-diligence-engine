import { z } from "zod";

export const signalCategoryValues = [
  "initiative",
  "follow_through",
  "leadership",
  "adaptability",
  "communication",
  "analytical_thinking",
  "collaboration",
  "resilience",
  "mission_alignment",
] as const;

export const evidenceClaimSchema = z.object({
  category: z.enum(signalCategoryValues),
  claim: z.string().min(1),
  confidence: z.number().min(0).max(1),
  supportingExcerpt: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export const evidenceExtractionSchema = z.object({
  claims: z.array(evidenceClaimSchema).min(1),
});

export const sponsorMemoSchema = z.object({
  executiveSummary: z.string().min(1),
  whyWorthBacking: z.string().min(1),
  strongestSignals: z.array(z.string()).min(2),
  risks: z.array(z.string()).min(1),
  bestFitOpportunityTypes: z.array(z.string()).min(1),
  recommendedNextAction: z.string().min(1),
  memoMarkdown: z.string().min(1),
});

export const advocacyDecisionValues = ["advance", "hold", "do_not_advance"] as const;

export const advocacyActionSchema = z.object({
  decision: z.enum(advocacyDecisionValues),
  action: z.string().min(1),
  rationale: z.string().min(1),
  requiredProof: z.array(z.string()).default([]),
  whyNotNow: z.array(z.string()).default([]),
});

export const sponsorMatchExplanationSchema = z.object({
  whyFit: z.string().min(1),
  signalDrivers: z.array(z.string()).min(1),
  connectionPath: z.array(z.string()).default([]),
  missingProof: z.array(z.string()).default([]),
  scoreSummary: z.string().min(1),
});

export type EvidenceExtraction = z.infer<typeof evidenceExtractionSchema>;
export type SponsorMemoOutput = z.infer<typeof sponsorMemoSchema>;
export type AdvocacyActionOutput = z.infer<typeof advocacyActionSchema>;
export type SponsorMatchExplanationOutput = z.infer<typeof sponsorMatchExplanationSchema>;
