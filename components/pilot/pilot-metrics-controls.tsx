"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PilotMetricsControls({ hasBaseline }: { hasBaseline: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"baseline" | "checkpoint" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [averageReviewMinutes, setAverageReviewMinutes] = useState("45");
  const [sampledReviewCount, setSampledReviewCount] = useState("6");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  async function capture(type: "baseline" | "checkpoint") {
    setPending(type);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/pilot/snapshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshotType: type,
          averageReviewMinutes: averageReviewMinutes ? Number(averageReviewMinutes) : null,
          sampledReviewCount: sampledReviewCount ? Number(sampledReviewCount) : null,
        }),
      });

      if (!response.ok) {
        setError("Could not capture the pilot snapshot.");
        return;
      }

      setSuccess(type === "baseline" ? "Baseline captured. Refreshing ROI." : "Checkpoint captured. Refreshing ROI.");
      router.refresh();
    } catch {
      setError("Could not capture the pilot snapshot.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        aria-label="Average review minutes"
        className="h-10 w-28 rounded-2xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
        min="1"
        onChange={(event) => setAverageReviewMinutes(event.target.value)}
        placeholder="Avg min"
        type="number"
        value={averageReviewMinutes}
      />
      <input
        aria-label="Review sample size"
        className="h-10 w-28 rounded-2xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
        min="1"
        onChange={(event) => setSampledReviewCount(event.target.value)}
        placeholder="Sample size"
        type="number"
        value={sampledReviewCount}
      />
      <Button
        disabled={!hydrated || pending !== null}
        onClick={() => capture("baseline")}
        size="sm"
        variant={hasBaseline ? "secondary" : "primary"}
      >
        {pending === "baseline" ? "Capturing..." : hasBaseline ? "Refresh baseline" : "Capture baseline"}
      </Button>
      <Button disabled={!hydrated || pending !== null} onClick={() => capture("checkpoint")} size="sm" variant="secondary">
        {pending === "checkpoint" ? "Capturing..." : "Capture checkpoint"}
      </Button>
      {success ? <p className="text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
