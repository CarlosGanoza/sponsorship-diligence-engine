import { BriefStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export function BriefStatusBadge({ status }: { status: BriefStatus | string }) {
  if (status === BriefStatus.READY || status === "READY") {
    return <Badge variant="sage">Ready</Badge>;
  }

  if (status === BriefStatus.HOLD || status === "HOLD") {
    return <Badge variant="danger">Hold</Badge>;
  }

  return <Badge variant="gold">Draft</Badge>;
}
