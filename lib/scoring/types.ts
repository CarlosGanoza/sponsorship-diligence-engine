import type {
  Artifact,
  Candidate,
  EvidenceClaim,
  RelationshipEdge,
  Sponsor,
} from "@prisma/client";

export type ReadinessBreakdown = {
  evidenceAmount: number;
  artifactDiversity: number;
  averageConfidence: number;
  highValueSignals: number;
  relationshipStrength: number;
  profileCompleteness: number;
  sourceQuality: number;
  evidenceFreshness: number;
};

export type SponsorMatchBreakdown = {
  domainFit: number;
  geographyFit: number;
  interestOverlap: number;
  sponsorStyleFit: number;
  warmPathAvailability: number;
  signalProfile: number;
  actionRelevance: number;
  sponsorCapacity: number;
  sponsorResponsiveness: number;
};

export type CandidateContext = {
  candidate: Candidate;
  artifacts: Artifact[];
  claims: EvidenceClaim[];
  edges: RelationshipEdge[];
};

export type SponsorContext = CandidateContext & {
  sponsor: Sponsor;
};
