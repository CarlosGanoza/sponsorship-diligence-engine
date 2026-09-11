import { ReviewStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import type { ReviewSummaryStatus } from "@/lib/review";

export function ReviewBadge({
  status,
}: {
  status: ReviewSummaryStatus | ReviewStatus;
}) {
  if (status === "approved" || status === ReviewStatus.APPROVED) {
    return <Badge variant="sage">Approved</Badge>;
  }

  if (status === "pending" || status === ReviewStatus.PENDING) {
    return <Badge variant="gold">Pending review</Badge>;
  }

  if (status === "flagged" || status === ReviewStatus.FLAGGED) {
    return <Badge variant="danger">Flagged</Badge>;
  }

  return <Badge variant="muted">Not reviewed</Badge>;
}
