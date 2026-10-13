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

/**
 * A denser stand-in for the real Anaheim → Denver drive (I-15 → I-70) through the towns the mock
 * fixtures sit in, for pipeline tests that need realistic corridor coverage.
 */
export function demoRoute(): LineString {
  const towns: [number, number][] = [
    [-117.91, 33.84], // Anaheim
    [-117.57, 33.88], // Corona
    [-117.55, 34.07], // Ontario
    [-117.4, 34.35], // Cajon Pass
    [-117.29, 34.54], // Victorville
    [-117.02, 34.9], // Barstow
    [-116.07, 35.27], // Baker
    [-115.39, 35.61], // Primm
    [-115.15, 36.17], // Las Vegas
    [-114.07, 36.8], // Mesquite
    [-113.58, 37.1], // St. George
    [-113.06, 37.68], // Cedar City
    [-112.64, 38.28], // Beaver
    [-112.58, 38.6], // Cove Fort (I-70)
    [-112.08, 38.77], // Richfield
    [-111.86, 38.96], // Salina
    [-110.16, 38.99], // Green River
    [-109.83, 38.95], // Crescent Junction
    [-108.55, 39.07], // Grand Junction
    [-107.32, 39.55], // Glenwood Springs
    [-106.37, 39.64], // Vail
    [-105.51, 39.74], // Idaho Springs
    [-105.22, 39.75], // Golden
    [-104.99, 39.74], // Denver
  ];
  const coordinates: [number, number][] = [];
  for (let w = 0; w < towns.length - 1; w++) {
    const [a, b] = [towns[w], towns[w + 1]];
    for (let i = 0; i < 40; i++) {
      const f = i / 40;
      coordinates.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  coordinates.push(towns.at(-1)!);
  return { type: "LineString", coordinates };
}
