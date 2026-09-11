import { ArtifactType, ProofRequestStatus, ProofRequestType } from "@prisma/client";

import {
  buildProofRequestDefaultDueAt,
  buildProofRequestSlaState,
  buildProofRequestSuggestions,
  getProofRequestArtifactSuggestion,
  getProofRequestSlaDays,
  getProofRequestSubmissionGuidance,
} from "@/lib/proof-requests";

describe("proof request suggestions", () => {
  it("turns missing proof and contradiction signals into structured request templates", () => {
    const suggestions = buildProofRequestSuggestions({
      missingProof: [
        "Add third-party corroboration from a mentor, manager, or partner.",
        "Add one more quantified result so the sponsorship case is not purely narrative.",
        "Add one clearer example of leadership or ownership over other people or systems.",
      ],
      potentialContradictions: [
        "resume and reflection may conflict on whether the work is completed or still provisional.",
      ],
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestType: ProofRequestType.CONTRADICTION_REVIEW,
          title: "Resolve conflicting evidence",
        }),
        expect.objectContaining({
          requestType: ProofRequestType.THIRD_PARTY_CORROBORATION,
        }),
        expect.objectContaining({
          requestType: ProofRequestType.QUANTIFIED_OUTCOME,
        }),
        expect.objectContaining({
          requestType: ProofRequestType.OWNERSHIP_EXAMPLE,
        }),
      ]),
    );
  });

  it("returns stable guidance and artifact suggestions for public proof collection", () => {
    expect(getProofRequestArtifactSuggestion(ProofRequestType.THIRD_PARTY_CORROBORATION)).toBe(
      ArtifactType.RECOMMENDATION,
    );

    const guidance = getProofRequestSubmissionGuidance(ProofRequestType.CONTRADICTION_REVIEW);

    expect(guidance.heading).toBe("Best submission for this request");
    expect(guidance.checklist.join(" ")).toContain("Clarify which version of events is correct");
    expect(guidance.examplePrompt).toContain("pilot did launch");
  });

  it("applies transparent SLA defaults and surfaces overdue proof requests", () => {
    expect(getProofRequestSlaDays(ProofRequestType.CONTRADICTION_REVIEW)).toBe(3);

    const createdAt = new Date("2026-03-01T10:00:00.000Z");
    const defaultDueAt = buildProofRequestDefaultDueAt(ProofRequestType.OWNERSHIP_EXAMPLE, createdAt);

    expect(defaultDueAt.toISOString()).toBe("2026-03-06T23:59:00.000Z");

    const sla = buildProofRequestSlaState({
      requestType: ProofRequestType.OWNERSHIP_EXAMPLE,
      status: ProofRequestStatus.OPEN,
      dueAt: defaultDueAt,
      createdAt,
      now: new Date("2026-03-09T10:00:00.000Z"),
    });

    expect(sla.overdue).toBe(true);
    expect(sla.severity).toBe("danger");
    expect(sla.label).toContain("Overdue");
  });
});
