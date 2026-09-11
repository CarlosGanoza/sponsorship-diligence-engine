export function parseDelimitedList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeDelimitedList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join("|");
}

export function sentenceCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .map((segment) => sentenceCase(segment))
    .join(" ");
}

export function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function extractBracketCitations(text: string) {
  const citations = dedupeStrings(
    Array.from(text.matchAll(/\[([^\]]+)\]/g), (match) => match[1]?.trim() ?? ""),
  );

  const cleanText = text.replace(/\s*\[[^\]]+\]/g, "").trim();

  return {
    cleanText,
    citations,
  };
}
