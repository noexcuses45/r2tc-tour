import { SHEET_ID, SHEET_TABS, GOLF_API_KEY } from '../config';
import { fetchSupabaseLeaderboards, SUPABASE_URL, SUPABASE_KEY } from './supabase';
import { Fixture, TourLeaderboardRow, TourLeaderboards } from '../types';

/** Sample data shown until the database has results (see src/config.ts). */
const SAMPLE: TourLeaderboards = {
  tourPoints: [
    { rank: 1, name: 'Luke Sheffield', value: '1,250 pts' },
    { rank: 2, name: 'John Thompson', value: '1,180 pts' },
    { rank: 3, name: 'Sean Ragozzini', value: '1,050 pts' },
    { rank: 4, name: 'Lewis Dixon', value: '980 pts' },
    { rank: 5, name: 'Andrew McCoy', value: '870 pts' },
  ],
  longestDrive: [
    { rank: 1, name: 'Sean Ragozzini', value: '304 m', detail: 'Yering Meadows Open' },
    { rank: 2, name: 'Luke Sheffield', value: '295 m', detail: 'Ivanhoe Open' },
    { rank: 3, name: 'Jessie Holdsworth', value: '291 m', detail: 'Melbourne Airport Open' },
  ],
  closestToPin: [
    { rank: 1, name: 'John Thompson', value: '1.2 m', detail: 'Canberra Open' },
    { rank: 2, name: 'Mark Holmes', value: '2.4 m', detail: 'Valley Open' },
    { rank: 3, name: 'Jeremy Djurovich', value: '3.1 m', detail: 'Ivanhoe Open' },
  ],
  isSample: true,
};

function gvizUrl(tab: string): string {
  return (
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  );
}

/** Parse Google's gviz response (JSON wrapped in a JS callback). */
function parseRows(text: string): string[][] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Bad sheet response');
  const json = JSON.parse(text.slice(start, end + 1));
  const rows: any[] = (json && json.table && json.table.rows) || [];
  return rows.map((r) => {
    const cells: any[] = (r && r.c) || [];
    return cells.map((cell) =>
      cell == null ? '' : `${cell.f != null ? cell.f : cell.v != null ? cell.v : ''}`.trim(),
    );
  });
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') { inQ = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else { field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchRows(tab: string, keepFirst = false): Promise<string[][]> {
  const res: any = await Promise.race([
    fetch(gvizUrl(tab), { headers: { Accept: 'text/plain, */*' } }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
  ]);
  if (!res.ok) throw new Error('Sheet fetch failed (' + res.status + ')');
  const txt: string = await Promise.race([
    res.text(),
    new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
  ]);
  const all = parseCSV(txt);
  return keepFirst ? all : all.slice(1);
}

async function fetchRowsRetry(tab: string): Promise<string[][]> {
  try {
    return await fetchRows(tab);
  } catch (e) {
    await new Promise((res) => setTimeout(res, 700));
    return await fetchRows(tab);
  }
}

const tidy = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

/**
 * Tour leaderboards: Supabase first (live tour data), then the Google
 * Sheet if configured, then built-in sample data.
 *
 * Sheet columns (row 1 is the header, skipped by gviz):
 *   Championship Leaderboard:       RANK | LEADER | POINTS | GRADE
 *   Longest Drive Leaderboard:      Rank | Name | Course | Distance | Hole | Grade
 *   Closest to the Pin Leaderboard: Rank | Name | Number | Grade
 */
export async function fetchTourLeaderboards(): Promise<TourLeaderboards> {
  if (!SHEET_ID) return SAMPLE;
  const safe = (p: Promise<string[][]>): Promise<string[][] | null> =>
    p.then((v) => v).catch(() => null);
  const [pts, ld, c2p] = await Promise.all([
    safe(fetchRowsRetry(SHEET_TABS.tourPoints)),
    safe(fetchRowsRetry(SHEET_TABS.longestDrive)),
    safe(fetchRowsRetry(SHEET_TABS.closestToPin)),
  ]);
  if (!pts && !ld && !c2p) return { ...SAMPLE, isSample: true };

    const tourPoints: TourLeaderboardRow[] = (pts || [])
      .filter((row) => tidy(row[1]))
      .map((row, i) => ({
        rank: i + 1,
        name: tidy(row[1]),
        value: `${tidy(row[2])} pts`,
        detail: tidy(row[3]) ? `Grade ${tidy(row[3])}` : undefined,
      }));

    const longestDrive: TourLeaderboardRow[] = (ld || [])
      .filter((row) => tidy(row[1]))
      .map((row, i) => ({
        rank: i + 1,
        name: tidy(row[1]),
        value: tidy(row[3]),
        detail: [tidy(row[2]), tidy(row[4]) ? `Hole ${tidy(row[4])}` : '']
          .filter(Boolean)
          .join(' · '),
      }));

    const closestToPin: TourLeaderboardRow[] = (c2p || [])
      .filter((row) => tidy(row[1]))
      .map((row, i) => {
        const n = tidy(row[2]);
        return {
          rank: i + 1,
          name: tidy(row[1]),
          value: n ? `${n} CTP${n === '1' ? '' : 's'}` : '',
          detail: tidy(row[3]) ? `Grade ${tidy(row[3])}` : undefined,
        };
      });

    return { tourPoints, longestDrive, closestToPin, isSample: false };
}


/** Season fixtures from the public "R2TC FIXTURE" tab. */
export async function fetchFixtures(): Promise<Fixture[]> {
  if (!SHEET_ID) return [];
  try {
    const rows = await fetchRows(SHEET_TABS.fixtures, true);
    return rows
      .filter((r) => (tidy(r[0]) || tidy(r[2])) && !(tidy(r[0]).toLowerCase() === 'round' && tidy(r[2]).toLowerCase() === 'venue'))
      .map((r) => ({
        round: tidy(r[0]),
        date: tidy(r[1]),
        venue: tidy(r[2]),
        teeTime: tidy(r[3]),
        cost: tidy(r[4]) || undefined,
        format: tidy(r[5]) || undefined,
      }));
  } catch (e) {
    return [];
  }
}


/** Raw rows from the tour's History tab (champions / awards). */
export async function fetchHistory(): Promise<string[][]> {
  if (!SHEET_ID) return [];
  try {
    const res: any = await Promise.race([
      fetch('https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&headers=0&sheet=History', { headers: { Accept: 'text/plain, */*' } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
    ]);
    if (!res.ok) return [];
    const txt: string = await Promise.race([
      res.text(),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
    ]);
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start < 0 || end < 0) return [];
    const json = JSON.parse(txt.slice(start, end + 1));
    const jrows = (json && json.table && json.table.rows) || [];
    return jrows.map((rw: any) => {
      const cells = (rw && rw.c) || [];
      return cells.map((cell: any) => (cell == null || cell.v == null ? '' : String(cell.v).trim()));
    });
  } catch {
    return [];
  }
}


/** Real course card (par + stroke index per hole) from Supabase course_data. */
export async function searchCoursesByName(q: string): Promise<{ id: string; name: string }[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const tokens = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const pattern = '*' + tokens.join('*') + '*';
    const url =
      SUPABASE_URL +
      '/rest/v1/course_data?select=name,clean&name_norm=ilike.' +
      encodeURIComponent(pattern) +
      '&order=clean.desc&limit=25';
    const res: any = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } });
    const rows = await res.json();
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    (rows || []).forEach((r: any) => { const nm = r && r.name; if (!nm) return; const k = String(nm).toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ id: String(nm), name: String(nm) }); });
    return out.slice(0, 20);
  } catch (e) { return []; }
}

export async function fetchCourseCard(name: string): Promise<{ pars: (number | null)[]; si: (number | null)[] } | null> {
  if (!name) return null;
  try {
    const stop = new Set(['golf', 'club', 'links', 'course', 'gc', 'cc', 'the', 'and', 'resort', 'country']);
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const allTokens = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const keyTokens = allTokens.filter((t) => !stop.has(t));
    const useTokens = keyTokens.length ? keyTokens : allTokens;
    if (!useTokens.length) return null;
    const pattern = '*' + useTokens.join('*') + '*';
    const url =
      SUPABASE_URL +
      '/rest/v1/course_data?select=name,name_norm,par,si,nholes,clean' +
      '&name_norm=ilike.' + encodeURIComponent(pattern) +
      '&order=clean.desc&limit=50';
    const res: any = await Promise.race([
      fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
    ]);
    if (!res.ok) return null;
    const rows: any[] = await res.json();
    if (!rows || !rows.length) return null;

    const target = norm(name);
    const score = (row: any) => {
      const rn = norm(row.name);
      let s = 0;
      if (rn === target) s += 1000;
      if (rn.indexOf(target) >= 0 || target.indexOf(rn) >= 0) s += 200;
      if (row.clean) s += 100;
      if (row.nholes === 18) s += 10;
      s -= Math.abs(rn.length - target.length) / 10;
      return s;
    };
    rows.sort((a, b) => score(b) - score(a));
    const best = rows[0];

    const toNums = (csv: string): (number | null)[] =>
      String(csv || '')
        .split(',')
        .map((v) => {
          const n = Number(String(v).trim());
          return Number.isFinite(n) ? n : null;
        });
    const pad = (arr: (number | null)[]) => {
      const out = arr.slice(0, 18);
      while (out.length < 18) out.push(null);
      return out;
    };
    return { pars: pad(toNums(best.par)), si: pad(toNums(best.si)) };
  } catch {
    return null;
  }
}

/** Pars per hole from GolfCourseAPI (no stroke index available there). */
export async function fetchApiPars(name: string): Promise<(number | null)[] | null> {
  if (!GOLF_API_KEY || !name) return null;
  try {
    const h = { Authorization: 'Key ' + GOLF_API_KEY };
    const sr = await fetch('https://api.golfcourseapi.com/v1/search?search_query=' + encodeURIComponent(name), { headers: h });
    if (!sr.ok) return null;
    const sj = await sr.json();
    const list = (sj && sj.courses) || [];
    if (!list.length) return null;
    const cr = await fetch('https://api.golfcourseapi.com/v1/courses/' + list[0].id, { headers: h });
    if (!cr.ok) return null;
    const cj = await cr.json();
    const course = cj.course || cj;
    const tees = (course && course.tees) || {};
    const tee = (tees.male && tees.male[0]) || (tees.female && tees.female[0]);
    if (!tee || !tee.holes) return null;
    return tee.holes.slice(0, 18).map((hh: any) => (hh && typeof hh.par === 'number' ? hh.par : null));
  } catch {
    return null;
  }
}


// ---------- GA Connect handicap + score helpers ----------

/** Read a Google Sheet tab (gviz JSON) into rows of trimmed string cells. */
async function fetchTabRows(tab: string): Promise<string[][]> {
  if (!SHEET_ID || !tab) return [];
  try {
    const url =
      'https://docs.google.com/spreadsheets/d/' +
      SHEET_ID +
      '/gviz/tq?tqx=out:json&headers=0&sheet=' +
      encodeURIComponent(tab);
    const res: any = await Promise.race([
      fetch(url, { headers: { Accept: 'text/plain, */*' } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
    ]);
    if (!res.ok) return [];
    const txt: string = await res.text();
    const a = txt.indexOf('{');
    const b = txt.lastIndexOf('}');
    if (a < 0 || b < 0) return [];
    const json = JSON.parse(txt.slice(a, b + 1));
    const rows = (json && json.table && json.table.rows) || [];
    return rows.map((r: any) => {
      const cells = (r && r.c) || [];
      return cells.map((cell: any) =>
        cell == null || cell.v == null ? '' : String(cell.v).trim(),
      );
    });
  } catch {
    return [];
  }
}

const normGolfId = (s: any) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '');
const toNum = (v: any) => {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Official GA handicap for a Golf ID. Sheet tab 'Handicaps': Golf ID | Name | GA Handicap. */
export async function fetchHandicapForGolfId(golfId: string): Promise<number | null> {
  if (!golfId) return null;
  const want = normGolfId(golfId);
  const rows = await fetchTabRows(SHEET_TABS.handicaps);
  for (const r of rows) {
    if (normGolfId(r[0]) === want) return toNum(r[2]);
  }
  return null;
}

export async function fetchHandicapByName(name: string): Promise<number | null> {
  if (!name) return null;
  const want = cleanLeaderName(name);
  const rows = await fetchTabRows(SHEET_TABS.handicaps);
  for (const r of rows) {
    if (cleanLeaderName(r[1] || '') === want) return toNum(r[2]);
  }
  return null;
}

export interface PastScore {
  date: string;
  course: string;
  score: number | null;
}

/** Past scores for a Golf ID. Sheet tab 'Scores': Golf ID | Name | Date | Course | Score. */
export async function fetchScoresForGolfId(golfId: string): Promise<PastScore[]> {
  if (!golfId) return [];
  const want = normGolfId(golfId);
  const rows = await fetchTabRows(SHEET_TABS.scores);
  const out: PastScore[] = [];
  for (const r of rows) {
    if (normGolfId(r[0]) === want) {
      out.push({ date: r[2] || '', course: r[3] || '', score: toNum(r[4]) });
    }
  }
  // newest first when dates are parseable
  out.sort((x, y) => {
    const dx = Date.parse(x.date);
    const dy = Date.parse(y.date);
    if (Number.isFinite(dx) && Number.isFinite(dy)) return dy - dx;
    return 0;
  });
  return out;
}

/** Daily (playing) handicap = round(index x slope / 113). */
export function dailyHandicap(index: number, slope: number): number | null {
  if (!Number.isFinite(index)) return null;
  if (!Number.isFinite(slope) || slope <= 0) return Math.round(index);
  return Math.round((index * slope) / 113);
}

/** Course slope rating from GolfCourseAPI (used for the daily handicap). */
export async function fetchApiSlope(name: string): Promise<number | null> {
  if (!GOLF_API_KEY || !name) return null;
  try {
    const h = { Authorization: 'Key ' + GOLF_API_KEY };
    const sr = await fetch(
      'https://api.golfcourseapi.com/v1/search?search_query=' + encodeURIComponent(name),
      { headers: h },
    );
    if (!sr.ok) return null;
    const sj = await sr.json();
    const list = (sj && sj.courses) || [];
    if (!list.length) return null;
    const cr = await fetch('https://api.golfcourseapi.com/v1/courses/' + list[0].id, { headers: h });
    if (!cr.ok) return null;
    const cj = await cr.json();
    const course = cj.course || cj;
    const tees = (course && course.tees) || {};
    const tee = (tees.male && tees.male[0]) || (tees.female && tees.female[0]);
    const slope = tee && tee.slope_rating;
    return typeof slope === 'number' && Number.isFinite(slope) ? slope : null;
  } catch {
    return null;
  }
}


/** Map of normalized Golf ID -> official GA handicap (whole 'Handicaps' tab). */
export async function fetchHandicapMap(): Promise<Record<string, number>> {
  const rows = await fetchTabRows(SHEET_TABS.handicaps);
  const map: Record<string, number> = {};
  for (const r of rows) {
    const id = normGolfId(r[0]);
    const h = toNum(r[2]);
    if (id && h != null) map[id] = h;
  }
  return map;
}

export interface ApiTee {
  name: string;
  slope: number | null;
  rating: number | null;
  par: number | null;
  gender: string;
}

/** Available tees (with slope rating) for a course, from GolfCourseAPI. */
export async function fetchApiTees(name: string): Promise<ApiTee[]> {
  if (!GOLF_API_KEY || !name) return [];
  const h = { Authorization: 'Key ' + GOLF_API_KEY };
  const base = (name || '').trim();
  const stripped = base
    .replace(/\b(golf club|golf course|golf links|country club|golf|club|course|links)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstTwo = base.split(/\s+/).slice(0, 2).join(' ');
  const queries: string[] = [];
  [base, stripped, firstTwo].forEach((q) => { if (q && queries.indexOf(q) < 0) queries.push(q); });
  for (const q of queries) {
    try {
      const sr = await fetch('https://api.golfcourseapi.com/v1/search?search_query=' + encodeURIComponent(q), { headers: h });
      if (!sr.ok) continue;
      const sj = await sr.json();
      const list = (sj && sj.courses) || [];
      for (const course of list) {
        const tees = (course && course.tees) || {};
        const out: ApiTee[] = [];
        (['male', 'female'] as const).forEach((g) => {
          (((tees as any)[g]) || []).forEach((t: any) => {
            out.push({
              name: t.tee_name || g,
              slope: typeof t.slope_rating === 'number' ? t.slope_rating : null,
              rating: typeof t.course_rating === 'number' ? t.course_rating : null,
              par: typeof t.par_total === 'number' ? t.par_total : null,
              gender: g,
            });
          });
        });
        if (out.length) return out;
      }
    } catch {}
  }
  return [];
}

export function cleanLeaderName(s: string): string {
  return (s || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b[abc]\s*grade\b[\s\S]*$/i, ' ')
    .replace(/\b(grade\s*leader|runner[\s-]*up|leader\s*leader)\b[\s\S]*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


/** Course records from the tour sheet. Tab 'Course Records':
 *  Category | Course | Record | Player | Year (row 1 is the header).
 *  Each distinct category becomes a button in the app. */
export interface CourseRecordRow {
  category: string;
  course: string;
  record: string;
  player: string;
  year: string;
}

export async function fetchCourseRecords(): Promise<CourseRecordRow[]> {
  const rows = await fetchTabRows('Course Records');
  return rows
    .map((r) => ({
      category: tidy(r[0] || ''),
      course: tidy(r[1] || ''),
      record: tidy(r[2] || ''),
      player: tidy(r[3] || ''),
      year: tidy(r[4] || ''),
    }))
    .filter((r) => r.category && r.course && r.category.toLowerCase() !== 'category');
}


export interface LongestDriveRecord {
  rank: number;
  name: string;
  course: string;
  distance: number;
  hole: string;
  grade: string;
  year: string;
}

const LD_RECORDS_GID = '1943875223';

export async function fetchLongestDriveRecords(): Promise<LongestDriveRecord[]> {
  if (!SHEET_ID) return [];
  const url =
    'https://docs.google.com/spreadsheets/d/' +
    SHEET_ID +
    '/gviz/tq?tqx=out:json&headers=0&gid=' +
    LD_RECORDS_GID;
  const res = await fetch(url, { headers: { Accept: 'text/plain, */*' } });
  if (!res.ok) throw new Error('Records fetch failed (' + res.status + ')');
  const txt: string = await Promise.race([
    res.text(),
    new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
  ]);
  const all = parseRows(txt);
  return all
    .map((r) => ({
      rank: parseInt(tidy(r[0] || ''), 10) || 0,
      name: canonicalName(tidy(r[1] || '')),
      course: tidy(r[2] || ''),
      distance: parseInt(tidy(r[3] || ''), 10) || 0,
      hole: tidy(r[4] || ''),
      grade: tidy(r[5] || '').toUpperCase(),
      year: tidy(r[6] || ''),
    }))
    .filter((r) => !!r.name && r.distance > 0)
    .sort((a, b) => b.distance - a.distance);
}


export async function fetchPlayerLongestDriveRecord(
  name: string,
): Promise<{ metres: number; course: string; hole: string; year: string } | null> {
  const nm = nameKey(name);
  if (!nm) return null;
  let all: LongestDriveRecord[] = [];
  try {
    all = await fetchLongestDriveRecords();
  } catch (e) {
    return null;
  }
  let best: LongestDriveRecord | null = null;
  for (const r of all) {
    if (nameKey(r.name) === nm && (!best || r.distance > best.distance)) best = r;
  }
  if (!best) return null;
  const m = best.hole.match(/\d+/);
  return { metres: best.distance, course: best.course, hole: m ? m[0] : best.hole, year: best.year };
}


const NAME_CANON: Array<{ keys: string[]; name: string }> = [
  { keys: ['warrendacosta'], name: 'Warren Da Costa' },
  { keys: ['seanragozzini', 'seanraggozini', 'seanragozinni', 'seanraggozzini'], name: 'Sean Ragozzini' },
  { keys: ['dylannandrew', 'dylanandrew', 'dylannandrews', 'dylanandrews'], name: 'Dylann Andrew' },
  { keys: ['warrickhanks', 'warwickhanks'], name: 'Warrick Hanks' },
  { keys: ['warrenayres', 'warrrenayres'], name: 'Warren Ayres' },
  { keys: ['glenngardiner', 'glengardiner'], name: 'Glenn Gardiner' },
  { keys: ['jesseholdsworth', 'jessieholdsworth'], name: 'Jesse Holdsworth' },
  { keys: ['jordanmargerberg', 'jordanmargenberg'], name: 'Jordan Margerberg' },
];

function nameLetters(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z]/g, '');
}

export function canonicalName(s: string): string {
  const k = nameLetters(s);
  for (const c of NAME_CANON) {
    if (c.keys.indexOf(k) >= 0) return c.name;
  }
  return (s || '').trim();
}

export function nameKey(s: string): string {
  return nameLetters(canonicalName(s));
}
