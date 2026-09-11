import { detectContactDetails } from "@/lib/privacy/pii";

describe("privacy contact-detail detection", () => {
  it("redacts and separates internal from sponsor-facing contact details", () => {
    const result = detectContactDetails([
      {
        scope: "internal",
        sourceLabel: "Resume",
        text: "maya.rios@example.com\n(510) 555-0134",
      },
      {
        scope: "sponsor_facing",
        sourceLabel: "Executive summary",
        text: "Reach Maya at maya.rios@example.com after the meeting.",
      },
    ]);

    expect(result.internalFindings).toHaveLength(2);
    expect(result.sponsorFacingFindings).toHaveLength(1);
    expect(result.sponsorFacingSummaries[0]).toContain("m***@example.com");
    expect(result.internalSummaries.some((item) => item.includes("(***) ***-0134"))).toBe(true);
  });
});
