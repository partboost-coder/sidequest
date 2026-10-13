import type { LineString } from "geojson";

/** Ray-casting point-in-polygon for test assertions. */
export function pointInPolygonRing([x, y]: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A dense synthetic route roughly along I-15/I-70 (Anaheim → Las Vegas → Richfield → Denver). */
export function syntheticRoute(): LineString {
  const waypoints: [number, number][] = [
    [-117.91, 33.84],
    [-115.14, 36.17],
    [-112.08, 38.77],
    [-108.55, 39.06],
    [-104.99, 39.74],
  ];
  const coordinates: [number, number][] = [];
  for (let w = 0; w < waypoints.length - 1; w++) {
    const [a, b] = [waypoints[w], waypoints[w + 1]];
    for (let i = 0; i < 200; i++) {
      const f = i / 200;
      coordinates.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  coordinates.push(waypoints.at(-1)!);
  return { type: "LineString", coordinates };
}
