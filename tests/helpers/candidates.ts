import type { Candidate } from "@/domain/candidate";

/** Builds a scored candidate for domain tests. */
export function cand(overrides: Partial<Candidate> & { id: string }): Candidate {
  const groupFit = overrides.groupFit ?? 0.6;
  return {
    name: overrides.id,
    lat: 0,
    lon: 0,
    tags: [],
    bucket: "food",
    segmentIndex: 0,
    groupQueryAffinity: 0.8,
    contributions: [],
    alongKm: 0,
    offRouteKm: 0,
    detourMin: 5,
    scores: {
      matt: { affinity: 0.8, percentile: groupFit },
      alex: { affinity: 0.8, percentile: groupFit },
    },
    vibePct: Math.round(groupFit * 100),
    especiallyFor: [],
    ...overrides,
    groupFit,
  };
}
