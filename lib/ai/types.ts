import type { ArtifactType, Candidate, EvidenceClaim, Sponsor } from "@prisma/client";

import type {
  AdvocacyActionOutput,
  EvidenceExtraction,
  SponsorMatchExplanationOutput,
  SponsorMemoOutput,
} from "@/lib/ai/schemas";
import type { ReadinessBreakdown, SponsorMatchBreakdown } from "@/lib/scoring";

export type CandidateAiInput = Pick<
  Candidate,
  "id" | "fullName" | "headline" | "bio" | "region" | "currentStage" | "sponsorReadinessScore"
>;

export type ArtifactAiInput = {
  id: string;
  artifactType: ArtifactType;
  title: string;
  rawText: string;
  sourceLabel: string;
  fileName: string | null;
};

export type EvidenceClaimAiInput = Pick<
  EvidenceClaim,
  "id" | "category" | "claim" | "confidence" | "supportingExcerpt" | "artifactId" | "tags"
> & {
  artifactTitle: string;
};

export type SponsorAiInput = Pick<
  Sponsor,
  | "id"
  | "fullName"
  | "title"
  | "organization"
  | "domainExpertise"
  | "seniorityLevel"
  | "sponsorStyle"
  | "interestTags"
  | "geography"
  | "warmIntroAvailable"
  | "bio"
>;

export interface AiProvider {
  extractEvidenceClaims(input: {
    candidate: CandidateAiInput;
    artifact: ArtifactAiInput;
  }): Promise<EvidenceExtraction>;
  generateSponsorMemo(input: {
    candidate: CandidateAiInput;
    artifacts: ArtifactAiInput[];
    claims: EvidenceClaimAiInput[];
    readinessScore: number;
    readinessBreakdown: ReadinessBreakdown;
  }): Promise<SponsorMemoOutput>;
  recommendNextAdvocacyAction(input: {
    candidate: CandidateAiInput;
    artifacts: ArtifactAiInput[];
    claims: EvidenceClaimAiInput[];
    readinessScore: number;
  }): Promise<AdvocacyActionOutput>;
  explainSponsorMatch(input: {
    candidate: CandidateAiInput;
    sponsor: SponsorAiInput;
    claims: EvidenceClaimAiInput[];
    matchScore: number;
    matchBreakdown: SponsorMatchBreakdown;
    connectionPath: string[];
  }): Promise<SponsorMatchExplanationOutput>;
}
