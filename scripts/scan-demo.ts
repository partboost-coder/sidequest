/**
 * Live corridor scan + per-traveler scoring for the demo route (Anaheim → Denver). ~18 Qloo
 * calls on a cold cache; re-runs are free. Run: pnpm qloo:scan-demo
 */
import { MapboxClient } from "@/adapters/mapbox/client";
import { createQlooClient } from "@/adapters/qloo/create";
import { CallMeter } from "@/adapters/qloo/meter";
import { DEMO_CREW } from "@/config/demoCrew";
import { segmentCorridor } from "@/domain/geo/corridor";
import { scanCorridor } from "@/services/corridorScan";
import { scoreForTravelers } from "@/services/travelerScoring";

async function main() {
  const mapbox = new MapboxClient({ token: process.env.MAPBOX_TOKEN! });
  const route = await mapbox.directions([
    [-117.9145, 33.8366],
    [-104.9903, 39.7392],
  ]);
  const segments = segmentCorridor({ geometry: route.geometry, durationSec: route.durationSec });
  console.log(
    `route: ${(route.durationSec / 3600).toFixed(1)} h, ${segments.length} segments, WKT ≤ ${Math.max(...segments.map((s) => s.wkt.length))} chars`,
  );

  const { client, quota } = createQlooClient({
    mode: "real",
    apiKey: process.env.QLOO_API_KEY,
    baseUrl: process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com",
    cache: "file",
  });
  const meter = new CallMeter();
  const started = Date.now();
  const scan = await scanCorridor(client, route.geometry, segments, DEMO_CREW, { meter });
  const scored = await scoreForTravelers(client, scan.candidates, DEMO_CREW, { meter });
  const ms = Date.now() - started;

  const reasons = scan.dropped.reduce<Record<string, number>>(
    (acc, d) => ({ ...acc, [d.reason]: (acc[d.reason] ?? 0) + 1 }),
    {},
  );
  console.log(
    `candidates: ${scan.candidates.length} kept, ${scan.dropped.length} dropped ${JSON.stringify(reasons)}; scored ${scored.length}`,
  );
  console.log(
    `dropped chains/excluded: ${scan.dropped
      .filter((d) => d.reason !== "duplicate")
      .map((d) => d.name)
      .slice(0, 12)
      .join(" · ")}`,
  );
  for (const s of segments) {
    const inSeg = scored.filter((c) => c.segmentIndex === s.index);
    console.log(`\n── segment ${s.index} (km ${s.startKm}–${s.endKm}): ${inSeg.length} scored`);
    for (const c of [...inSeg].sort((a, b) => b.groupFit! - a.groupFit!).slice(0, 5)) {
      const per = DEMO_CREW.map(
        (t) => `${t.name[0]}${Math.round(100 * c.scores![t.id].percentile)}`,
      ).join(" ");
      const ef = c.especiallyFor?.length ? ` ★${c.especiallyFor.join(",")}` : "";
      console.log(
        `   ${String(c.vibePct).padStart(2)}% ${per.padEnd(8)} ${c.bucket.padEnd(10)} +${String(c.detourMin).padStart(2)}m ${c.name.slice(0, 40)} (${c.city ?? "?"})${ef}`,
      );
    }
  }
  const especially = Object.fromEntries(
    DEMO_CREW.map((t) => [t.name, scored.filter((c) => c.especiallyFor?.includes(t.id)).length]),
  );
  console.log(`\nespecially-for counts: ${JSON.stringify(especially)}`);
  console.log(
    `meter: ${JSON.stringify(meter.summary())} · wall ${ms} ms · quota ${(await quota?.snapshot())?.remaining}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
