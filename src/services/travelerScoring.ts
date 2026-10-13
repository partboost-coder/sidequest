import type { QlooClient } from "@/adapters/qloo/client";
import type { CallMeter } from "@/adapters/qloo/meter";
import type { Traveler } from "@/config/demoCrew";
import type { Candidate } from "@/domain/candidate";
import { scoreCandidates } from "@/domain/scoring";

/** Qloo caps `take` at 50, so a filter.entities batch can't exceed 50 IDs. */
export const SCORING_BATCH = 50;

export interface ScoringOptions {
  /** Only the top N candidates by group-query affinity are scored (call budget). */
  maxCandidates?: number;
  meter?: CallMeter;
  allowReserve?: boolean;
}

/**
 * Scores the top candidates separately for each traveler (`filter.entities` + that traveler's
 * favorites only), then applies naive group scoring. Cost: ceil(N / 50) calls per traveler.
 */
export async function scoreForTravelers(
  client: QlooClient,
  candidates: Candidate[],
  crew: Traveler[],
  options: ScoringOptions = {},
): Promise<Candidate[]> {
  const { maxCandidates = 100, meter, allowReserve } = options;
  const top = [...candidates]
    .sort((a, b) => b.groupQueryAffinity - a.groupQueryAffinity)
    .slice(0, maxCandidates);
  const batches: Candidate[][] = [];
  for (let i = 0; i < top.length; i += SCORING_BATCH) batches.push(top.slice(i, i + SCORING_BATCH));

  const affinities: Record<string, Record<string, number>> = Object.fromEntries(
    crew.map((t) => [t.id, {}]),
  );
  await Promise.all(
    crew.flatMap((traveler) =>
      batches.map(async (batch) => {
        const { entities } = await client.insights(
          {
            filterType: "urn:entity:place",
            filter: { entities: batch.map((c) => c.id) },
            signal: { entities: traveler.favorites.map((f) => f.qlooId) },
            take: batch.length,
          },
          { meter, allowReserve },
        );
        for (const e of entities) {
          if (e.affinity !== undefined) affinities[traveler.id][e.id] = e.affinity;
        }
      }),
    ),
  );

  return scoreCandidates(top, affinities).sort((a, b) => a.alongKm - b.alongKm);
}
