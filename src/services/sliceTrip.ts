import type { LineString } from "geojson";

import { displayGeometry } from "@/adapters/mapbox/display";
import type { LonLat, Route } from "@/adapters/mapbox/types";
import type { QlooClient } from "@/adapters/qloo/client";
import { CallMeter } from "@/adapters/qloo/meter";
import type { Traveler } from "@/config/demoCrew";
import type { Candidate } from "@/domain/candidate";
import { templateWhy, type Why } from "@/domain/explain";
import { segmentCorridor } from "@/domain/geo/corridor";
import { routeLengthKm } from "@/domain/geo/progress";
import { naiveItinerary, type PlannedStop } from "@/domain/itinerary/naive";
import type { DropReason } from "@/domain/quality/filters";

import { scanCorridor } from "./corridorScan";
import { scoreForTravelers } from "./travelerScoring";

export interface SliceTripInput {
  origin: LonLat;
  destination: LonLat;
  days: number;
  crew: Traveler[];
}

export interface SliceTripDeps {
  qloo: QlooClient;
  /** Driving directions with full-resolution geometry (Mapbox in the app, a stub in tests). */
  directions: (points: LonLat[]) => Promise<Route>;
  /** Per-request meter, so concurrent plans never mix their counts. */
  meter?: CallMeter;
  allowReserve?: boolean;
}

/** A candidate as the client sees it: scored, with its explanation precomputed. */
export type SliceCandidate = Candidate & { why: Why };
export type SliceStop = PlannedStop & { why: Why };

export interface SliceDay {
  index: number;
  startKm: number;
  endKm: number;
  stops: SliceStop[];
}

/** The full planned trip for /dev/slice. Plain JSON: the Scout, XP and journal run client-side. */
export interface SliceTrip {
  crew: Pick<Traveler, "id" | "name" | "color" | "emoji">[];
  route: {
    /** Simplified for the map. `alongKm` values are measured on the full geometry. */
    geometry: LineString;
    /** Full-geometry length; the slider runs over 0…routeKm. */
    routeKm: number;
    durationSec: number;
  };
  days: SliceDay[];
  /** Scored candidates not planned: the Scout's Side Quest pool. */
  pool: SliceCandidate[];
  stats: {
    segments: number;
    kept: number;
    scored: number;
    dropped: Partial<Record<DropReason, number>>;
    qloo: ReturnType<CallMeter["summary"]>;
    ms: number;
  };
}

/**
 * The vertical-slice pipeline: route → corridor → scan → per-traveler scores → naive itinerary →
 * Side Quest pool → template "why" lines. ~18 Qloo calls cold; 0 on a cached re-plan.
 */
export async function sliceTrip(input: SliceTripInput, deps: SliceTripDeps): Promise<SliceTrip> {
  const started = Date.now();
  const meter = deps.meter ?? new CallMeter();
  const { crew } = input;
  const opts = { meter, allowReserve: deps.allowReserve };

  const route = await deps.directions([input.origin, input.destination]);
  const segments = segmentCorridor({ geometry: route.geometry, durationSec: route.durationSec });
  const scan = await scanCorridor(deps.qloo, route.geometry, segments, crew, opts);
  const scored = await scoreForTravelers(deps.qloo, scan.candidates, crew, opts);
  const routeKm = routeLengthKm(route.geometry);
  const itinerary = naiveItinerary(scored, routeKm, { days: input.days });

  const explain = <T extends Candidate>(c: T) => ({ ...c, why: templateWhy(c, crew) });
  return {
    crew: crew.map(({ id, name, color, emoji }) => ({ id, name, color, emoji })),
    route: {
      geometry: displayGeometry(route.geometry),
      routeKm: Math.round(routeKm * 10) / 10,
      durationSec: route.durationSec,
    },
    days: itinerary.days.map((d) => ({ ...d, stops: d.stops.map(explain) })),
    pool: itinerary.pool.map(explain),
    stats: {
      segments: segments.length,
      kept: scan.candidates.length,
      scored: scored.length,
      dropped: scan.dropped.reduce<Partial<Record<DropReason, number>>>(
        (acc, d) => ({ ...acc, [d.reason]: (acc[d.reason] ?? 0) + 1 }),
        {},
      ),
      qloo: meter.summary(),
      ms: Date.now() - started,
    },
  };
}
