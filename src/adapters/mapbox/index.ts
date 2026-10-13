import "server-only";

import { getServerEnv } from "@/lib/config/env.server";

import { MapboxClient } from "./client";

export { MapboxClient } from "./client";
export { estimateDetourMin, exactDetourMin } from "./detour";
export { displayGeometry } from "./display";
export * from "./types";

let client: MapboxClient | undefined;

/** Server-side Mapbox client using the server token (never sent to the browser). */
export function getMapbox(): MapboxClient {
  client ??= new MapboxClient({ token: getServerEnv().MAPBOX_TOKEN! });
  return client;
}
