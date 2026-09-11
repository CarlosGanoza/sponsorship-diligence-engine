import { Card } from "@/components/ui/card";
import { TrajectoryBadge } from "@/components/dashboard/trajectory-badge";
import { formatSignedNumber } from "@/lib/utils/format";

type TrendPoint = {
  id: string;
  label: string;
  readinessScore: number;
  topSponsorMatchScore: number;
  capturedAtLabel: string;
};

export function ReadinessTrendCard({
  score,
  deltaFromStart,
  deltaFromPrevious,
  artifactDelta,
  claimDelta,
  sponsorMatchDelta,
  momentum,
  points,
}: {
  score: number;
  deltaFromStart: number;
  deltaFromPrevious: number;
  artifactDelta: number;
  claimDelta: number;
  sponsorMatchDelta: number;
  momentum: "accelerating" | "building" | "steady" | "slipping" | "needs_attention";
  points: TrendPoint[];
}) {
  const maxScore = Math.max(...points.map((point) => point.readinessScore), 1);

  return (
    <Card className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-900">Conviction trend</p>
          <p className="mt-1 text-sm text-ink-500">Readiness, signal depth, and sponsor fit as the case matures.</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-4xl text-ink-900">{score}</p>
          <div className="mt-2 flex justify-end">
            <TrajectoryBadge momentum={momentum} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Since intake</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{formatSignedNumber(deltaFromStart)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Latest move</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{formatSignedNumber(deltaFromPrevious)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Artifacts and claims</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">
            {formatSignedNumber(artifactDelta)} / {formatSignedNumber(claimDelta)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Top sponsor fit</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{formatSignedNumber(sponsorMatchDelta)}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3">
          {points.map((point) => (
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-3 py-4" key={point.id}>
              <div className="flex h-24 items-end rounded-2xl bg-ink-50 px-2 pb-2">
                <div
                  className="w-full rounded-2xl bg-sage-600"
                  style={{ height: `${Math.max((point.readinessScore / maxScore) * 100, 10)}%` }}
                />
              </div>
              <p className="mt-3 font-medium text-ink-900">{point.readinessScore}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">{point.capturedAtLabel}</p>
              <p className="mt-2 text-sm leading-6 text-ink-500">{point.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
