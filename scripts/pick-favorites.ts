/**
 * Prints real Qloo /search candidates for proposed demo-crew favorites so a human can pick
 * (spike S5: auto-picking gets small places wrong). ~1 call per query; cached re-runs are free.
 * Run: pnpm qloo:favorites
 */
import { createQlooClient } from "@/adapters/qloo/create";
import { CallMeter } from "@/adapters/qloo/meter";
import type { QlooEntityType } from "@/adapters/qloo/types";

const PROPOSALS: { traveler: string; query: string; types?: QlooEntityType[] }[] = [
  // Matt: Vietnamese + Mexican food, cars, scenic drives, outdoors
  { traveler: "Matt", query: "Pho 79", types: ["urn:entity:place"] },
  { traveler: "Matt", query: "Guelaguetza", types: ["urn:entity:place"] },
  { traveler: "Matt", query: "Ford v Ferrari", types: ["urn:entity:movie"] },
  { traveler: "Matt", query: "Top Gear", types: ["urn:entity:tv_show"] },
  { traveler: "Matt", query: "Porsche", types: ["urn:entity:brand"] },
  { traveler: "Matt", query: "Joshua Tree National Park" },
  // Alex: art, coffee, vintage, hiking, indie music
  { traveler: "Alex", query: "Phoebe Bridgers", types: ["urn:entity:artist"] },
  { traveler: "Alex", query: "Khruangbin", types: ["urn:entity:artist"] },
  { traveler: "Alex", query: "Blue Bottle Coffee", types: ["urn:entity:brand"] },
  { traveler: "Alex", query: "Patagonia", types: ["urn:entity:brand"] },
  { traveler: "Alex", query: "The Broad", types: ["urn:entity:place"] },
  { traveler: "Alex", query: "The Grand Budapest Hotel", types: ["urn:entity:movie"] },
];

async function main() {
  const { client, quota } = createQlooClient({
    mode: "real",
    apiKey: process.env.QLOO_API_KEY,
    baseUrl: process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com",
    cache: "file",
  });
  const meter = new CallMeter();
  for (const p of PROPOSALS) {
    const results = await client.search({ query: p.query, types: p.types, take: 4 }, { meter });
    console.log(
      `\n${p.traveler} · "${p.query}"${p.types ? ` (${p.types.map((t) => t.split(":").pop()).join(",")})` : ""}`,
    );
    if (results.length === 0) console.log("   (no results)");
    results.forEach((r, i) => {
      const where = [r.city, r.region].filter(Boolean).join(", ");
      const kind = r.types[0]?.split(":").pop();
      const tags = r.tags
        .slice(0, 4)
        .map((t) => t.name)
        .join(", ");
      console.log(
        `   ${i + 1}. ${r.name} [${kind}${where ? ` · ${where}` : ""}] pop ${r.popularity?.toFixed(2) ?? "?"} · ${tags}`,
      );
      console.log(`      id ${r.id}`);
    });
  }
  console.log(`\nmeter: ${JSON.stringify(meter.summary())}`);
  console.log(`quota: ${JSON.stringify(await quota?.snapshot())}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
