"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DecisionType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CandidateDecisionForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [decisionType, setDecisionType] = useState<DecisionType>(DecisionType.ADVANCE);
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <p className="text-sm font-medium text-ink-900">Record decision</p>
      <p className="mt-1 text-sm text-ink-500">
        Capture why the file moved, paused, or stayed internal so future operators inherit the reasoning.
      </p>
      <div className="mt-4 grid gap-3">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setDecisionType(event.target.value as DecisionType)}
          value={decisionType}
        >
          {Object.values(DecisionType).map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <Input
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Short decision summary"
          value={summary}
        />
        <Textarea
          onChange={(event) => setRationale(event.target.value)}
          placeholder="Why did this move? What evidence or risk drove the decision?"
          rows={4}
          value={rationale}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-ink-500">Decision logs do not overwrite memo output or AI recommendations.</p>
          <Button
            disabled={pending || !hydrated}
            onClick={async () => {
              setPending(true);
              setError(null);
              setSuccess(null);

              const response = await fetch(`/api/candidates/${candidateId}/decisions`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  decisionType,
                  summary,
                  rationale,
                }),
              }).catch(() => null);
              setPending(false);

              if (!response?.ok) {
                setError("Decision log save failed.");
                return;
              }

              setSummary("");
              setRationale("");
              setDecisionType(DecisionType.ADVANCE);
              setSuccess("Decision saved. Refreshing workflow.");
              router.refresh();
            }}
            size="sm"
            variant="secondary"
          >
            {pending ? "Saving..." : "Save decision"}
          </Button>
        </div>
      </div>
      {success ? <p className="mt-2 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
