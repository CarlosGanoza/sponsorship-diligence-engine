import { DeliveryStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export function DeliveryStatusBadge({
  status,
}: {
  status: DeliveryStatus;
}) {
  if (status === DeliveryStatus.SENT) {
    return <Badge variant="sage">Sent</Badge>;
  }

  if (status === DeliveryStatus.FAILED) {
    return <Badge variant="danger">Failed</Badge>;
  }

  return <Badge variant="muted">Skipped</Badge>;
}
