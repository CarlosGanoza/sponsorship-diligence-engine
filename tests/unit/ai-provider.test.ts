import type { AiProvider } from "@/lib/ai/types";
import { createResilientAiProvider } from "@/lib/ai/provider";

const successPayloads = {
  extraction: {
    claims: [
      {
        category: "initiative" as const,
        claim: "Shows initiative through building a pilot.",
        confidence: 0.82,
        supportingExcerpt: "Built a pilot",
        tags: ["climate"],
      },
    ],
  },
  memo: {
    executiveSummary: "Summary",
    whyWorthBacking: "Reason",
    strongestSignals: ["Signal A [Artifact A]"],
    risks: ["Risk A"],
    bestFitOpportunityTypes: ["Operator fellowship"],
    recommendedNextAction: "Next step",
    memoMarkdown: "# Memo",
  },
  action: {
    decision: "advance" as const,
    action: "Prepare a sponsor brief.",
    rationale: "The evidence is credible enough.",
    requiredProof: ["One more third-party note."],
    whyNotNow: [],
  },
  explanation: {
    whyFit: "Strong domain fit.",
    signalDrivers: ["Leadership"],
    connectionPath: ["Candidate -> Operator"],
    missingProof: ["More quantified delivery evidence."],
    scoreSummary: "Match score 78/100.",
  },
};

function createProvider(overrides?: Partial<AiProvider>): AiProvider {
  return {
    extractEvidenceClaims: async () => successPayloads.extraction,
    generateSponsorMemo: async () => successPayloads.memo,
    recommendNextAdvocacyAction: async () => successPayloads.action,
    explainSponsorMatch: async () => successPayloads.explanation,
    ...overrides,
  };
}

describe("resilient AI provider", () => {
  it("uses the live provider when it succeeds", async () => {
    const liveProvider = createProvider();
    const fallbackProvider = createProvider({
      extractEvidenceClaims: async () => {
        throw new Error("Fallback should not run.");
      },
    });
    const provider = createResilientAiProvider({
      liveProvider,
      fallbackProvider,
      liveModel: "gpt-test",
    });

    const result = await provider.extractEvidenceClaims({
      candidate: {
        id: "candidate-1",
        fullName: "Maya",
        headline: "Headline",
        bio: "Bio",
        region: "Oakland, CA",
        currentStage: "REVIEW",
        sponsorReadinessScore: 50,
      },
      artifact: {
        id: "artifact-1",
        artifactType: "PROJECT_SUMMARY",
        title: "Project",
        rawText: "Built a pilot.",
        sourceLabel: "Upload",
        fileName: null,
      },
    });

    expect(result.claims[0]?.claim).toContain("initiative");
  });

  it("falls back to the mock provider when live generation fails", async () => {
    const liveProvider = createProvider({
      generateSponsorMemo: async () => {
        throw new Error("Malformed JSON");
      },
    });
    const fallbackProvider = createProvider({
      generateSponsorMemo: async () => ({
        ...successPayloads.memo,
        executiveSummary: "Fallback summary",
      }),
    });
    const provider = createResilientAiProvider({
      liveProvider,
      fallbackProvider,
      liveModel: "gpt-test",
    });

    const result = await provider.generateSponsorMemo({
      candidate: {
        id: "candidate-1",
        fullName: "Maya",
        headline: "Headline",
        bio: "Bio",
        region: "Oakland, CA",
        currentStage: "REVIEW",
        sponsorReadinessScore: 50,
      },
      artifacts: [],
      claims: [],
      readinessScore: 50,
      readinessBreakdown: {
        evidenceAmount: 10,
        artifactDiversity: 10,
        averageConfidence: 10,
        highValueSignals: 10,
        relationshipStrength: 5,
        profileCompleteness: 5,
        sourceQuality: 5,
        evidenceFreshness: 5,
      },
    });

    expect(result.executiveSummary).toBe("Fallback summary");
  });
});
