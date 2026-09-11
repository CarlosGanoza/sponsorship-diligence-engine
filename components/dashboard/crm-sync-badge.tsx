import { CrmSyncStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

export function CrmSyncBadge({ status }: { status: CrmSyncStatus | string }) {
  if (status === CrmSyncStatus.SYNCED || status === "SYNCED") {
    return <Badge variant="sage">Synced</Badge>;
  }

  if (status === CrmSyncStatus.FALLBACK || status === "FALLBACK") {
    return <Badge variant="gold">Fallback</Badge>;
  }

  return <Badge variant="danger">Failed</Badge>;
}
