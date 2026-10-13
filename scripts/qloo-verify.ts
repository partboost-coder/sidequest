/**
 * Live verification for the real Qloo client (v0.2.0 task 1.7). ~4 live calls; re-runs are free
 * (file cache). Run: pnpm qloo:verify
 */
import { createQlooClient } from "@/adapters/qloo/create";
import { CallMeter } from "@/adapters/qloo/meter";
import { pointWkt } from "@/adapters/qloo/params";
import { RealQlooClient } from "@/adapters/qloo/real";

const PHOEBE = "AFBC71A7-9439-4AB0-AB68-D14B11AAF836";
const LAS_VEGAS = pointWkt([-115.1398, 36.1699]);

async function main() {
  const { client, quota } = createQlooClient({
    mode: "real",
    apiKey: process.env.QLOO_API_KEY,
    baseUrl: process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com",
    cache: "file",
  });
  const meter = new CallMeter();

  const search = await client.search({ query: "Phoebe Bridgers", take: 1 }, { meter });
  console.log(`search: ${search[0]?.name} (${search[0]?.types.join(",")})`);

  const pool = await client.insights(
    {
      filterType: "urn:entity:place",
      filter: { location: LAS_VEGAS, locationRadiusM: 40_000 },
      signal: { entities: [PHOEBE] },
      take: 50,
    },
    { meter },
  );
  console.log(`candidate pool: ${pool.entities.length} places`);

  // Qloo caps `take` at 50 (HTTP 400 above), so a scoring batch can't exceed 50 IDs.
  for (const batch of [50]) {
    const ids = pool.entities.slice(0, batch).map((e) => e.id);
    const real = (client as unknown as { inner: RealQlooClient }).inner;
    const urlLength = real.buildInsightsRequest({
      filterType: "urn:entity:place",
      filter: { entities: ids },
      signal: { entities: [PHOEBE] },
      take: batch,
    }).url.length;
    try {
      const scored = await client.insights(
        {
          filterType: "urn:entity:place",
          filter: { entities: ids },
          signal: { entities: [PHOEBE] },
          take: batch,
        },
        { meter },
      );
      const returned = new Set(scored.entities.map((e) => e.id));
      const allBack = ids.every((id) => returned.has(id));
      console.log(
        `batch ${batch}: URL ${urlLength} chars → returned ${scored.entities.length}/${ids.length}, all requested IDs back: ${allBack}`,
      );
      if (allBack) break;
    } catch (error) {
      console.log(`batch ${batch}: URL ${urlLength} chars → FAILED: ${(error as Error).message}`);
    }
  }

  console.log("meter:", JSON.stringify(meter.summary()));
  console.log("quota:", JSON.stringify(await quota?.snapshot()));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
