import { z } from "zod";

import { getMapbox } from "@/adapters/mapbox";
import { CallMeter, getQlooClient } from "@/adapters/qloo";
import { DEMO_CREW } from "@/config/demoCrew";
import { devRoutesGuard } from "@/lib/devRoutes";
import { errorResponse } from "@/lib/http";
import { sliceTrip } from "@/services/sliceTrip";

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** Demo route: Disneyland, Anaheim → downtown Denver. */
const bodySchema = z.object({
  origin: lonLat.default([-117.9145, 33.8366]),
  destination: lonLat.default([-104.9903, 39.7392]),
  days: z.number().int().min(1).max(7).default(4),
});

/** POST /api/dev/slice/plan → the full slice Trip for the demo crew (dev-route gated). */
export async function POST(request: Request) {
  const blocked = devRoutesGuard();
  if (blocked) return blocked;
  try {
    const text = await request.text();
    const input = bodySchema.parse(text ? JSON.parse(text) : {});
    const trip = await sliceTrip(
      { ...input, crew: DEMO_CREW },
      {
        qloo: getQlooClient(),
        directions: (points) => getMapbox().directions(points),
        meter: new CallMeter(),
      },
    );
    return Response.json(trip);
  } catch (error) {
    return errorResponse(error);
  }
}
