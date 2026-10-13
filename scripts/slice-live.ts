/**
 * Live vertical-slice plan for the demo trip (Anaheim → Denver, Matt + Alex), then a cached
 * re-plan. Prints planned stops, the Side Quest pool, the Scout's z distribution and the offers a
 * full slide produces, checked against the v0.2.0 exit criteria. Run: pnpm slice:live
 */
import { MapboxClient } from "@/adapters/mapbox/client";
import { createQlooClient } from "@/adapters/qloo/create";
import { CallMeter } from "@/adapters/qloo/meter";
import { DEMO_CREW } from "@/config/demoCrew";
import { findSideQuest, robustZ, SCOUT_DEFAULTS } from "@/domain/scout";
import { sliceTrip, type SliceTrip } from "@/services/sliceTrip";

function slide(trip: SliceTrip) {
  const offers: ReturnType<typeof findSideQuest>[] = [];
  const offered = new Set<string>();
  let lastOfferKm: number | undefined;
  let [day, today] = [0, 0];
  for (let km = 0; km <= trip.route.routeKm; km += 10) {
    const d = trip.days.findIndex((x) => km >= x.startKm && km <= x.endKm);
    if (d !== day) [day, today] = [d, 0];
    const offer = findSideQuest(trip.pool, {
      progressKm: km,
      dayIndex: day,
      lastOfferKm,
      offersToday: today,
      offeredIds: offered,
    });
    if (offer) {
      offered.add(offer.candidate.id);
      offers.push(offer);
      console.log(
        `  day ${day + 1} at km ${km}: ${offer.emoji} ${offer.title}: ${offer.candidate.name} (${offer.candidate.city}) ${offer.candidate.vibePct}% · z ${offer.z} · +${offer.candidate.detourMin} min · ${offer.xp} XP`,
      );
      [lastOfferKm, today] = [km, today + 1];
    }
  }
  return offers;
}

async function main() {
  const mapbox = new MapboxClient({ token: process.env.MAPBOX_TOKEN! });
  const { client, quota } = createQlooClient({
    mode: "real",
    apiKey: process.env.QLOO_API_KEY,
    baseUrl: process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com",
    cache: "file",
  });
  const input = {
    origin: [-117.9145, 33.8366] as [number, number],
    destination: [-104.9903, 39.7392] as [number, number],
    days: 4,
    crew: DEMO_CREW,
  };
  const deps = { qloo: client, directions: mapbox.directions.bind(mapbox) };

  const meter = new CallMeter();
  const trip = await sliceTrip(input, { ...deps, meter });
  console.log(
    `plan: ${trip.route.routeKm} km · ${trip.stats.kept} kept · ${trip.stats.scored} scored · dropped ${JSON.stringify(trip.stats.dropped)} · ${trip.stats.ms} ms`,
  );
  console.log(`qloo: ${JSON.stringify(trip.stats.qloo)}`);

  for (const d of trip.days) {
    console.log(`\nDay ${d.index + 1} (km ${Math.round(d.startKm)}–${Math.round(d.endKm)})`);
    for (const s of d.stops)
      console.log(
        `  ${s.belowFloor ? "·" : "✓"} ${s.why.headline} · +${s.detourMin} min · ${s.name} (${s.city}) [${s.bucket}]\n      ${s.why.sentence}`,
      );
  }

  const gs = trip.pool.map((c) => c.groupFit!);
  const zs = trip.pool
    .filter(
      (c) =>
        c.detourMin >= SCOUT_DEFAULTS.minDetourMin && c.detourMin <= SCOUT_DEFAULTS.maxDetourMin,
    )
    .map((c) => {
      const local = trip.pool.filter(
        (x) => Math.abs(x.alongKm - c.alongKm) <= SCOUT_DEFAULTS.baselineRadiusKm,
      );
      return {
        c,
        z: robustZ(
          c.groupFit!,
          local.length >= SCOUT_DEFAULTS.minBaselineSamples ? local.map((x) => x.groupFit!) : gs,
        ),
      };
    })
    .sort((a, b) => b.z - a.z);
  console.log(`\nSide Quest pool: ${trip.pool.length}; detour-eligible: ${zs.length}; top z:`);
  for (const { c, z } of zs.slice(0, 8))
    console.log(
      `  z ${z.toFixed(2)} · ${c.vibePct}% · +${c.detourMin} min · km ${Math.round(c.alongKm)} · ${c.name} (${c.city})`,
    );

  console.log("\nSlide (default Scout thresholds):");
  const offers = slide(trip);

  const stops = trip.days.flatMap((d) => d.stops);
  const checks = {
    "1 ≤ 20 calls (fresh)": trip.stats.qloo.liveCalls <= 20,
    "3 ≥ 3 stops on ≥ 3 days": trip.days.filter((d) => d.stops.length >= 3).length >= 3,
    "4 each traveler especially-for ≥ 1": DEMO_CREW.every((t) =>
      stops.some((s) => s.especiallyFor?.includes(t.id)),
    ),
    "5 ≥ 2 Side Quests": offers.length >= 2,
  };

  const again = new CallMeter();
  await sliceTrip(input, { ...deps, meter: again });
  checks["1 cached re-plan: 0 calls" as keyof typeof checks] = again.liveCalls === 0;

  console.log("\nExit criteria (2 = chains/casinos: review the lists above):");
  for (const [k, ok] of Object.entries(checks)) console.log(`  ${ok ? "✅" : "❌"} ${k}`);
  console.log(`quota remaining: ${(await quota?.snapshot())?.remaining}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
