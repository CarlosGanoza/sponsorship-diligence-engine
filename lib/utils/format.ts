export function formatDate(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function toFixedNumber(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}
