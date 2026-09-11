import { SponsorActivityStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export function ActivityStatusBadge({ status }: { status: SponsorActivityStatus | string }) {
  if (status === SponsorActivityStatus.COMPLETED || status === "COMPLETED") {
    return <Badge variant="sage">Completed</Badge>;
  }

  if (status === SponsorActivityStatus.BLOCKED || status === "BLOCKED") {
    return <Badge variant="danger">Blocked</Badge>;
  }

  return <Badge variant="gold">Pending</Badge>;
}
