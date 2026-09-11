"use client";

import { CommitteeVoteDecision } from "@prisma/client";
import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  castCommitteeVoteAction,
  finalizeCommitteeReviewAction,
  requestCommitteeReviewAction,
} from "@/app/actions";
import { COMMITTEE_VOTE_LABELS } from "@/lib/committee/reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TeamMember = {
  id: string;
  name: string;
  role: string;
};

type Review = {
  id: string;
  title: string;
  summary: string;
  status: string;
  statusLabel: string;
  consensusLabel: string;
  dueAt: Date | string | null;
  dueAtLabel: string | null;
  finalDecisionLabel: string | null;
  finalNote: string | null;
  voteSummary: {
    total: number;
    advance: number;
    hold: number;
    doNotAdvance: number;
    requestMoreProof: number;
  };
  createdBy?: { name: string | null } | null;
  chairUser?: { name: string | null } | null;
  votes: Array<{
    id: string;
    decision: CommitteeVoteDecision;
    decisionLabel: string;
    rationale: string;
    user: { name: string | null };
    updatedAtLabel: string;
  }>;
};

export function CommitteeReviewControls({
  candidateId,
  reviews,
  teamMembers,
}: {
  candidateId: string;
  reviews: Review[];
  teamMembers: TeamMember[];
}) {
  const router = useRouter();
  const [createTitle, setCreateTitle] = useState("Committee underwriting review");
  const [createSummary, setCreateSummary] = useState(
    "Use committee review when the decision needs explicit multi-operator signoff before sponsor-facing movement.",
  );
  const [chairUserId, setChairUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [voteDecisionByReviewId, setVoteDecisionByReviewId] = useState<Record<string, CommitteeVoteDecision>>({});
  const [voteRationaleByReviewId, setVoteRationaleByReviewId] = useState<Record<string, string>>({});
  const [finalDecisionByReviewId, setFinalDecisionByReviewId] = useState<Record<string, CommitteeVoteDecision>>({});
  const [finalNoteByReviewId, setFinalNoteByReviewId] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultVoteDecision = useMemo(
    () => CommitteeVoteDecision.REQUEST_MORE_PROOF,
    [],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
        <p className="text-sm font-medium text-ink-900">Open committee review</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="committee-title">Title</Label>
            <Input id="committee-title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="committee-chair">Chair</Label>
            <select
              className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              id="committee-chair"
              value={chairUserId}
              onChange={(event) => setChairUserId(event.target.value)}
            >
              <option value="">No chair assigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="committee-summary">Summary</Label>
          <Textarea id="committee-summary" value={createSummary} onChange={(event) => setCreateSummary(event.target.value)} />
        </div>
        <div className="mt-4 max-w-xs">
          <Label htmlFor="committee-due">Due date</Label>
          <Input id="committee-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </div>
        <div className="mt-4">
          <Button
            disabled={pending !== null}
            onClick={() => {
              setPending("create");
              setError(null);
              startTransition(async () => {
                const result = await requestCommitteeReviewAction(candidateId, {
                  title: createTitle,
                  summary: createSummary,
                  chairUserId: chairUserId || undefined,
                  dueAt: dueAt || undefined,
                });
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not open committee review.");
                  return;
                }
                router.refresh();
              });
            }}
            size="sm"
          >
            {pending === "create" ? "Opening..." : "Open review"}
          </Button>
        </div>
      </div>

      {reviews.map((review) => (
        <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={review.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={review.status === "FINALIZED" ? "sage" : "gold"}>{review.statusLabel}</Badge>
                <Badge variant="muted">{review.consensusLabel}</Badge>
              </div>
              <p className="mt-3 font-medium text-ink-900">{review.title}</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{review.summary}</p>
              {review.finalDecisionLabel ? (
                <p className="mt-3 text-sm leading-7 text-ink-500">
                  Final decision: {review.finalDecisionLabel}. {review.finalNote ?? ""}
                </p>
              ) : null}
            </div>
            <div className="text-right text-sm text-ink-500">
              {review.createdBy?.name ? <p>Opened by {review.createdBy.name}</p> : null}
              {review.chairUser?.name ? <p className="mt-1">Chair {review.chairUser.name}</p> : null}
              {review.dueAtLabel ? <p className="mt-1">Due {review.dueAtLabel}</p> : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="muted">{review.voteSummary.total} votes</Badge>
            <Badge variant="sage">{review.voteSummary.advance} advance</Badge>
            <Badge variant="gold">{review.voteSummary.requestMoreProof} more proof</Badge>
            <Badge variant="muted">{review.voteSummary.hold} hold</Badge>
            <Badge variant="danger">{review.voteSummary.doNotAdvance} do not advance</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {review.votes.map((vote) => (
              <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-4 py-4" key={vote.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{vote.decisionLabel}</Badge>
                  <p className="text-sm text-ink-600">{vote.user.name ?? "Operator"} · {vote.updatedAtLabel}</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{vote.rationale}</p>
              </div>
            ))}
            {review.votes.length === 0 ? <p className="text-sm text-ink-500">No votes recorded yet.</p> : null}
          </div>

          {review.status !== "FINALIZED" ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Cast your vote</p>
                <div className="mt-4">
                  <Label htmlFor={`vote-${review.id}`}>Decision</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                    id={`vote-${review.id}`}
                    value={voteDecisionByReviewId[review.id] ?? defaultVoteDecision}
                    onChange={(event) =>
                      setVoteDecisionByReviewId((current) => ({
                        ...current,
                        [review.id]: event.target.value as CommitteeVoteDecision,
                      }))
                    }
                  >
                    {Object.values(CommitteeVoteDecision).map((decision) => (
                      <option key={decision} value={decision}>
                        {COMMITTEE_VOTE_LABELS[decision]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <Label htmlFor={`vote-note-${review.id}`}>Rationale</Label>
                  <Textarea
                    id={`vote-note-${review.id}`}
                    value={voteRationaleByReviewId[review.id] ?? ""}
                    onChange={(event) =>
                      setVoteRationaleByReviewId((current) => ({
                        ...current,
                        [review.id]: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="mt-4">
                  <Button
                    disabled={pending !== null}
                    onClick={() => {
                      setPending(`vote-${review.id}`);
                      setError(null);
                      startTransition(async () => {
                        const result = await castCommitteeVoteAction(review.id, {
                          decision: voteDecisionByReviewId[review.id] ?? defaultVoteDecision,
                          rationale:
                            voteRationaleByReviewId[review.id] ??
                            "Committee vote recorded with no additional rationale entered.",
                        });
                        setPending(null);
                        if (!result.success) {
                          setError(result.error ?? "Could not cast committee vote.");
                          return;
                        }
                        router.refresh();
                      });
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    {pending === `vote-${review.id}` ? "Saving..." : "Record vote"}
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Finalize committee signoff</p>
                <div className="mt-4">
                  <Label htmlFor={`final-${review.id}`}>Final decision</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                    id={`final-${review.id}`}
                    value={finalDecisionByReviewId[review.id] ?? CommitteeVoteDecision.REQUEST_MORE_PROOF}
                    onChange={(event) =>
                      setFinalDecisionByReviewId((current) => ({
                        ...current,
                        [review.id]: event.target.value as CommitteeVoteDecision,
                      }))
                    }
                  >
                    {Object.values(CommitteeVoteDecision).map((decision) => (
                      <option key={decision} value={decision}>
                        {COMMITTEE_VOTE_LABELS[decision]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <Label htmlFor={`final-note-${review.id}`}>Final note</Label>
                  <Textarea
                    id={`final-note-${review.id}`}
                    value={finalNoteByReviewId[review.id] ?? ""}
                    onChange={(event) =>
                      setFinalNoteByReviewId((current) => ({
                        ...current,
                        [review.id]: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="mt-4">
                  <Button
                    disabled={pending !== null}
                    onClick={() => {
                      setPending(`final-${review.id}`);
                      setError(null);
                      startTransition(async () => {
                        const result = await finalizeCommitteeReviewAction(review.id, {
                          finalDecision: finalDecisionByReviewId[review.id] ?? CommitteeVoteDecision.REQUEST_MORE_PROOF,
                          finalNote:
                            finalNoteByReviewId[review.id] ??
                            "Final committee rationale recorded with no additional note entered.",
                        });
                        setPending(null);
                        if (!result.success) {
                          setError(result.error ?? "Could not finalize committee review.");
                          return;
                        }
                        router.refresh();
                      });
                    }}
                    size="sm"
                  >
                    {pending === `final-${review.id}` ? "Finalizing..." : "Finalize review"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ))}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
