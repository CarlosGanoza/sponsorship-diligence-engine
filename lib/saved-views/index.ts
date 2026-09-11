import { SavedViewPage } from "@prisma/client";

export const SAVED_VIEW_PAGE_LABELS: Record<SavedViewPage, string> = {
  CANDIDATES: "Candidates",
  TASKS: "Tasks",
  PIPELINE: "Pipeline",
  ALERTS: "Alerts",
};

export function normalizeSavedViewQueryString(input: string) {
  const params = new URLSearchParams(input);
  const normalized = new URLSearchParams();

  for (const [key, value] of Array.from(params.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    if (!value.trim()) {
      continue;
    }

    normalized.set(key, value);
  }

  return normalized.toString();
}

export function buildSavedViewQueryString(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (!value?.trim()) {
      continue;
    }

    params.set(key, value);
  }

  return normalizeSavedViewQueryString(params.toString());
}
