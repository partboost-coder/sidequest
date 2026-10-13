import { z } from "zod";

import { getMapbox } from "@/adapters/mapbox";
import { errorResponse } from "@/lib/http";

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

/** GET /api/geocode?q=… → US place suggestions for origin/destination autocomplete. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { q, limit } = querySchema.parse(Object.fromEntries(url.searchParams));
    const places = await getMapbox().geocode(q, { limit });
    return Response.json({ places });
  } catch (error) {
    return errorResponse(error);
  }
}
