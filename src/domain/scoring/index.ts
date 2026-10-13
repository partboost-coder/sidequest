import type { Candidate, TravelerScore } from "../candidate";

/**
 * Percentile rank of each value within its own list: (below + ½·equal) / n, in (0, 1).
 * Qloo affinities are compressed (~0.71–0.92), so raw values aren't comparable across travelers.
 */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    let below = 0;
    let equal = 0;
    for (const s of sorted) {
      if (s < v) below++;
      else if (s === v) equal++;
      else break;
    }
    return (below + equal / 2) / n;
  });
}

/** Generalized power mean. p = −2 is a soft minimum: one unhappy traveler pulls it down. */
export function powerMean(values: number[], p = -2): number {
  if (values.length === 0) return 0;
  const safe = values.map((v) => Math.max(v, 0.01));
  return (safe.reduce((sum, v) => sum + v ** p, 0) / safe.length) ** (1 / p);
}

export function vibePct(groupFit: number): number {
  return Math.min(99, Math.max(0, Math.round(100 * groupFit)));
}

/**
 * Travelers a place is especially for: percentile ≥ 0.85 and ≥ 0.10 above every other traveler.
 * (With one traveler, that traveler qualifies at ≥ 0.85.)
 */
export function especiallyFor(
  scores: Record<string, TravelerScore>,
  minPercentile = 0.85,
  margin = 0.1,
): string[] {
  const entries = Object.entries(scores);
  return entries
    .filter(
      ([id, s]) =>
        s.percentile >= minPercentile &&
        entries.every(([other, o]) => other === id || s.percentile - o.percentile >= margin),
    )
    .map(([id]) => id);
}

/**
 * Naive group scoring (v0.2.0). `affinities[travelerId][candidateId]` holds each traveler's raw
 * Qloo affinity. Candidates missing a traveler's affinity are dropped (they can't be scored fairly).
 */
export function scoreCandidates(
  candidates: Candidate[],
  affinities: Record<string, Record<string, number>>,
): Candidate[] {
  const travelerIds = Object.keys(affinities);
  const scorable = candidates.filter((c) =>
    travelerIds.every((t) => affinities[t][c.id] !== undefined),
  );
  const percentiles: Record<string, number[]> = Object.fromEntries(
    travelerIds.map((t) => [t, percentileRanks(scorable.map((c) => affinities[t][c.id]))]),
  );
  return scorable.map((c, i) => {
    const scores: Record<string, TravelerScore> = Object.fromEntries(
      travelerIds.map((t) => [
        t,
        { affinity: affinities[t][c.id], percentile: round3(percentiles[t][i]) },
      ]),
    );
    const groupFit = round3(powerMean(travelerIds.map((t) => scores[t].percentile)));
    return {
      ...c,
      scores,
      groupFit,
      vibePct: vibePct(groupFit),
      especiallyFor: especiallyFor(scores),
    };
  });
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
