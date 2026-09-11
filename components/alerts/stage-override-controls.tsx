"use client";

import { AutomationMode, CandidateStage } from "@prisma/client";
import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const stageOptions = [
  CandidateStage.INTAKE,
  CandidateStage.REVIEW,
  CandidateStage.MEMO_READY,
  CandidateStage.SPONSOR_OUTREACH,
  CandidateStage.HOLD,
];

export function StageOverrideControls({
  candidateId,
  currentStage,
  automationMode,
  initialNote,
}: {
  candidateId: string;
  currentStage: CandidateStage;
  automationMode: AutomationMode;
  initialNote?: string | null;
}) {
  const [selectedStage, setSelectedStage] = useState<CandidateStage>(currentStage);
  const [rationale, setRationale] = useState(
    initialNote ??
      "Operator override applied after reviewing trajectory, evidence quality, and current sponsor-path readiness.",
  );
  const [actorLabel, setActorLabel] = useState("Operator");
  const [pending, setPending] = useState<"override" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = (action: "override" | "resume") => {
    setError(null);
    setPending(action);

    startTransition(async () => {
      const response = await fetch(`/api/candidates/${candidateId}/automation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          action === "override"
            ? {
                action,
                stage: selectedStage,
                rationale,
                actorLabel,
              }
            : {
                action,
                rationale,
                actorLabel,
              },
        ),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
          }
        | null;

      setPending(null);

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Automation action failed.");
        return;
      }

      window.location.assign(`/candidates/${candidateId}?tab=trajectory&refresh=${Date.now()}`);
    });
  };

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <div className="grid gap-4 md:grid-cols-[0.75fr_1.25fr]">
        <div>
          <Label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`stage-${candidateId}`}>
            Override stage
          </Label>
          <select
            className="mt-3 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id={`stage-${candidateId}`}
            onChange={(event) => setSelectedStage(event.target.value as CandidateStage)}
            value={selectedStage}
          >
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`actor-${candidateId}`}>
            Actor label
          </Label>
          <Input
            className="mt-3"
            id={`actor-${candidateId}`}
            onChange={(event) => setActorLabel(event.target.value)}
            value={actorLabel}
          />
        </div>
      </div>

      <Label className="mt-4 block text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`rationale-${candidateId}`}>
        Justification
      </Label>
      <Textarea
        className="mt-3 min-h-28 bg-ink-50"
        id={`rationale-${candidateId}`}
        onChange={(event) => setRationale(event.target.value)}
        value={rationale}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={pending !== null}
          onClick={() => runAction("override")}
          size="sm"
          variant="secondary"
        >
          {pending === "override" ? "Applying..." : "Apply manual override"}
        </Button>
        <Button
          disabled={pending !== null || automationMode !== AutomationMode.MANUAL_OVERRIDE}
          onClick={() => runAction("resume")}
          size="sm"
          variant="ghost"
        >
          {pending === "resume" ? "Resuming..." : "Resume automation"}
        </Button>
      </div>

      {automationMode === AutomationMode.MANUAL_OVERRIDE ? (
        <p className="mt-3 text-sm leading-6 text-ink-500">
          Automation is currently paused for this file until an operator resumes it.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
