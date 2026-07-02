import { DEFAULT_HOLES } from '../defaultCourse';
import { HoleInfo } from '../types';

export interface NearbyCourse {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

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
  throw new Error('Course lookup failed (' + lastStatus + ')');
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Golf courses near a location (OpenStreetMap), closest first. */
export async function findNearbyCourses(
  lat: number,
  lon: number,
  radiusKm = 40,
): Promise<NearbyCourse[]> {
  const m = Math.round(radiusKm * 1000);
  const q =
    `[out:json][timeout:25];(` +
    `way["leisure"="golf_course"](around:${m},${lat},${lon});` +
    `relation["leisure"="golf_course"](around:${m},${lat},${lon});` +
    `);out center tags;`;
  const json = await overpass(q);
  const seen = new Set<string>();
  const out: NearbyCourse[] = [];
  for (const el of json.elements ?? []) {
    const name = el.tags?.name;
    const c = el.center ?? el;
    if (!name || typeof c.lat !== 'number') continue;
    const key = String(name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `${el.type}/${el.id}`,
      name: String(name),
      lat: c.lat,
      lon: c.lon,
      distanceKm: haversineKm(lat, lon, c.lat, c.lon),
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, 12);
}

/**
 * Hole data (par + stroke index) for a course from OpenStreetMap.
 * Falls back to the default layout for anything not mapped.
 */
export async function fetchCourseHoles(
  course: NearbyCourse,
): Promise<{ holes: HoleInfo[]; found: number }> {
  const q =
    `[out:json][timeout:25];` +
    `way["golf"="hole"](around:1800,${course.lat},${course.lon});out tags;`;
  const json = await overpass(q);
  const holes: HoleInfo[] = DEFAULT_HOLES.map((h) => ({ ...h }));
  let found = 0;
  for (const el of json.elements ?? []) {
    const ref = parseInt(el.tags?.ref ?? '', 10);
    if (!(ref >= 1 && ref <= 18)) continue;
    const par = parseInt(el.tags?.par ?? '', 10);
    const si = parseInt(el.tags?.handicap ?? '', 10);
    if (par >= 3 && par <= 6) {
      holes[ref - 1].par = par;
      found += 1;
    }
    if (si >= 1 && si <= 18) {
      holes[ref - 1].strokeIndex = si;
    }
  }
  return { holes, found };
}
