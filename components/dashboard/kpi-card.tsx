import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <Card className="px-5 py-5">
      <Badge variant="muted">{label}</Badge>
      <p className="mt-5 font-serif text-4xl text-ink-900">{value}</p>
      <p className="mt-2 text-sm text-ink-500">{detail}</p>
    </Card>
  );
}
