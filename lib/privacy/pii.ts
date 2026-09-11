import { dedupeStrings } from "@/lib/utils/strings";

export type ContactDetailKind = "EMAIL" | "PHONE";
export type ContactDetailScope = "internal" | "sponsor_facing";

export type ContactDetailFinding = {
  kind: ContactDetailKind;
  scope: ContactDetailScope;
  sourceLabel: string;
  match: string;
  redactedMatch: string;
  snippet: string;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/gu;

function redactEmail(value: string) {
  const [localPart, domain] = value.split("@");

  if (!localPart || !domain) {
    return "[redacted email]";
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

function redactPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const lastFour = digits.slice(-4);

  if (!lastFour) {
    return "[redacted phone]";
  }

  return `(***) ***-${lastFour}`;
}

function buildSnippet(text: string, match: string, redactedMatch: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const lowerText = normalizedText.toLowerCase();
  const lowerMatch = match.toLowerCase();
  const startIndex = lowerText.indexOf(lowerMatch);

  if (startIndex === -1) {
    return redactedMatch;
  }

  const previewStart = Math.max(0, startIndex - 24);
  const previewEnd = Math.min(normalizedText.length, startIndex + match.length + 24);
  const preview = normalizedText.slice(previewStart, previewEnd);
  const replaced = preview.replace(new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), redactedMatch);

  return `${previewStart > 0 ? "..." : ""}${replaced}${previewEnd < normalizedText.length ? "..." : ""}`;
}

function buildRedactedMatch(kind: ContactDetailKind, match: string) {
  return kind === "EMAIL" ? redactEmail(match) : redactPhone(match);
}

function collectMatches(pattern: RegExp, text: string) {
  return Array.from(text.matchAll(new RegExp(pattern.source, pattern.flags)), (match) => match[0]?.trim() ?? "").filter(Boolean);
}

export function detectContactDetails(
  entries: Array<{
    scope: ContactDetailScope;
    sourceLabel: string;
    text: string;
  }>,
) {
  const findings: ContactDetailFinding[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!entry.text.trim()) {
      continue;
    }

    const matches = [
      ...collectMatches(EMAIL_PATTERN, entry.text).map((match) => ({ kind: "EMAIL" as const, match })),
      ...collectMatches(PHONE_PATTERN, entry.text).map((match) => ({ kind: "PHONE" as const, match })),
    ];

    for (const item of matches) {
      const key = `${entry.scope}:${entry.sourceLabel}:${item.kind}:${item.match.toLowerCase()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      const redactedMatch = buildRedactedMatch(item.kind, item.match);

      findings.push({
        kind: item.kind,
        scope: entry.scope,
        sourceLabel: entry.sourceLabel,
        match: item.match,
        redactedMatch,
        snippet: buildSnippet(entry.text, item.match, redactedMatch),
      });
    }
  }

  const internalFindings = findings.filter((finding) => finding.scope === "internal");
  const sponsorFacingFindings = findings.filter((finding) => finding.scope === "sponsor_facing");

  return {
    findings,
    internalFindings,
    sponsorFacingFindings,
    uniqueKinds: dedupeStrings(findings.map((finding) => finding.kind.toLowerCase())),
    internalSummaries: internalFindings.map(
      (finding) => `${finding.sourceLabel} · ${finding.kind.toLowerCase()} · ${finding.redactedMatch}`,
    ),
    sponsorFacingSummaries: sponsorFacingFindings.map(
      (finding) => `${finding.sourceLabel} · ${finding.kind.toLowerCase()} · ${finding.redactedMatch}`,
    ),
  };
}
