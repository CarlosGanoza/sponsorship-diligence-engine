import { AlertSeverity } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export function AlertSeverityBadge({
  severity,
}: {
  severity: AlertSeverity;
}) {
  if (severity === AlertSeverity.ACTION) {
    return <Badge variant="sage">Action</Badge>;
  }

  if (severity === AlertSeverity.CAUTION) {
    return <Badge variant="danger">Caution</Badge>;
  }

  return <Badge variant="muted">Info</Badge>;
}
