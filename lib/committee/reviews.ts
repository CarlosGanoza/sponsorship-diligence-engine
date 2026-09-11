import {
  CommitteeReviewStatus,
  CommitteeVoteDecision,
  type CommitteeReview,
  type CommitteeReviewVote,
} from "@prisma/client";

export const COMMITTEE_REVIEW_STATUS_LABELS: Record<CommitteeReviewStatus, string> = {
  OPEN: "Open",
  VOTING: "Voting",
  FINALIZED: "Finalized",
};

export const COMMITTEE_VOTE_LABELS: Record<CommitteeVoteDecision, string> = {
  ADVANCE: "Advance",
  HOLD: "Hold",
  DO_NOT_ADVANCE: "Do not advance",
  REQUEST_MORE_PROOF: "Request more proof",
};

export function summarizeCommitteeVotes(
  votes: Array<Pick<CommitteeReviewVote, "decision">>,
) {
  const summary = {
    advance: votes.filter((vote) => vote.decision === CommitteeVoteDecision.ADVANCE).length,
    hold: votes.filter((vote) => vote.decision === CommitteeVoteDecision.HOLD).length,
    doNotAdvance: votes.filter((vote) => vote.decision === CommitteeVoteDecision.DO_NOT_ADVANCE).length,
    requestMoreProof: votes.filter((vote) => vote.decision === CommitteeVoteDecision.REQUEST_MORE_PROOF).length,
  };

  return {
    ...summary,
    total: votes.length,
  };
}

export function buildCommitteeConsensusLabel(review: Pick<CommitteeReview, "status" | "finalDecision"> & {
  votes: Array<Pick<CommitteeReviewVote, "decision">>;
}) {
  if (review.status === CommitteeReviewStatus.FINALIZED && review.finalDecision) {
    return `Finalized · ${COMMITTEE_VOTE_LABELS[review.finalDecision]}`;
  }

  const summary = summarizeCommitteeVotes(review.votes);
  const maxCount = Math.max(summary.advance, summary.hold, summary.doNotAdvance, summary.requestMoreProof, 0);

  if (maxCount === 0) {
    return "No votes yet";
  }

  if (summary.advance === maxCount) {
    return "Current lean · Advance";
  }

  if (summary.requestMoreProof === maxCount) {
    return "Current lean · Request more proof";
  }

  if (summary.doNotAdvance === maxCount) {
    return "Current lean · Do not advance";
  }

  return "Current lean · Hold";
}
