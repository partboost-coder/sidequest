import { z } from "zod";

import { displayGeometry, getMapbox } from "@/adapters/mapbox";
import { errorResponse } from "@/lib/http";

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const bodySchema = z.object({
  origin: lonLat,
  destination: lonLat,
  via: z.array(lonLat).max(23).default([]),
});

/** POST /api/route → driving route with display-resolution geometry for the map. */
export async function POST(request: Request) {
  try {
    const { origin, destination, via } = bodySchema.parse(await request.json());
    const route = await getMapbox().directions([origin, ...via, destination]);
    return Response.json({
      durationSec: route.durationSec,
      distanceM: route.distanceM,
      legs: route.legs,
      geometry: displayGeometry(route.geometry),
      fullPointCount: route.geometry.coordinates.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
