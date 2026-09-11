import { ReviewStatus } from "@prisma/client";

import { combineReviewSummaries, summarizeReviewStatuses } from "@/lib/review";

describe("review summaries", () => {
  it("marks flagged review states as highest priority", () => {
    const summary = summarizeReviewStatuses([
      ReviewStatus.APPROVED,
      ReviewStatus.PENDING,
      ReviewStatus.FLAGGED,
    ]);

    expect(summary).toEqual({
      total: 3,
      approved: 1,
      pending: 1,
      flagged: 1,
      status: "flagged",
    });
  });

  it("combines separate evidence and recommendation summaries", () => {
    const summary = combineReviewSummaries([
      summarizeReviewStatuses([ReviewStatus.APPROVED, ReviewStatus.PENDING]),
      summarizeReviewStatuses([ReviewStatus.APPROVED]),
    ]);

    expect(summary).toEqual({
      total: 3,
      approved: 2,
      pending: 1,
      flagged: 0,
      status: "pending",
    });
  });
});
