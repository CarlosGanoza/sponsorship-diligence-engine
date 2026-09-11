import { CandidateUpdateStatus } from "@prisma/client";

export const CANDIDATE_UPDATE_STATUS_LABELS: Record<CandidateUpdateStatus, string> = {
  SUBMITTED: "Submitted",
  NEEDS_FOLLOW_UP: "Needs follow-up",
  INCORPORATED: "Incorporated",
};
