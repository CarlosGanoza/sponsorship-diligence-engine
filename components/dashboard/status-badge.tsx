import { MemoStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export function StatusBadge({
  status,
}: {
  status: string | MemoStatus;
}) {
  if (status === "ready" || status === MemoStatus.READY || status === "MEMO_READY") {
    return <Badge variant="sage">Ready</Badge>;
  }

  if (status === "processing" || status === MemoStatus.PROCESSING || status === "REVIEW") {
    return <Badge variant="gold">Processing</Badge>;
  }

  if (status === "needs_review" || status === MemoStatus.NEEDS_REVIEW) {
    return <Badge variant="danger">Needs review</Badge>;
  }

  return <Badge variant="muted">Not started</Badge>;
}
