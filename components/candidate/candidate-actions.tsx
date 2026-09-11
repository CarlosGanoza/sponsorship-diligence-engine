"use client";

import { startTransition, useState } from "react";

import { Button } from "@/components/ui/button";

export function CandidateActions({
  candidateId,
  staleRecommendationCount = 0,
  watchRecommendationCount = 0,
}: {
  candidateId: string;
  staleRecommendationCount?: number;
  watchRecommendationCount?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const destinationByAction = {
    extract: "evidence",
    memo: "memo",
    match: "actions",
    brief: "briefs",
  } as const;

  const run = (
    label: keyof typeof destinationByAction,
  ) => {
    setError(null);
    setPendingAction(label);
    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidateId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: label }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            targetTab?: string;
          }
        | null;
      setPendingAction(null);
      if (!response.ok || !result?.success) {
        setError(result?.error ?? "The action could not be completed.");
        return;
      }

      const targetTab = result.targetTab ?? destinationByAction[label];
      window.location.assign(`/candidates/${candidateId}?tab=${targetTab}&refresh=${Date.now()}`);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={pendingAction !== null}
          onClick={() => run("extract")}
          variant="secondary"
        >
          {pendingAction === "extract" ? "Extracting..." : "Extract signals"}
        </Button>
        <Button
          disabled={pendingAction !== null}
          onClick={() => run("memo")}
        >
          {pendingAction === "memo" ? "Generating memo..." : "Generate memo"}
        </Button>
        <Button
          disabled={pendingAction !== null}
          onClick={() => run("match")}
          variant="subtle"
        >
          {pendingAction === "match" ? "Matching sponsors..." : "Find best sponsor"}
        </Button>
        <Button
          disabled={pendingAction !== null}
          onClick={() => run("brief")}
          variant="ghost"
        >
          {pendingAction === "brief" ? "Generating briefs..." : "Generate briefs"}
        </Button>
      </div>
      <p className="text-xs leading-5 text-ink-500">
        {staleRecommendationCount > 0
          ? `${staleRecommendationCount} recommendation${staleRecommendationCount === 1 ? "" : "s"} are stale and should be refreshed before external use.`
          : watchRecommendationCount > 0
            ? `${watchRecommendationCount} recommendation${watchRecommendationCount === 1 ? "" : "s"} are drifting and worth checking against the latest file.`
            : "Regenerating evidence or recommendations resets their human review state back to pending, and strict evidence mode can push weak outputs back into review."}
      </p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
