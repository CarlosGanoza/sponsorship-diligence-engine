export function hashText(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function seededNumber(seed: string, min: number, max: number) {
  const hash = hashText(seed);
  const normalized = (hash % 10_000) / 10_000;
  return min + normalized * (max - min);
}
