import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function ReleaseStatusCard({
  title,
  label,
  variant,
  detail,
  blockers,
}: {
  title: string;
  label: string;
  variant: "muted" | "gold" | "sage" | "danger";
  detail: string;
  blockers?: string[];
}) {
  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-900">{title}</p>
          <p className="mt-1 text-sm text-ink-500">Current operator release posture for this sponsor-facing step.</p>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <p className="mt-4 text-sm leading-7 text-ink-600">{detail}</p>
      {blockers && blockers.length > 1 ? (
        <div className="mt-4 space-y-2">
          {blockers.slice(1, 4).map((blocker) => (
            <p className="text-sm leading-6 text-ink-500" key={blocker}>
              {blocker}
            </p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
