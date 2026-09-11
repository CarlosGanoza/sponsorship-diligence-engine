import {
  advocacyActionSchema,
  evidenceExtractionSchema,
  sponsorMatchExplanationSchema,
  sponsorMemoSchema,
} from "@/lib/ai/schemas";

describe("AI output schemas", () => {
  it("accepts a valid evidence extraction payload", () => {
    const result = evidenceExtractionSchema.safeParse({
      claims: [
        {
          category: "initiative",
          claim: "Shows initiative through launching a neighborhood pilot.",
          confidence: 0.81,
          supportingExcerpt: "Launched a neighborhood pilot",
          tags: ["climate", "community"],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed sponsor memo output", () => {
    const result = sponsorMemoSchema.safeParse({
      executiveSummary: "",
      whyWorthBacking: "Grounded in evidence",
      strongestSignals: ["Signal one"],
      risks: [],
      bestFitOpportunityTypes: [],
      recommendedNextAction: "",
      memoMarkdown: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts action and match explanation payloads", () => {
    expect(
      advocacyActionSchema.safeParse({
        decision: "hold",
        action: "Prepare a sponsor brief and request a warm introduction.",
        rationale: "The evidence set is credible enough for a targeted ask.",
        requiredProof: ["One more third-party leadership example."],
        whyNotNow: ["Leadership proof is still too thin for external advocacy."],
      }).success,
    ).toBe(true);

    expect(
      sponsorMatchExplanationSchema.safeParse({
        whyFit: "This sponsor fits the candidate's operating domain and style.",
        signalDrivers: ["Leadership", "Follow Through"],
        connectionPath: ["Candidate -> Operator", "Operator -> Sponsor"],
        missingProof: ["A more quantified leadership result."],
        scoreSummary: "Match score 78/100.",
      }).success,
    ).toBe(true);
  });
});
