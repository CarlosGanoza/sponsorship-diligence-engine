import { buildEmailProviderPayload } from "@/lib/outreach/sender";

describe("outbound sender payloads", () => {
  it("preserves recipient metadata for live and fallback modes", () => {
    const payload = buildEmailProviderPayload("gmail", {
      candidateId: "candidate-1",
      candidateName: "Maya Rios",
      sponsorId: "sponsor-1",
      sponsorName: "Nadia Voss",
      opportunityBriefId: "brief-1",
      draftId: "warm-intro",
      draftLabel: "Warm intro draft",
      recipientLabel: "Operator connector",
      recipientEmail: "connector@example.org",
      subject: "Maya Rios · Warm intro",
      body: "Sharing a sponsor-ready candidate file.",
    });

    expect(payload.message.recipientEmail).toBe("connector@example.org");
    expect("gmailMessage" in payload).toBe(true);
  });
});
