import type { LineString } from "geojson";

import type { QlooClient } from "@/adapters/qloo/client";
import type { CallMeter } from "@/adapters/qloo/meter";
import type { QlooEntity } from "@/adapters/qloo/types";
import { BUCKETS, EXCLUDED_TAGS, type BucketId } from "@/config/buckets";
import type { Traveler } from "@/config/demoCrew";
import { crewSignalIds } from "@/config/demoCrew";
import type { Candidate } from "@/domain/candidate";
import type { CorridorSegment } from "@/domain/geo/corridor";
import { estimateDetourMin } from "@/domain/geo/detour";
import { filterCandidates, type DropReason } from "@/domain/quality/filters";

export interface ScanOptions {
  /** Results per segment × bucket query (Qloo caps take at 50). */
  take?: number;
  meter?: CallMeter;
  allowReserve?: boolean;
}

export interface ScanResult {
  candidates: Candidate[];
  dropped: { id: string; name: string; reason: DropReason }[];
  queries: number;
}

/**
 * Corridor scan: one Insights query per segment × bucket with the crew's union signal, curated
 * bucket tags and exclusions. Quality filters run before any per-traveler scoring.
 */
export async function scanCorridor(
  client: QlooClient,
  route: LineString,
  segments: CorridorSegment[],
  crew: Traveler[],
  options: ScanOptions = {},
): Promise<ScanResult> {
  const { take = 15, meter, allowReserve } = options;
  const signal = crewSignalIds(crew);
  const jobs = segments.flatMap((segment) =>
    (Object.keys(BUCKETS) as BucketId[]).map((bucket) => ({ segment, bucket })),
  );

  const results = await Promise.all(
    jobs.map(async ({ segment, bucket }) => {
      const { entities } = await client.insights(
        {
          filterType: "urn:entity:place",
          filter: { location: segment.wkt, tags: BUCKETS[bucket].tags, excludeTags: EXCLUDED_TAGS },
          signal: { entities: signal },
          explainability: true,
          diversify: { by: "properties.geocode.city", take: 3 },
          take,
        },
        { meter, allowReserve },
      );
      return entities.map((entity) => ({ entity, bucket, segmentIndex: segment.index }));
    }),
  );

  // Keep the best group affinity when a place appears in several segments/buckets.
  const best = new Map<string, { entity: QlooEntity; bucket: BucketId; segmentIndex: number }>();
  const raw: QlooEntity[] = [];
  for (const hit of results.flat()) {
    raw.push(hit.entity);
    const prev = best.get(hit.entity.id);
    if (!prev || (hit.entity.affinity ?? 0) > (prev.entity.affinity ?? 0))
      best.set(hit.entity.id, hit);
  }

  const { kept, dropped } = filterCandidates(
    [...best.values()].map((h) => h.entity),
    EXCLUDED_TAGS,
  );
  const keptIds = new Set(kept.map((e) => e.id));

  const candidates = [...best.values()]
    .filter((h) => keptIds.has(h.entity.id))
    .map(({ entity: e, bucket, segmentIndex }): Candidate => {
      const detour = estimateDetourMin(route, [e.location!.lon, e.location!.lat]);
      return {
        id: e.id,
        name: e.name,
        lat: e.location!.lat,
        lon: e.location!.lon,
        city: e.city,
        region: e.region,
        subtype: e.subtype,
        tags: e.tags.map((t) => ({ id: t.id, name: t.name })),
        description: e.description ?? e.shortDescription,
        specialtyDishes: e.specialtyDishes,
        imageUrl: e.imageUrl,
        popularity: e.popularity,
        businessRating: e.businessRating,
        bucket,
        segmentIndex,
        groupQueryAffinity: e.affinity ?? 0,
        contributions: (e.contributions ?? []).map((c) => ({
          signalId: c.signalId,
          score: c.score,
        })),
        alongKm: detour.alongKm,
        offRouteKm: detour.offRouteKm,
        detourMin: detour.detourMin,
      };
    })
    .sort((a, b) => a.alongKm - b.alongKm);

  return {
    candidates,
    dropped: dropped.map((d) => ({ id: d.candidate.id, name: d.candidate.name, reason: d.reason })),
    queries: jobs.length,
  };
}
