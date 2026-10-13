import type { BucketId } from "@/config/buckets";

import type { Candidate } from "../candidate";

export interface PlannedStop extends Candidate {
  /** True when the stop was added to reach the per-day minimum despite missing the quality floor. */
  belowFloor: boolean;
}

export interface NaiveDay {
  index: number;
  startKm: number;
  endKm: number;
  stops: PlannedStop[];
}

export interface NaiveItinerary {
  days: NaiveDay[];
  /** Scored candidates not planned: the Scout's Side Quest pool. */
  pool: Candidate[];
}

export interface NaiveOptions {
  days: number;
  /** Quality floor on group fit for a planned stop. */
  minGroupFit?: number;
  /** Planned stops stay close to the route; longer detours are left for Side Quests. */
  maxDetourMin?: number;
  maxStops?: number;
  /** Fill up to this many per day (below the floor if needed, flagged). */
  minStops?: number;
  maxPerBucket?: number;
}

export const NAIVE_DEFAULTS = {
  minGroupFit: 0.45,
  maxDetourMin: 10,
  maxStops: 4,
  minStops: 2,
  maxPerBucket: 2,
} as const;

/**
 * Naive itinerary (v0.2.0): equal-distance days; each day takes its best nearby candidates by
 * group fit, respecting a per-bucket cap, then orders them along the route. The overnight-town
 * heuristic replaces equal splits in v0.3.0.
 */
export function naiveItinerary(
  candidates: Candidate[],
  routeKm: number,
  options: NaiveOptions,
): NaiveItinerary {
  const o = { ...NAIVE_DEFAULTS, ...options };
  const dayKm = routeKm / o.days;
  const planned = new Set<string>();

  const days: NaiveDay[] = Array.from({ length: o.days }, (_, index) => {
    const startKm = index * dayKm;
    const endKm = index === o.days - 1 ? routeKm : (index + 1) * dayKm;
    const nearby = candidates
      .filter((c) => c.alongKm >= startKm && c.alongKm < endKm + (index === o.days - 1 ? 1 : 0))
      .filter((c) => c.detourMin <= o.maxDetourMin && c.groupFit !== undefined)
      .sort((a, b) => b.groupFit! - a.groupFit!);

    const stops: PlannedStop[] = [];
    const perBucket: Partial<Record<BucketId, number>> = {};
    const take = (c: Candidate, belowFloor: boolean) => {
      if (
        stops.length >= o.maxStops ||
        planned.has(c.id) ||
        (perBucket[c.bucket] ?? 0) >= o.maxPerBucket
      )
        return;
      stops.push({ ...c, belowFloor });
      planned.add(c.id);
      perBucket[c.bucket] = (perBucket[c.bucket] ?? 0) + 1;
    };
    nearby.filter((c) => c.groupFit! >= o.minGroupFit).forEach((c) => take(c, false));
    if (stops.length < o.minStops)
      nearby
        .filter((c) => c.groupFit! < o.minGroupFit)
        .forEach((c) => stops.length < o.minStops && take(c, true));

    return {
      index,
      startKm: round1(startKm),
      endKm: round1(endKm),
      stops: stops.sort((a, b) => a.alongKm - b.alongKm),
    };
  });

  return { days, pool: candidates.filter((c) => !planned.has(c.id)) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
