import { Card } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils/format";
import { titleCase } from "@/lib/utils/strings";

export function ScoreBreakdownCard({
  title,
  score,
  breakdown,
}: {
  title: string;
  score: number;
  breakdown: Record<string, number>;
}) {
  const maxValue = Math.max(...Object.values(breakdown), 1);

  return (
    <Card className="px-5 py-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-900">{title}</p>
          <p className="mt-1 text-sm text-ink-500">Transparent heuristic breakdown</p>
        </div>
        <p className="font-serif text-4xl text-ink-900">{score}</p>
      </div>
      <div className="mt-5 space-y-4">
        {Object.entries(breakdown).map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-600">{titleCase(key)}</span>
              <span className="font-medium text-ink-900">{value}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-ink-100">
              <div
                className="h-2 rounded-full bg-sage-600"
                style={{ width: formatPercent((value / maxValue) * 100) }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
