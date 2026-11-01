export function textSimilarity(first: string, second: string): number {
  const terms = (value: string) => new Set(
    value.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [],
  );
  const left = terms(first);
  const right = terms(second);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  const intersection = [...left].filter((term) => right.has(term)).length;
  return intersection / union.size;
}

export function duplicateScore(text: number, distanceMeters: number, hoursApart: number): {
  score: number;
  reasons: string[];
} {
  const proximity = Math.max(0, 1 - distanceMeters / 1500);
  const recency = Math.max(0, 1 - hoursApart / 24);
  const score = Math.round((text * 0.5 + proximity * 0.3 + recency * 0.2) * 1000) / 1000;
  const reasons = [
    `Same category and within ${Math.round(distanceMeters)} m`,
    `Submitted ${Math.round(hoursApart * 10) / 10} hours apart`,
  ];
  if (text > 0) reasons.push(`Description token overlap ${Math.round(text * 100)}%`);
  return { score, reasons };
}
