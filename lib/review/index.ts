import { ReviewStatus } from "@prisma/client";

export type ReviewSummaryStatus = "not_started" | "pending" | "approved" | "flagged";

export type ReviewSummary = {
  total: number;
  approved: number;
  pending: number;
  flagged: number;
  status: ReviewSummaryStatus;
};

export function summarizeReviewStatuses(statuses: ReviewStatus[]): ReviewSummary {
  const approved = statuses.filter((status) => status === ReviewStatus.APPROVED).length;
  const pending = statuses.filter((status) => status === ReviewStatus.PENDING).length;
  const flagged = statuses.filter((status) => status === ReviewStatus.FLAGGED).length;
  const total = statuses.length;

  if (total === 0) {
    return {
      total,
      approved,
      pending,
      flagged,
      status: "not_started",
    };
  }

  if (flagged > 0) {
    return {
      total,
      approved,
      pending,
      flagged,
      status: "flagged",
    };
  }

  if (pending > 0) {
    return {
      total,
      approved,
      pending,
      flagged,
      status: "pending",
    };
  }

  return {
    total,
    approved,
    pending,
    flagged,
    status: "approved",
  };
}

export function combineReviewSummaries(summaries: ReviewSummary[]): ReviewSummary {
  return summarizeReviewStatuses(
    summaries.flatMap((summary) => [
      ...Array.from({ length: summary.approved }, () => ReviewStatus.APPROVED),
      ...Array.from({ length: summary.pending }, () => ReviewStatus.PENDING),
      ...Array.from({ length: summary.flagged }, () => ReviewStatus.FLAGGED),
    ]),
  );
}
