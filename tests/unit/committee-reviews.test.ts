import { CommitteeReviewStatus, CommitteeVoteDecision } from "@prisma/client";

import {
  buildCommitteeConsensusLabel,
  summarizeCommitteeVotes,
} from "@/lib/committee/reviews";

describe("committee review helpers", () => {
  it("summarizes vote counts by decision", () => {
    const summary = summarizeCommitteeVotes([
      { decision: CommitteeVoteDecision.ADVANCE },
      { decision: CommitteeVoteDecision.ADVANCE },
      { decision: CommitteeVoteDecision.REQUEST_MORE_PROOF },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.advance).toBe(2);
    expect(summary.requestMoreProof).toBe(1);
  });

  it("returns finalized label when the committee review is closed", () => {
    const label = buildCommitteeConsensusLabel({
      status: CommitteeReviewStatus.FINALIZED,
      finalDecision: CommitteeVoteDecision.DO_NOT_ADVANCE,
      votes: [],
    });

    expect(label).toBe("Finalized · Do not advance");
  });
});
