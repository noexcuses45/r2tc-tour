// ---------- Per-hole satellite flyover (free Esri World Imagery) ----------
//
// We pull each hole's centre-line (tee -> green) from OpenStreetMap, then
// show a static satellite image of that hole from Esri's World Imagery
// service (no API key, free) and draw the line + distances on top. This
// renders reliably in Expo Go and on web, unlike native map tiles.

import { distanceMetres, LatLon } from './gps';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function overpass(query: string): Promise<any> {
  let lastStatus = 0;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res.json();
      lastStatus = res.status;
    } catch (e) {
      // timeout or network error — try the next mirror
    }
  }
  throw new Error('Hole lookup failed (' + lastStatus + ')');
}

export interface HoleGeo {
  holeRef: number | null;
  par: number | null;
  path: LatLon[]; // ordered tee -> green
  tee: LatLon;
  green: LatLon;
  lengthM: number;
}

/** All mapped holes around a location, ordered by hole number when known. */
export async function fetchHoles(
  lat: number,
  lon: number,
  radiusM = 2500,
): Promise<HoleGeo[]> {
  const q =
    `[out:json][timeout:15];(` +
    `way["golf"="hole"](around:${radiusM},${lat},${lon});` +
    `);out geom;`;
  const json = await overpass(q);
  const holes: HoleGeo[] = [];
  for (const el of json.elements ?? []) {
    const g = el.geometry;
    if (!Array.isArray(g) || g.length < 2) continue;
    const path: LatLon[] = g
      .filter((p: any) => typeof p.lat === 'number')
      .map((p: any) => ({ lat: p.lat, lon: p.lon }));
    if (path.length < 2) continue;
    let lengthM = 0;
    for (let i = 1; i < path.length; i++) {
      lengthM += distanceMetres(path[i - 1], path[i]);
    }
    const refRaw = parseInt(el.tags?.ref ?? '', 10);
    const parRaw = parseInt(el.tags?.par ?? '', 10);
    holes.push({
      holeRef: refRaw >= 1 && refRaw <= 18 ? refRaw : null,
      par: parRaw >= 3 && parRaw <= 6 ? parRaw : null,
      path,
      tee: path[0],
      green: path[path.length - 1],
      lengthM: Math.round(lengthM),
    });
  }
  holes.sort((a, b) => (a.holeRef ?? 99) - (b.holeRef ?? 99));
  return holes;
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Bounding box around a hole path, padded and stretched so its
 * degree-aspect matches the view's pixel-aspect (Esri 4326 export maps
 * degrees linearly to pixels, so this keeps the overlay aligned).
 */
export function holeBBox(path: LatLon[], aspect: number): BBox {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const p of path) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  const padLat = (maxLat - minLat) * 0.22 + 0.0004;
  const padLon = (maxLon - minLon) * 0.22 + 0.0004;
  minLat -= padLat;
  maxLat += padLat;
  minLon -= padLon;
  maxLon += padLon;

  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const curAspect = lonSpan / latSpan;
  if (curAspect < aspect) {
    const targetLon = aspect * latSpan;
    const add = targetLon - lonSpan;
    minLon -= add / 2;
    maxLon += add / 2;
  } else {
    const targetLat = lonSpan / aspect;
    const add = targetLat - latSpan;
    minLat -= add / 2;
    maxLat += add / 2;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/** Esri World Imagery static image for a bbox at the given pixel size. */
export function esriImageUrl(b: BBox, w: number, h: number): string {
  const size = `${Math.round(w)},${Math.round(h)}`;
  return (
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/' +
    `MapServer/export?bbox=${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}` +
    `&bboxSR=4326&imageSR=4326&size=${size}&format=jpg&f=image`
  );
}

/** lat/lon -> pixel x/y inside the rendered image. */
export function project(
  p: LatLon,
  b: BBox,
  w: number,
  h: number,
): { x: number; y: number } {
  return {
    x: ((p.lon - b.minLon) / (b.maxLon - b.minLon)) * w,
    y: ((b.maxLat - p.lat) / (b.maxLat - b.minLat)) * h,
  };
}

/** pixel x/y -> lat/lon (inverse of project). */
export function unproject(
  x: number,
  y: number,
  b: BBox,
  w: number,
  h: number,
): LatLon {
  return {
    lon: b.minLon + (x / w) * (b.maxLon - b.minLon),
    lat: b.maxLat - (y / h) * (b.maxLat - b.minLat),
  };
}

/** Index of the hole whose green is nearest the player. */
export function nearestHoleIndex(from: LatLon, holes: HoleGeo[]): number {
  let best = 0;
  let bestD = Infinity;
  holes.forEach((hole, i) => {
    const d = distanceMetres(from, hole.green);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// --- Greens (Front / Middle / Back of green) via OSM Overpass ---
export interface GreenPoly { ring: LatLon[]; centroid: LatLon; }

function greenCentroid(ring: LatLon[]): LatLon {
  let lat = 0, lon = 0;
  for (const p of ring) { lat += p.lat; lon += p.lon; }
  const n = ring.length || 1;
  return { lat: lat / n, lon: lon / n };
}

export async function fetchGreens(center: LatLon, radiusM: number): Promise<GreenPoly[]> {
  const q = `[out:json][timeout:15];(way["golf"="green"](around:${Math.round(radiusM)},${center.lat},${center.lon}););out geom;`;
  let json: any = null;
  try { json = await overpass(q); } catch (e) { return []; }
  const out: GreenPoly[] = [];
  const els = (json && json.elements) || [];
  for (const el of els) {
    const g = el.geometry;
    if (!g || g.length < 3) continue;
    const ring: LatLon[] = g.map((p: any) => ({ lat: p.lat, lon: p.lon }));
    out.push({ ring, centroid: greenCentroid(ring) });
  }
  return out;
}

function distToSegM(p: LatLon, a: LatLon, b: LatLon): number {
  const mLat = 111320;
  const mLon = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lon - p.lon) * mLon, ay = (a.lat - p.lat) * mLat;
  const bx = (b.lon - p.lon) * mLon, by = (b.lat - p.lat) * mLat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

export function pickGreenForHole(holeGreen: LatLon, greens: GreenPoly[], maxMatchM: number = 90): GreenPoly | null {
  let best: GreenPoly | null = null;
  let bestD = Infinity;
  for (const gr of greens) {
    const d = distanceMetres(holeGreen, gr.centroid);
    if (d < bestD) { bestD = d; best = gr; }
  }
  return bestD <= maxMatchM ? best : null;
}

export interface FMB { front: number; middle: number; back: number; }

export function fmbMetres(from: LatLon, green: GreenPoly): FMB {
  const ring = green.ring;
  let front = Infinity;
  let back = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ds = distToSegM(from, a, b);
    if (ds < front) front = ds;
    const dv = distanceMetres(from, a);
    if (dv > back) back = dv;
  }
  const middle = distanceMetres(from, green.centroid);
  if (!isFinite(front)) front = middle;
  return { front, middle, back };
}

export function fmbFromCenter(from: LatLon, center: LatLon, depthM: number = 30): FMB {
  const middle = distanceMetres(from, center);
  const half = depthM / 2;
  return { front: Math.max(0, middle - half), middle, back: middle + half };
}
