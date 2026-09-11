import {
  AutomationMode,
  ArtifactType,
  CandidateStage,
  EdgeType,
  EntityType,
  SeniorityLevel,
  SignalCategory,
  SponsorAvailabilityStatus,
  SponsorStyle,
  type Artifact,
  type Candidate,
  type EvidenceClaim,
  type RelationshipEdge,
  type Sponsor,
} from "@prisma/client";

import { computeSponsorMatch, computeSponsorReadiness } from "@/lib/scoring";
import {
  computeEvidenceFreshnessScore,
  computeSourceQualityScore,
  countDuplicateClaims,
} from "@/lib/scoring/evidence";

const candidate: Candidate = {
  id: "candidate-1",
  organizationId: "org-1",
  fullName: "Leila Mensah",
  headline: "Workforce pathways builder connecting students to apprenticeships",
  bio: "Leila builds community and workforce systems that help first-generation students move from education into paid opportunity with consistent follow-through.",
  region: "Atlanta, GA",
  currentStage: CandidateStage.MEMO_READY,
  automationMode: AutomationMode.AUTOMATED,
  automationNote: null,
  automationUpdatedAt: null,
  sponsorReadinessScore: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const artifacts: Artifact[] = [
  {
    id: "artifact-1",
    candidateId: candidate.id,
    storedFileId: null,
    supersedesArtifactId: null,
    artifactType: ArtifactType.RESUME,
    title: "Resume",
    rawText: "Launched an employer partnership track and managed follow-through across two cohorts.",
    sourceLabel: "Candidate upload",
    fileName: "resume.pdf",
    versionNumber: 1,
    isCurrentVersion: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "artifact-2",
    candidateId: candidate.id,
    storedFileId: null,
    supersedesArtifactId: null,
    artifactType: ArtifactType.MENTOR_NOTE,
    title: "Mentor note",
    rawText: "Leila leads with consistency and recovers trust quickly when employer expectations drift.",
    sourceLabel: "Mentor note",
    fileName: null,
    versionNumber: 1,
    isCurrentVersion: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "artifact-3",
    candidateId: candidate.id,
    storedFileId: null,
    supersedesArtifactId: null,
    artifactType: ArtifactType.PROJECT_SUMMARY,
    title: "Project summary",
    rawText: "Built a community-ready sprint to support student apprenticeship retention.",
    sourceLabel: "Candidate upload",
    fileName: null,
    versionNumber: 1,
    isCurrentVersion: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const claims: EvidenceClaim[] = [
  {
    id: "claim-1",
    candidateId: candidate.id,
    artifactId: "artifact-1",
    category: SignalCategory.INITIATIVE,
    claim: "Shows initiative through launching the employer partnership track.",
    confidence: 0.88,
    supportingExcerpt: "Launched an employer partnership track",
    tags: "workforce|education",
    reviewStatus: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "claim-2",
    candidateId: candidate.id,
    artifactId: "artifact-1",
    category: SignalCategory.FOLLOW_THROUGH,
    claim: "Demonstrates follow-through across two cohorts.",
    confidence: 0.83,
    supportingExcerpt: "managed follow-through across two cohorts",
    tags: "workforce",
    reviewStatus: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "claim-3",
    candidateId: candidate.id,
    artifactId: "artifact-2",
    category: SignalCategory.LEADERSHIP,
    claim: "Provides evidence of leadership in employer-facing settings.",
    confidence: 0.79,
    supportingExcerpt: "Leads with consistency",
    tags: "leadership|community",
    reviewStatus: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "claim-4",
    candidateId: candidate.id,
    artifactId: "artifact-2",
    category: SignalCategory.MISSION_ALIGNMENT,
    claim: "Shows clear mission alignment with first-generation student opportunity.",
    confidence: 0.81,
    supportingExcerpt: "support first-generation students move into paid opportunity",
    tags: "community|equity",
    reviewStatus: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "claim-5",
    candidateId: candidate.id,
    artifactId: "artifact-3",
    category: SignalCategory.COLLABORATION,
    claim: "Demonstrates collaborative execution with employers and campus advisors.",
    confidence: 0.77,
    supportingExcerpt: "managed employer relationships and weekly follow-through with campus advisors",
    tags: "collaboration|workforce",
    reviewStatus: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const edges: RelationshipEdge[] = [
  {
    id: "edge-1",
    organizationId: "org-1",
    fromEntityType: EntityType.CANDIDATE,
    fromEntityId: candidate.id,
    toEntityType: EntityType.MENTOR,
    toEntityId: "mentor-1",
    edgeType: EdgeType.MENTORED_BY,
    strength: 4,
    notes: "Devon Price, apprenticeship mentor",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "edge-2",
    organizationId: "org-1",
    fromEntityType: EntityType.MENTOR,
    fromEntityId: "mentor-1",
    toEntityType: EntityType.SPONSOR,
    toEntityId: "sponsor-1",
    edgeType: EdgeType.REFERRED_BY,
    strength: 4,
    notes: "Devon Price, apprenticeship mentor",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const alignedSponsor: Sponsor = {
  id: "sponsor-1",
  organizationId: "org-1",
  fullName: "Victor Han",
  title: "Executive Vice President",
  organization: "Northforge Foundation",
  domainExpertise: "workforce|education|community",
  seniorityLevel: SeniorityLevel.EXECUTIVE,
  sponsorStyle: SponsorStyle.HANDS_ON,
  interestTags: "youth|equity|leadership",
  geography: "United States",
  warmIntroAvailable: true,
  availabilityStatus: SponsorAvailabilityStatus.OPEN,
  maxConcurrentPaths: 4,
  availabilityNote: null,
  blackoutUntil: null,
  blackoutReason: null,
  bio: "Aligned workforce sponsor",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const misalignedSponsor: Sponsor = {
  id: "sponsor-2",
  organizationId: "org-1",
  fullName: "Daniel Reed",
  title: "Partner",
  organization: "Red Cedar Ventures",
  domainExpertise: "finance|housing|technology",
  seniorityLevel: SeniorityLevel.PARTNER,
  sponsorStyle: SponsorStyle.SELECTIVE_DOOR_OPENER,
  interestTags: "capital|real estate",
  geography: "Miami, FL",
  warmIntroAvailable: false,
  availabilityStatus: SponsorAvailabilityStatus.OPEN,
  maxConcurrentPaths: 4,
  availabilityNote: null,
  blackoutUntil: null,
  blackoutReason: null,
  bio: "Less aligned housing sponsor",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("scoring logic", () => {
  it("computes a transparent sponsor readiness score", () => {
    const readiness = computeSponsorReadiness(candidate, artifacts, claims, edges);

    expect(readiness.score).toBeGreaterThanOrEqual(60);
    expect(readiness.breakdown.evidenceAmount).toBeGreaterThan(0);
    expect(readiness.breakdown.relationshipStrength).toBeGreaterThan(0);
    expect(readiness.breakdown.sourceQuality).toBeGreaterThan(0);
    expect(readiness.breakdown.evidenceFreshness).toBeGreaterThan(0);
    expect(readiness.status).toBe("processing");
  });

  it("detects paraphrased duplicate claims and penalizes source quality", () => {
    const duplicateLikeClaims: EvidenceClaim[] = [
      claims[0],
      {
        ...claims[0],
        id: "claim-dup-1",
        claim: "Demonstrates leadership by leading the employer partnership track and managing follow-through.",
        supportingExcerpt: "Launched an employer partnership track",
      },
    ];

    expect(countDuplicateClaims(duplicateLikeClaims)).toBeGreaterThan(0);
    expect(computeSourceQualityScore(artifacts, duplicateLikeClaims)).toBeLessThan(
      computeSourceQualityScore(artifacts, [claims[0]]),
    );
  });

  it("penalizes freshness more directly when most proof is stale", () => {
    const staleDate = new Date("2022-01-05T00:00:00.000Z");
    const freshDate = new Date();
    const mostlyStaleArtifacts: Artifact[] = [
      {
        ...artifacts[0],
        id: "stale-artifact-1",
        createdAt: staleDate,
        updatedAt: staleDate,
      },
      {
        ...artifacts[1],
        id: "stale-artifact-2",
        createdAt: staleDate,
        updatedAt: staleDate,
      },
      {
        ...artifacts[2],
        id: "fresh-artifact-1",
        createdAt: freshDate,
        updatedAt: freshDate,
      },
    ];

    expect(computeEvidenceFreshnessScore(mostlyStaleArtifacts)).toBeLessThan(4);
  });

  it("rewards aligned sponsors over mismatched sponsors", () => {
    const aligned = computeSponsorMatch(candidate, alignedSponsor, artifacts, claims, edges, {
      sponsorActivities: [
        {
          activityType: "MEETING_SCHEDULED",
          status: "COMPLETED",
          detail: "Introduced and advanced to a first diligence meeting.",
        },
        {
          activityType: "OUTCOME_RECORDED",
          status: "COMPLETED",
          detail: "The sponsor backed the next pilot conversation.",
        },
      ],
      sponsorPipelineItems: [
        {
          stage: "ADVOCATING",
          outcomeNote: "Sponsor is backing the next pilot step.",
        },
      ],
    });
    const misaligned = computeSponsorMatch(candidate, misalignedSponsor, artifacts, claims, edges, {
      sponsorActivities: [
        {
          activityType: "INTRO_REQUESTED",
          status: "BLOCKED",
          detail: "This sponsor declined to move forward.",
        },
      ],
      sponsorPipelineItems: [
        {
          stage: "PASSED",
          outcomeNote: "Not a fit for current timing.",
        },
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
      ],
    });

    expect(aligned.score).toBeGreaterThan(misaligned.score);
    expect(aligned.breakdown.domainFit).toBeGreaterThan(misaligned.breakdown.domainFit);
    expect(aligned.breakdown.warmPathAvailability).toBeGreaterThanOrEqual(
      misaligned.breakdown.warmPathAvailability,
    );
    expect(aligned.breakdown.sponsorCapacity).toBeGreaterThan(misaligned.breakdown.sponsorCapacity);
    expect(aligned.breakdown.sponsorResponsiveness).toBeGreaterThan(
      misaligned.breakdown.sponsorResponsiveness,
    );
    expect(aligned.baseFitScore).toBeLessThan(aligned.score);
    expect(aligned.rightNowLabel).toBe("Ready now");
  });

  it("penalizes sponsors that are paused or materially overloaded", () => {
    const pausedSponsor: Sponsor = {
      ...alignedSponsor,
      id: "sponsor-3",
      availabilityStatus: SponsorAvailabilityStatus.PAUSED,
      maxConcurrentPaths: 2,
      availabilityNote: "Paused during current board cycle.",
      blackoutUntil: null,
      blackoutReason: null,
    };

    const openResult = computeSponsorMatch(candidate, alignedSponsor, artifacts, claims, edges, {
      sponsorActivities: [
        {
          activityType: "MEETING_SCHEDULED",
          status: "COMPLETED",
          detail: "Keeps sponsor meetings moving.",
        },
      ],
      sponsorPipelineItems: [
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
      ],
      sponsorOutcomes: [{ verdict: "POSITIVE" }],
    });

    const pausedResult = computeSponsorMatch(candidate, pausedSponsor, artifacts, claims, edges, {
      sponsorActivities: [
        {
          activityType: "MEETING_SCHEDULED",
          status: "COMPLETED",
          detail: "Keeps sponsor meetings moving.",
        },
      ],
      sponsorPipelineItems: [
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
        {
          stage: "ADVOCATING",
          outcomeNote: "At capacity with active sponsor asks.",
        },
      ],
      sponsorOutcomes: [{ verdict: "POSITIVE" }],
    });

    expect(openResult.score).toBeGreaterThan(pausedResult.score);
    expect(openResult.breakdown.sponsorCapacity).toBeGreaterThan(pausedResult.breakdown.sponsorCapacity);
    expect(pausedResult.operatingProfile.availabilityStatus).toBe(SponsorAvailabilityStatus.PAUSED);
    expect(openResult.operationalDelta).toBeGreaterThan(pausedResult.operationalDelta);
    expect(pausedResult.rightNowLabel).toBe("Paused right now");
  });

  it("treats sponsor blackout windows as a stronger right-now penalty", () => {
    const blackedOutSponsor: Sponsor = {
      ...alignedSponsor,
      id: "sponsor-4",
      blackoutUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      blackoutReason: "Avoid new outreach during current grant board cycle.",
    };

    const result = computeSponsorMatch(candidate, blackedOutSponsor, artifacts, claims, edges, {
      sponsorActivities: [
        {
          activityType: "MEETING_SCHEDULED",
          status: "COMPLETED",
          detail: "Keeps sponsor meetings moving.",
        },
      ],
      sponsorPipelineItems: [
        {
          stage: "UNDER_REVIEW",
          outcomeNote: null,
        },
      ],
      sponsorOutcomes: [{ verdict: "POSITIVE" }],
    });

    expect(result.rightNowLabel).toBe("Timing blackout");
    expect(result.operatingProfile.blackoutActive).toBe(true);
    expect(result.breakdown.sponsorCapacity).toBeLessThan(6);
  });
});
