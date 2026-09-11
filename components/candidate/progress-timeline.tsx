import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrajectoryBadge } from "@/components/dashboard/trajectory-badge";

type ProgressItem = {
  id: string;
  label: string;
  summary: string;
  stage: string;
  readinessScore: number;
  topSponsorMatchScore: number;
  artifactCount: number;
  evidenceClaimCount: number;
  highSignalClaimCount: number;
  approvedItemCount: number;
  flaggedItemCount: number;
  capturedAtLabel: string;
};

export function ProgressTimeline({
  momentum,
  items,
}: {
  momentum: "accelerating" | "building" | "steady" | "slipping" | "needs_attention";
  items: ProgressItem[];
}) {
  return (
    <Card className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-900">Progress timeline</p>
          <p className="mt-1 text-sm text-ink-500">Each snapshot records what changed in the sponsorship case.</p>
        </div>
        <TrajectoryBadge momentum={momentum} />
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div className="relative rounded-[1.75rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
            {index < items.length - 1 ? (
              <div className="absolute left-8 top-full h-4 w-px bg-ink-200" />
            ) : null}
            <div className="flex items-start gap-4">
              <div className="mt-1 h-8 w-8 shrink-0 rounded-full border border-sage-200 bg-sage-100" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink-900">{item.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">{item.capturedAtLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{item.stage.replaceAll("_", " ")}</Badge>
                    <Badge variant="sage">Readiness {item.readinessScore}</Badge>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-7 text-ink-600">{item.summary}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.25rem] bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Evidence</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      {item.artifactCount} artifacts · {item.evidenceClaimCount} claims
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">High-value signals</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">{item.highSignalClaimCount} strong claims cited</p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Review and fit</p>
                    <p className="mt-2 text-sm leading-6 text-ink-700">
                      {item.approvedItemCount} approved · {item.flaggedItemCount} flagged · sponsor fit {item.topSponsorMatchScore}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 ? <p className="text-sm text-ink-500">No progress snapshots have been recorded yet.</p> : null}
      </div>
    </Card>
  );
}
