import {
  ArtifactType,
  AutomationMode,
  CandidateStage,
  RecommendationType,
  ReviewStatus,
} from "@prisma/client";

import {
  anonymizeCandidateIdentity,
  auditNarrativeSupport,
  auditMemoSupport,
  buildCandidateSafetyReport,
} from "@/lib/safety/guardrails";

describe("safety guardrails", () => {
  const candidate = {
    id: "candidate-demo-1234",
    organizationId: "org_1",
    fullName: "Maya Rios",
    headline: "Climate operator",
    bio: "Builds climate resilience programs.",
    region: "Oakland, CA",
    currentStage: CandidateStage.REVIEW,
    automationMode: AutomationMode.AUTOMATED,
    automationNote: null,
    automationUpdatedAt: null,
    sponsorReadinessScore: 52,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const artifacts = [
    {
      id: "artifact_1",
      candidateId: candidate.id,
      storedFileId: null,
      supersedesArtifactId: null,
      artifactType: ArtifactType.RESUME,
      title: "Resume",
      rawText: "Led a neighborhood cooling pilot and coordinated city staff across three sites.",
      sourceLabel: "Upload",
      fileName: null,
      versionNumber: 1,
      isCurrentVersion: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const claims = [
    {
      id: "claim_1",
      candidateId: candidate.id,
      artifactId: "artifact_1",
      category: "LEADERSHIP" as const,
      claim: "Provides evidence of leadership in leading a neighborhood cooling pilot.",
      confidence: 0.82,
      supportingExcerpt: "Led a neighborhood cooling pilot and coordinated city staff across three sites.",
      tags: "",
      reviewStatus: ReviewStatus.PENDING,
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("flags unsupported memo language and holds weak files", () => {
    const memoAudit = auditMemoSupport({
      memo: {
        executiveSummary: "Maya built a nationally recognized climate network.",
        whyWorthBacking: "The file proves she can lead local climate work.",
        recommendedNextAction: "Advance now.",
      },
      artifacts,
      claims,
    });

    expect(memoAudit.unsupportedStatements.length).toBeGreaterThan(0);

    const report = buildCandidateSafetyReport({
      candidate,
      artifacts,
      claims,
      recommendations: [
        {
          id: "rec_1",
          candidateId: candidate.id,
          sponsorId: null,
          recommendationType: RecommendationType.NEXT_ACTION,
          score: 52,
          explanation: "Proceed carefully.",
          actionSuggestion: "Advance now.",
          reviewStatus: ReviewStatus.PENDING,
          reviewNote: null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      readinessScore: 52,
      memo: {
        executiveSummary: "Maya built a nationally recognized climate network.",
        whyWorthBacking: "The file proves she can lead local climate work.",
        recommendedNextAction: "Advance now.",
      },
    });

    expect(report.decision).toBe("do_not_advance");
    expect(report.supportCoverage).toBeLessThan(100);
    expect(report.missingProof.length).toBeGreaterThan(0);
  });

  it("audits sponsor-facing narrative sections beyond the base memo", () => {
    const audit = auditNarrativeSupport({
      sections: [
        {
          label: "Brief ask",
          text: "Request a national media introduction for Maya's climate coalition leadership. [Resume]",
        },
        {
          label: "Recommendation explanation",
          text: "The file proves she coordinated city staff across three sites.",
        },
      ],
      artifacts,
      claims,
    });

    expect(audit.supportCoverage).toBeLessThan(100);
    expect(audit.citationCoverage).toBe(50);
    expect(audit.uncitedStatementCount).toBe(1);
    expect(audit.unsupportedRows.some((row) => row.sectionLabel === "Brief ask")).toBe(true);
  });

  it("anonymizes identity for blind review surfaces", () => {
    expect(anonymizeCandidateIdentity(candidate)).toEqual({
      displayName: "Candidate 1234",
      displayHeadline: "Identity masked for blind review.",
      displayRegion: "Region masked",
    });
  });

  it("flags potential contradictions when evidence mixes completed and provisional language", () => {
    const report = buildCandidateSafetyReport({
      candidate,
      artifacts: [
        ...artifacts,
        {
          id: "artifact_2",
          candidateId: candidate.id,
          storedFileId: null,
          supersedesArtifactId: null,
          artifactType: ArtifactType.REFLECTION,
          title: "Reflection",
          rawText: "I am still planning the neighborhood cooling pilot and seeking a first city site for the work.",
          sourceLabel: "Reflection form",
          fileName: null,
          versionNumber: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      claims,
      recommendations: [],
      readinessScore: 61,
      memo: {
        executiveSummary: "Maya led a neighborhood cooling pilot.",
        whyWorthBacking: "The file suggests local climate ownership but still needs cleaner proof.",
        recommendedNextAction: "Hold external outreach until the implementation scope is clarified.",
      },
    });

    expect(report.potentialContradictions.length).toBeGreaterThan(0);
    expect(report.cautionFlags.some((flag) => flag.includes("contradiction"))).toBe(true);
    expect(report.decision).toBe("do_not_advance");
  });

  it("blocks sponsor-facing advancement when ownership claims conflict directly", () => {
    const report = buildCandidateSafetyReport({
      candidate,
      artifacts: [
        {
          ...artifacts[0],
          rawText: "I led the neighborhood cooling pilot, coordinated the city staff, and made the final rollout call.",
        },
        {
          ...artifacts[0],
          id: "artifact_4",
          storedFileId: null,
          supersedesArtifactId: null,
          artifactType: ArtifactType.RECOMMENDATION,
          title: "Recommendation",
          rawText:
            "On the same neighborhood cooling pilot, Maya supported the work under supervision and helped with partner coordination alongside others rather than owning the final rollout.",
          sourceLabel: "Partner note",
        },
      ],
      claims,
      recommendations: [],
      readinessScore: 54,
      memo: {
        executiveSummary: "Maya led the neighborhood cooling pilot.",
        whyWorthBacking: "The ownership case needs to be resolved before external advocacy.",
        recommendedNextAction: "Do not advance until the ownership conflict is resolved.",
      },
    });

    expect(report.blockingContradictions.length).toBeGreaterThan(0);
    expect(report.decision).toBe("do_not_advance");
  });

  it("surfaces stale evidence and duplicate claims", () => {
    const twoYearsAgo = new Date("2023-01-10T00:00:00.000Z");
    const report = buildCandidateSafetyReport({
      candidate,
      artifacts: [
        {
          ...artifacts[0],
          createdAt: twoYearsAgo,
          updatedAt: twoYearsAgo,
        },
        {
          ...artifacts[0],
          id: "artifact_3",
          storedFileId: null,
          supersedesArtifactId: null,
          artifactType: ArtifactType.REFLECTION,
          title: "Reflection",
          rawText: "I am still trying to rebuild the climate operating case.",
          createdAt: twoYearsAgo,
          updatedAt: twoYearsAgo,
        },
      ],
      claims: [
        claims[0],
        {
          ...claims[0],
          id: "claim_2",
          artifactId: "artifact_3",
        },
      ],
      recommendations: [],
      readinessScore: 58,
      memo: {
        executiveSummary: "Maya led a neighborhood cooling pilot.",
        whyWorthBacking: "The current proof needs a fresher operating example.",
        recommendedNextAction: "Hold until the evidence pack is refreshed.",
      },
    });

    expect(report.staleArtifactCount).toBeGreaterThan(0);
    expect(report.duplicateClaimCount).toBeGreaterThan(0);
    expect(report.evidenceFreshnessScore).toBeLessThan(6);
    expect(report.cautionFlags.some((flag) => flag.includes("aging"))).toBe(true);
  });

  it("treats candidate updates and operator notes as contradiction inputs", () => {
    const report = buildCandidateSafetyReport({
      candidate,
      artifacts,
      claims,
      recommendations: [],
      readinessScore: 57,
      memo: {
        executiveSummary: "Maya led a neighborhood cooling pilot.",
        whyWorthBacking: "The file still needs ownership clarification.",
        recommendedNextAction: "Hold until the ownership story is consistent.",
      },
      candidateUpdates: [
        {
          title: "Updated scope",
          summary: "I am still planning the pilot and have not launched it yet.",
        },
      ],
      operatorNotes: [
        {
          title: "Partner diligence",
          content: "The partner note says the pilot already launched across three sites.",
        },
      ],
    });

    expect(report.potentialContradictions.length).toBeGreaterThan(0);
    expect(report.cautionFlags.some((flag) => flag.includes("contradiction"))).toBe(true);
  });

  it("surfaces low citation coverage as a separate evidence-discipline concern", () => {
    const report = buildCandidateSafetyReport({
      candidate,
      artifacts,
      claims,
      recommendations: [],
      readinessScore: 58,
      memo: {
        executiveSummary: "Maya led a neighborhood cooling pilot. [Resume]",
        whyWorthBacking: "The file shows local climate coordination with city staff across three sites.",
        recommendedNextAction: "Hold sponsor outreach until every sentence is explicitly cited.",
      },
    });

    expect(report.citationCoverage).toBeLessThan(100);
    expect(report.uncitedStatementCount).toBeGreaterThan(0);
    expect(report.cautionFlags.some((flag) => flag.includes("citation coverage"))).toBe(true);
    expect(report.uncitedStatements.length).toBeGreaterThan(0);
  });

  it("detects personal contact details and distinguishes internal from sponsor-facing exposure", () => {
    const report = buildCandidateSafetyReport({
      candidate,
      artifacts: [
        {
          ...artifacts[0],
          rawText:
            "Maya Rios\nmaya.rios@example.com\n(510) 555-0134\nLed a neighborhood cooling pilot and coordinated city staff across three sites.",
        },
      ],
      claims,
      recommendations: [],
      readinessScore: 64,
      memo: {
        executiveSummary: "Contact Maya at maya.rios@example.com for next steps.",
        whyWorthBacking: "The underlying file includes direct operating proof.",
        recommendedNextAction: "Hold sponsor-facing export until the contact line is removed.",
      },
    });

    expect(report.internalContactDetailCount).toBeGreaterThan(0);
    expect(report.sponsorFacingContactDetailCount).toBeGreaterThan(0);
    expect(report.sponsorFacingContactDetails.some((item) => item.includes("m***@example.com"))).toBe(true);
    expect(report.cautionFlags.some((flag) => flag.includes("contact detail"))).toBe(true);
    expect(report.missingProof.some((item) => item.includes("Redact personal contact details"))).toBe(true);
  });
});
