import { Badge } from "@/components/ui/badge";
import type { ProgressMomentum } from "@/lib/progress";

export function TrajectoryBadge({
  momentum,
}: {
  momentum: ProgressMomentum;
}) {
  if (momentum === "accelerating") {
    return <Badge variant="sage">Accelerating</Badge>;
  }

  if (momentum === "building") {
    return <Badge variant="gold">Building</Badge>;
  }

  if (momentum === "slipping") {
    return <Badge variant="danger">Slipping</Badge>;
  }

  if (momentum === "needs_attention") {
    return <Badge variant="danger">Needs attention</Badge>;
  }

  return <Badge variant="muted">Steady</Badge>;
}
