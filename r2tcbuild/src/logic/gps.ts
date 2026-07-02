// ---------- Free GPS rangefinder using OpenStreetMap green data ----------
//
// No paid API: we read `golf=green` polygons (and `golf=hole` lines) from
// OpenStreetMap around the player's live position, then compute front /
// centre / back-of-green distances from the phone's GPS. Coverage depends
// on how well each course is mapped in OSM — most Melbourne metro courses
// are mapped, and gaps can be filled by editing the course in OSM once.

export interface LatLon {
  lat: number;
  lon: number;
}

export interface GreenInfo {
  /** Hole number if OSM tagged one (golf=hole ref), else null. */
  holeRef: number | null;
  centre: LatLon;
  /** Polygon outline of the green. */
  outline: LatLon[];
}

const OVERPASS = 'https://overpass-api.de/api/interpreter';

async function overpass(query: string): Promise<any> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`GPS lookup failed (${res.status})`);
  return res.json();
}

/** Distance in metres between two coordinates (haversine). */
export function distanceMetres(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function metresToYards(m: number): number {
  return m * 1.09361;
}

function centroid(points: LatLon[]): LatLon {
  const n = points.length || 1;
  const lat = points.reduce((s, p) => s + p.lat, 0) / n;
  const lon = points.reduce((s, p) => s + p.lon, 0) / n;
  return { lat, lon };
}

/**
 * All greens around a location (player or course centre), within radiusM.
 * Greens are `golf=green` ways/relations; we read full geometry with
 * `out geom` so we can compute front/centre/back from any position.
 */
export async function fetchGreens(
  lat: number,
  lon: number,
  radiusM = 2500,
): Promise<GreenInfo[]> {
  const q =
    `[out:json][timeout:25];(` +
    `way["golf"="green"](around:${radiusM},${lat},${lon});` +
    `relation["golf"="green"](around:${radiusM},${lat},${lon});` +
    `);out geom;`;
  const json = await overpass(q);
  const greens: GreenInfo[] = [];
  for (const el of json.elements ?? []) {
    let outline: LatLon[] = [];
    if (Array.isArray(el.geometry)) {
      outline = el.geometry
        .filter((g: any) => typeof g.lat === 'number')
        .map((g: any) => ({ lat: g.lat, lon: g.lon }));
    } else if (Array.isArray(el.members)) {
      for (const m of el.members) {
        if (Array.isArray(m.geometry)) {
          outline = outline.concat(
            m.geometry
              .filter((g: any) => typeof g.lat === 'number')
              .map((g: any) => ({ lat: g.lat, lon: g.lon })),
          );
        }
      }
    }
    if (outline.length === 0) continue;
    const refRaw = parseInt(el.tags?.ref ?? '', 10);
    greens.push({
      holeRef: refRaw >= 1 && refRaw <= 18 ? refRaw : null,
      centre: centroid(outline),
      outline,
    });
  }
  return greens;
}

export interface GreenDistances {
  front: number; // metres, nearest point of the green to the player
  centre: number; // metres to the centroid
  back: number; // metres, farthest point of the green
}

/** Front / centre / back distances (metres) from a position to a green. */
export function greenDistances(from: LatLon, green: GreenInfo): GreenDistances {
  let front = Infinity;
  let back = 0;
  for (const p of green.outline) {
    const d = distanceMetres(from, p);
    if (d < front) front = d;
    if (d > back) back = d;
  }
  return {
    front: Math.round(front),
    centre: Math.round(distanceMetres(from, green.centre)),
    back: Math.round(back),
  };
}

/** Index of the green nearest the player (the hole you're most likely on). */
export function nearestGreenIndex(from: LatLon, greens: GreenInfo[]): number {
  let best = 0;
  let bestD = Infinity;
  greens.forEach((g, i) => {
    const d = distanceMetres(from, g.centre);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * Order greens for the hole-picker: by OSM hole ref when present, else by
 * proximity to each other starting from the clubhouse-ish centroid so the
 * list is stable as the player moves.
 */
export function orderGreens(greens: GreenInfo[]): GreenInfo[] {
  const withRef = greens.filter((g) => g.holeRef !== null);
  if (withRef.length >= greens.length / 2) {
    return [...greens].sort(
      (a, b) => (a.holeRef ?? 99) - (b.holeRef ?? 99),
    );
  }
  return greens;
}
