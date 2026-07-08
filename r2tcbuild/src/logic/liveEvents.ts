import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_KEY, getSession } from './supabase';
import { initScoreQueue, enqueueScore, flushScoreQueue, QueuedScore } from './offlineQueue';
import { Round } from '../types';
import { playingHandicap, strokesReceived } from './scoring';
import { makeId } from '../storage';

const rest = (p: string) => `${SUPABASE_URL}/rest/v1/${p}`;

async function authHeaders(): Promise<any> {
  const s = await getSession();
  const h: any = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (s) h.Authorization = `Bearer ${s.access_token}`;
  return h;
}

export interface LiveEvent { id: string; name: string; course_name: string | null; status: string; config: any; created_at: string; }
export interface LiveScoreRow { event_id: string; player_name: string; handicap: number; group_no: number; hole_number: number; strokes: number | null; }
export interface LiveStanding { name: string; groupNo: number; handicap: number; thru: number; strokes: number; toPar: number; net: number; netToPar: number; points: number; holes: Record<number, number>; pts: Record<number, number>; nets: Record<number, number>; wiped?: boolean; }

export async function createLiveEvent(name: string, courseName: string, config: any): Promise<LiveEvent | null> {
  const s = await getSession();
  if (!s) throw new Error('Sign in to create a live event.');
  const res = await fetch(rest('live_events'), {
    method: 'POST',
    headers: { ...(await authHeaders()), Prefer: 'return=representation' },
    body: JSON.stringify({ name, course_name: courseName || null, config, status: 'open' }),
  });
  if (!res.ok) throw new Error(`Could not create event (${res.status}).`);
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
}

export async function listOpenEvents(): Promise<LiveEvent[]> {
  try {
    const res = await fetch(rest('live_events?status=eq.open&select=*&order=created_at.desc'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function fetchFinishedEvents(): Promise<LiveEvent[]> {
  try {
    const res = await fetch(rest('live_events?status=eq.finished&select=*&order=created_at.desc'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function finishLiveEvent(id: string): Promise<void> {
  try {
    await fetch(rest(`live_events?id=eq.${id}`), { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ status: 'finished' }) });
  } catch {}
}

export async function pushLiveScores(round: Round): Promise<void> {
  if (!round.liveEventId) return;
  try {
    const groupOf: Record<string, number> = {};
    (round.groups || []).forEach((g, gi) => g.forEach((pid) => { groupOf[pid] = gi + 1; }));
    const rows: any[] = [];
    round.players.forEach((p) => {
      p.scores.forEach((s, i) => {
        if (s != null) rows.push({ event_id: round.liveEventId, player_name: p.name, handicap: p.handicap, group_no: round.liveGroupNo || groupOf[p.id] || 1, hole_number: round.holeNumbers[i], strokes: s });
      });
    });
    if (rows.length === 0) return;
    await fetch(rest('live_scores?on_conflict=event_id,player_name,hole_number'), {
      method: 'POST',
      headers: { ...(await authHeaders()), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });
  } catch {}
}

export async function fetchLiveScores(eventId: string): Promise<LiveScoreRow[]> {
  try {
    const res = await fetch(rest(`live_scores?event_id=eq.${eventId}&select=*`), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export function buildStandings(rows: LiveScoreRow[], config: any): LiveStanding[] {
  const holes = (config && config.holes) || [];
  const holeNumbers: number[] = (config && config.holeNumbers) || [];
  const parByHoleNo: Record<number, number> = {};
  holeNumbers.forEach((hn, i) => { if (holes[i]) parByHoleNo[hn] = holes[i].par; });
  const byPlayer: Record<string, { groupNo: number; handicap: number; holes: Record<number, number> }> = {};
  rows.forEach((r) => {
    if (!byPlayer[r.player_name]) byPlayer[r.player_name] = { groupNo: r.group_no, handicap: r.handicap || 0, holes: {} };
    if (r.strokes != null) byPlayer[r.player_name].holes[r.hole_number] = r.strokes;
  });
  const out: LiveStanding[] = Object.keys(byPlayer).map((name) => {
    const p = byPlayer[name];
    const holeNos = Object.keys(p.holes).map(Number);
    let strokes = 0, parPlayed = 0, points = 0, netStrokes = 0;
    const phcp = playingHandicap(p.handicap, holes.length || 18);
    const pts: Record<number, number> = {};
    const nets: Record<number, number> = {};
      let wiped = false;
    holeNos.forEach((hn) => {
      const g = p.holes[hn];
        if (g === 0) { wiped = true; pts[hn] = 0; nets[hn] = 0; parPlayed += parByHoleNo[hn] || 0; return; }
      strokes += g; parPlayed += parByHoleNo[hn] || 0;
      const info = holes[holeNumbers.indexOf(hn)];
      if (info) {
        const net = g - strokesReceived(phcp, info, holes);
        const sb = Math.max(0, 2 + info.par - net);
        pts[hn] = sb; points += sb;
        nets[hn] = net; netStrokes += net;
      } else { pts[hn] = 0; nets[hn] = g; netStrokes += g; }
    });
    return { name, groupNo: p.groupNo, handicap: p.handicap, thru: holeNos.length, strokes, toPar: strokes - parPlayed, net: netStrokes, netToPar: netStrokes - parPlayed, points, holes: p.holes, pts, nets, wiped };
  });
  out.sort((a, b) => a.toPar - b.toPar || b.thru - a.thru);
  return out;
}


/** Build a scoring round for one group of a live event. */
export function buildRoundFromEvent(ev: LiveEvent, groupIndex: number): Round {
  const cfg = ev.config || {};
  const holes = cfg.holes || [];
  const holeNumbers = cfg.holeNumbers || holes.map((_: any, i: number) => i + 1);
  const group = (cfg.groups || [])[groupIndex] || [];
  const holeSelection: any =
    holeNumbers.length >= 18 ? 'full18' : holeNumbers[0] > 9 ? 'back9' : 'front9';
  return {
    id: makeId(),
    name: ev.name,
    courseName: ev.course_name || 'Course',
    date: cfg.date || ev.created_at || new Date().toISOString(),
    holeSelection,
    holes,
    holeNumbers,
    primaryFormat: cfg.format || 'stableford',
    formatSettings: cfg.formatSettings || {},
    teams: cfg.teams || [],
    players: group.map((p: any) => ({
      id: p.id,
      name: p.name,
      handicap: p.handicap,
      scores: holes.map(() => null),
    })),
    groups: [group.map((p: any) => p.id)],
    contests: (ev.config && ev.config.contests) || { longestDrive: [], closestToPin: [] },
    contestResults: [],
    status: 'active',
    liveEventId: ev.id,
    liveGroupNo: groupIndex + 1,
    creatorEmail: cfg.created_by_email || undefined,
  } as Round;
}


/** Index of the group containing this player's name, or -1. */
export function findMyGroupIndex(ev: LiveEvent, name: string, id?: string): number {
  const groups = (ev.config && ev.config.groups) || [];
  const n = (name || '').trim().toLowerCase();
  const myId = (id || '').trim();
  if (!n && !myId) return -1;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].some((p: any) => (myId && String(p.id || '') === myId) || (n && (p.name || '').trim().toLowerCase() === n))) return i;
  }
  return -1;
}


/** Permanently delete an event and its scores (creator only, enforced by RLS). */
export async function deleteLiveEvent(
  id: string,
): Promise<{ ok: boolean; status: number; deleted: number; error?: string }> {
  try {
    const _ch = await authHeaders();
    await fetch(rest('live_scores?event_id=eq.' + id), { method: 'DELETE', headers: _ch }).catch(function(){});
    await fetch(rest('live_messages?event_id=eq.' + id), { method: 'DELETE', headers: _ch }).catch(function(){});
    await fetch(rest('live_contests?event_id=eq.' + id), { method: 'DELETE', headers: _ch }).catch(function(){});
    const res = await fetch(rest('live_events?id=eq.' + id), {
      method: 'DELETE',
      headers: { ...(await authHeaders()), Prefer: 'return=representation' },
    });
    const text = await res.text();
    let deleted = 0;
    try {
      const arr = JSON.parse(text);
      deleted = Array.isArray(arr) ? arr.length : 0;
    } catch (e) {}
    return {
      ok: res.ok,
      status: res.status,
      deleted,
      error: res.ok ? undefined : text.slice(0, 140),
    };
  } catch (e: any) {
    return { ok: false, status: 0, deleted: 0, error: e && e.message ? e.message : String(e) };
  }
}


export interface LiveMessage {
  id: string;
  event_id: string;
  author: string;
  text: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
}

export async function fetchMessages(eventId: string): Promise<LiveMessage[]> {
  try {
    const res = await fetch(
      rest(`live_messages?event_id=eq.${eventId}&select=*&order=created_at.asc&limit=300`),
      { headers: await authHeaders() },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function sendMessage(eventId: string, author: string, text: string, mediaUrl?: string | null, mediaType?: string | null): Promise<void> {
  try {
    await fetch(rest('live_messages'), {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ event_id: eventId, author, text, media_url: mediaUrl || null, media_type: mediaType || null }),
    });
    notifyEveryoneExceptMe(author || 'R2TC chat', text || (mediaUrl ? '📷 Photo' : 'New message'), { type: 'chat', eventId });
  } catch {}
}


export interface FeedPost {
  id: string;
  author: string;
  text: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
}

export async function fetchPosts(): Promise<FeedPost[]> {
  try {
    const res = await fetch(
      rest('feed_posts?select=*&order=created_at.desc&limit=100'),
      { headers: await authHeaders() },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createPost(
  author: string,
  text: string,
  mediaUrl?: string | null,
  mediaType?: string | null,
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(rest('feed_posts'), {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        author,
        text,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      }),
    });
    const t = res.ok ? '' : await res.text();
    if (res.ok) { notifyEveryoneExceptMe((author || 'Someone') + ' posted', text || (mediaUrl ? 'Shared a photo' : 'New post on the feed'), { type: 'feed' }); }
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : t.slice(0, 150) };
  } catch (e: any) {
    return { ok: false, status: 0, error: e && e.message ? e.message : String(e) };
  }
}


/** Upload a photo/video to the public 'feed' storage bucket; returns its URL. */
export async function uploadMedia(uri: string, contentType: string): Promise<string | null> {
  try {
    const s = await getSession();
    if (!s) return null;
    const ext = contentType.indexOf('video') === 0 ? 'mp4' : 'jpg';
    const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const up = await fetch(SUPABASE_URL + '/storage/v1/object/feed/' + path, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + s.access_token,
        'Content-Type': contentType,
      },
      body: blob,
    });
    if (!up.ok) return null;
    return SUPABASE_URL + '/storage/v1/object/public/feed/' + path;
  } catch {
    return null;
  }
}


/** Delete a feed post by id. */
export async function deletePost(id: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(rest('feed_posts') + '?id=eq.' + id, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}


export async function getEvent(eventId: string): Promise<any> {
  if (!eventId) return null;
  const url = rest('live_events?id=eq.' + eventId + '&select=*');
  try {
    let res = await fetch(url, { headers: await authHeaders() });
    if (!res.ok) res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  } catch { return null; }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise(function (resolve, reject) {
    const t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}

async function sendLiveScoreRaw(event_id: string, player_name: string, handicap: number, group_no: number, hole_number: number, strokes: number): Promise<boolean> {
  const res = await fetch(rest('live_scores?on_conflict=event_id,player_name,hole_number'), {
    method: 'POST',
    headers: { ...(await authHeaders()), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ event_id: event_id, player_name: player_name, handicap: handicap, group_no: group_no, hole_number: hole_number, strokes: strokes }]),
  });
  if (res.ok) return true;
  return res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429;
}

async function sendClearScoreRaw(event_id: string, player_name: string, hole_number: number): Promise<boolean> {
  const res = await fetch(rest('live_scores?event_id=eq.' + event_id + '&player_name=eq.' + encodeURIComponent(player_name) + '&hole_number=eq.' + hole_number), { method: 'DELETE', headers: await authHeaders() });
  if (res.ok) return true;
  return res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429;
}

initScoreQueue(function (item: QueuedScore): Promise<boolean> {
  if (item.op === 'set') return sendLiveScoreRaw(item.event_id, item.player_name, item.handicap, item.group_no, item.hole_number, item.strokes as number);
  return sendClearScoreRaw(item.event_id, item.player_name, item.hole_number);
});

export async function setLiveScore(eventId: string, playerName: string, handicap: number, groupNo: number, holeNumber: number, strokes: number): Promise<void> {
  try { await flushScoreQueue(); } catch (e) {}
  let ok = false;
  try { ok = await withTimeout(sendLiveScoreRaw(eventId, playerName, handicap, groupNo, holeNumber, strokes), 10000); } catch (e) { ok = false; }
  if (!ok) {
    try {
      await enqueueScore({ k: eventId + '|' + String(playerName || '').toLowerCase() + '|' + holeNumber, op: 'set', event_id: eventId, player_name: playerName, handicap: handicap, group_no: groupNo, hole_number: holeNumber, strokes: strokes, ts: Date.now() });
    } catch (e) {}
  }
}

export async function clearLiveScore(eventId: string, playerName: string, holeNumber: number): Promise<void> {
  try { await flushScoreQueue(); } catch (e) {}
  let ok = false;
  try { ok = await withTimeout(sendClearScoreRaw(eventId, playerName, holeNumber), 10000); } catch (e) { ok = false; }
  if (!ok) {
    try {
      await enqueueScore({ k: eventId + '|' + String(playerName || '').toLowerCase() + '|' + holeNumber, op: 'clear', event_id: eventId, player_name: playerName, handicap: 0, group_no: 0, hole_number: holeNumber, strokes: null, ts: Date.now() });
    } catch (e) {}
  }
}

export async function updateEventConfig(eventId: string, patch: any): Promise<{ ok: boolean; status: number; count: number; error: string }> {
  try {
    const ev = await getEvent(eventId);
    if (!ev) return { ok: false, status: 0, count: 0, error: 'Could not read this event (not found / no access).' };
    const merged = { ...(ev.config || {}), ...patch };
    const res = await fetch(rest('live_events?id=eq.' + eventId), {
      method: 'PATCH',
      headers: { ...(await authHeaders()), Prefer: 'return=representation' },
      body: JSON.stringify({ config: merged }),
    });
    const txt = await res.text();
    let count = 0;
    try { const arr = JSON.parse(txt); count = Array.isArray(arr) ? arr.length : 0; } catch {}
    return { ok: res.ok && count > 0, status: res.status, count, error: res.ok ? '' : txt.slice(0, 150) };
  } catch (e: any) {
    return { ok: false, status: 0, count: 0, error: e && e.message ? e.message : String(e) };
  }
}


export async function pushContestResult(eventId: string, type: string, holeNumber: number, playerName: string, metres: number | null): Promise<void> {
  try {
    await fetch(rest('live_contests?on_conflict=event_id,type,hole_number,player_name'), {
      method: 'POST',
      headers: { ...(await authHeaders()), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ event_id: eventId, type: type, hole_number: holeNumber, player_name: playerName, metres: metres }]),
    });
  } catch {}
}

export async function removeContestResult(eventId: string, type: string, holeNumber: number, playerName: string): Promise<void> {
  try {
    await fetch(rest('live_contests?event_id=eq.' + eventId + '&type=eq.' + type + '&hole_number=eq.' + holeNumber + '&player_name=eq.' + encodeURIComponent(playerName)), { method: 'DELETE', headers: await authHeaders() });
  } catch {}
}

export async function fetchContestResults(eventId: string): Promise<any[]> {
  try {
    const res = await fetch(rest('live_contests?event_id=eq.' + eventId + '&select=*'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}


import { holeResults } from './scoring';
export async function fetchPlayerHistory(
  name: string,
): Promise<{ date: string; course: string; score: number | null; stableford: number | null; holeCount: number; format: string; excluded: boolean; incomplete: boolean }[]> {
  if (!name) return [];
  try {
    const events = await fetchFinishedEvents();
    if (!events.length) return [];
    const byId: Record<string, LiveEvent> = {};
    events.forEach((e) => { byId[e.id] = e; });
    const res = await fetch(
      rest('live_scores?select=event_id,hole_number,strokes,handicap&player_name=eq.' + encodeURIComponent(name)),
      { headers: await authHeaders() },
    );
    if (!res.ok) return [];
    const rows: any[] = await res.json();
    const byEvent: Record<string, any[]> = {};
    rows.forEach((r) => { if (byId[r.event_id]) (byEvent[r.event_id] = byEvent[r.event_id] || []).push(r); });
    const out = Object.keys(byEvent).map((eid) => {
      const e = byId[eid];
      const cfg: any = (e as any).config || {};
      const holes: any[] = cfg.holes || [];
      const holeNumbers: number[] = cfg.holeNumbers || holes.map((_: any, i: number) => i + 1);
      const rowsE = byEvent[eid];
      const byHole: Record<number, number> = {};
      rowsE.forEach((r) => { if (r.strokes !== null && r.strokes !== undefined) byHole[r.hole_number] = r.strokes; });
      const scoresArr = holeNumbers.map((hn) => (byHole[hn] !== undefined ? byHole[hn] : null));
      const strokeTotal = scoresArr.reduce((a: number, v: any) => a + (typeof v === 'number' ? v : 0), 0);
      const hcap = rowsE.length && typeof rowsE[0].handicap === 'number' ? rowsE[0].handicap : 0;
      let stableford: number | null = null;
      try {
        if (holes.length) {
          const hr = holeResults({ handicap: hcap, scores: scoresArr } as any, holes as any);
          stableford = hr.reduce((a: number, h: any) => a + (h.stableford || 0), 0);
        }
      } catch (e2) {}
      return {
        date: (e.created_at || '').slice(0, 10),
        course: e.name || e.course_name || 'R2TC Event',
        score: strokeTotal || null,
        holeCount: holeNumbers.length,
        format: cfg.format || 'stroke',
        excluded: Array.isArray(cfg.excludeFromRecords) && cfg.excludeFromRecords.indexOf(name) !== -1,
        incomplete: Array.isArray(cfg.incompletePlayers) && cfg.incompletePlayers.indexOf(name) !== -1,
        stableford,
      };
    });
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  } catch {
    return [];
  }
}


export function buildFullRoundFromEvent(ev: LiveEvent): Round {
  const cfg = ev.config || {};
  const holes = cfg.holes || [];
  const holeNumbers = cfg.holeNumbers || holes.map((_: any, i: number) => i + 1);
  const groups = (cfg.groups || []);
  const holeSelection: any = holeNumbers.length >= 18 ? 'full18' : holeNumbers[0] > 9 ? 'back9' : 'front9';
  const allPlayers: any[] = [];
  groups.forEach((g: any) => (g || []).forEach((p: any) => allPlayers.push(p)));
  return {
    id: makeId(),
    name: ev.name,
    courseName: ev.course_name || 'Course',
    date: cfg.date || ev.created_at || new Date().toISOString(),
    holeSelection,
    holes,
    holeNumbers,
    primaryFormat: cfg.format || 'stableford',
    formatSettings: cfg.formatSettings || {},
    teams: cfg.teams || [],
    players: allPlayers.map((p: any) => ({ id: p.id, name: p.name, handicap: p.handicap, scores: holes.map(() => null) })),
    groups: groups.map((g: any) => (g || []).map((p: any) => p.id)),
    contests: (ev.config && ev.config.contests) || { longestDrive: [], closestToPin: [] },
    contestResults: [],
    status: 'active',
    liveEventId: ev.id,
    creatorEmail: cfg.created_by_email || undefined,
  } as Round;
}


/* ===== MARKETPLACE (member buy/sell) ===== */
export interface MarketItem { id: string; created_at: string; seller_email: string; seller_name: string; title: string; price?: string | null; category?: string | null; description?: string | null; image_url?: string | null; sold?: boolean; }

export async function fetchMarketItems(): Promise<MarketItem[]> {
  try {
    const res = await fetch(rest('market_items?select=*&order=created_at.desc&limit=300'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function createMarketItem(item: { seller_email: string; seller_name: string; title: string; price?: string | null; category?: string | null; description?: string | null; image_url?: string | null; }): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const body = { ...item, seller_email: String(item.seller_email || '').toLowerCase() };
    const res = await fetch(rest('market_items'), { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
    const t = res.ok ? '' : await res.text();
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : t.slice(0, 150) };
  } catch (e: any) { return { ok: false, status: 0, error: e && e.message ? e.message : String(e) }; }
}

export async function setMarketItemSold(id: string, sold: boolean): Promise<boolean> {
  try {
    const res = await fetch(rest('market_items?id=eq.' + id), { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ sold }) });
    return res.ok;
  } catch { return false; }
}

export async function deleteMarketItem(id: string): Promise<boolean> {
  try {
    const res = await fetch(rest('market_items?id=eq.' + id), { method: 'DELETE', headers: await authHeaders() });
    return res.ok;
  } catch { return false; }
}

/* ===== PRIVATE MEMBER MESSAGES (DM) ===== */
export interface DmMessage { id: string; created_at: string; thread_key: string; from_email: string; from_name: string; to_email: string; to_name: string; text: string; item_id?: string | null; item_title?: string | null; item_image?: string | null; read?: boolean; }

export function dmThreadKey(a: string, b: string): string {
  return [String(a || '').toLowerCase(), String(b || '').toLowerCase()].sort().join('|');
}

export async function fetchMyMessages(myEmail: string): Promise<DmMessage[]> {
  try {
    const res = await fetch(rest('dm_messages?select=*&order=created_at.asc&limit=2000'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function sendDm(msg: { from_email: string; from_name: string; to_email: string; to_name: string; text: string; item_id?: string | null; item_title?: string | null; item_image?: string | null; }): Promise<boolean> {
  try {
    const from = String(msg.from_email || '').toLowerCase();
    const to = String(msg.to_email || '').toLowerCase();
    const body = { from_email: from, from_name: msg.from_name, to_email: to, to_name: msg.to_name, text: msg.text, item_id: msg.item_id || null, item_title: msg.item_title || null, item_image: msg.item_image || null, thread_key: dmThreadKey(from, to) };
    const res = await fetch(rest('dm_messages'), { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
    if (res.ok) { notifyEmail(to, msg.from_name || 'New message', msg.text || (msg.item_image ? '📷 Photo' : 'Sent you a message'), { type: 'dm', thread: body.thread_key }); }
    return res.ok;
  } catch { return false; }
}

export async function markThreadRead(myEmail: string, otherEmail: string): Promise<boolean> {
  try {
    const tk = dmThreadKey(myEmail, otherEmail);
    const me = String(myEmail || '').toLowerCase();
    const res = await fetch(rest('dm_messages?thread_key=eq.' + tk + '&to_email=eq.' + me + '&read=eq.false'), { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ read: true }) });
    return res.ok;
  } catch { return false; }
}


export interface FeedReaction { id: string; post_id: string; email: string; type: string; }

export async function fetchReactions(): Promise<FeedReaction[]> {
  try {
    const res = await fetch(rest('feed_reactions?select=*&limit=5000'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function setReaction(postId: string, email: string, type: string): Promise<boolean> {
  try {
    const res = await fetch(rest('feed_reactions?on_conflict=post_id,email'), { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ post_id: postId, email: String(email || '').toLowerCase(), type }) });
    return res.ok;
  } catch { return false; }
}

export async function removeReaction(postId: string, email: string): Promise<boolean> {
  try {
    const res = await fetch(rest('feed_reactions?post_id=eq.' + postId + '&email=eq.' + encodeURIComponent(String(email || '').toLowerCase())), { method: 'DELETE', headers: await authHeaders() });
    return res.ok;
  } catch { return false; }
}


// ---- Push notifications ----
const EXPO_PROJECT_ID = '576a616a-851c-4a59-af9f-e80ab0f36e06';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
} catch (e) {}

export async function savePushToken(email: string, token: string): Promise<void> {
  try {
    await fetch(rest('push_tokens?on_conflict=email'), {
      method: 'POST',
      headers: { ...(await authHeaders()), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ email: String(email || '').toLowerCase(), token, updated_at: new Date().toISOString() }),
    });
  } catch (e) {}
}

export async function fetchPushTokens(): Promise<{ email: string; token: string }[]> {
  try {
    const res = await fetch(rest('push_tokens?select=email,token'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}

async function sendExpoPush(tokens: string[], title: string, body: string, data: any): Promise<void> {
  const valid = (tokens || []).filter((t) => typeof t === 'string' && t.indexOf('ExponentPushToken') === 0);
  if (!valid.length) return;
  const messages = valid.map((to) => ({ to, title, body, sound: 'default', data: data || {} }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) {}
}

export async function notifyEmail(email: string, title: string, body: string, data?: any): Promise<void> {
  try {
    const base = rest('').replace('/rest/v1/', '');
    await fetch(base + '/functions/v1/send-push', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ emails: [String(email || '').toLowerCase()], title, body, data: data || {} }),
    });
  } catch (e) {}
}

export async function notifyEveryoneExceptMe(title: string, body: string, data?: any): Promise<void> {
  try {
    let mine = '';
    try { mine = (await AsyncStorage.getItem('r2tc.pushToken')) || ''; } catch (e) {}
    const base = rest('').replace('/rest/v1/', '');
    await fetch(base + '/functions/v1/send-push', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ all: true, excludeToken: mine, title, body, data: data || {} }),
    });
  } catch (e) {}
}

export async function registerForPush(email: string): Promise<void> {
  try {
    if (!email) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1e7d34',
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;
    const tok = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
    const token = tok.data;
    if (token) {
      try { await AsyncStorage.setItem('r2tc.pushToken', token); } catch (e) {}
      await savePushToken(email, token);
    }
  } catch (e) {}
}


// ---- Event completion / past-rounds gating ----
export async function markGroupFinished(eventId: string, groupIndex: number): Promise<{ allDone: boolean }> {
  try {
    const ev = await getEvent(eventId);
    if (!ev) return { allDone: false };
    const cfg = (ev.config || {}) as any;
    const groups = cfg.groups || [];
    const finished: number[] = Array.isArray(cfg.finishedGroups) ? cfg.finishedGroups.slice() : [];
    if (finished.indexOf(groupIndex) === -1) finished.push(groupIndex);
    await updateEventConfig(eventId, { finishedGroups: finished });
    const allDone = groups.length > 0 && finished.length >= groups.length;
    if (allDone) await finishLiveEvent(eventId);
    return { allDone };
  } catch (e) { return { allDone: false }; }
}

export async function buildFinishedRoundFromEvent(ev: LiveEvent): Promise<Round> {
  const r: any = buildFullRoundFromEvent(ev);
  try {
    const rows: any[] = await fetchLiveScores(ev.id);
    const byName: Record<string, Record<number, number>> = {};
    (rows || []).forEach((row: any) => {
      if (!byName[row.player_name]) byName[row.player_name] = {};
      if (row.strokes !== null && row.strokes !== undefined) byName[row.player_name][row.hole_number] = row.strokes;
    });
    r.players = (r.players || []).map((p: any) => ({
      ...p,
      scores: (r.holeNumbers || []).map((hn: number) => {
        const v = byName[p.name] ? byName[p.name][hn] : undefined;
        return typeof v === 'number' ? v : null;
      }),
    }));
  } catch (e) {}
  try {
    const cr: any[] = await fetchContestResults(ev.id);
    r.contestResults = (cr || []).map((c: any) => ({
      type: c.type,
      holeNumber: c.hole_number,
      winner: c.player_name,
      metres: c.metres === null || c.metres === undefined ? null : Number(c.metres),
    }));
  } catch (e) {}
  r.status = 'finished';
  return r as Round;
}

export async function fetchMyFinishedRounds(name: string): Promise<Round[]> {
  try {
    if (!name) return [];
    const evs = await fetchFinishedEvents();
    const mine = (evs || []).filter((ev) => findMyGroupIndex(ev, name) >= 0);
    const out: Round[] = [];
    for (const ev of mine) { const fr = await buildFinishedRoundFromEvent(ev); (fr as any).roundType = (((ev as any).config && (ev as any).config.roundType) || 'r2tc'); out.push(fr); }
    return out;
  } catch (e) { return []; }
}


// ---- DM message reactions ----
export async function fetchDmReactions(): Promise<any[]> {
  try {
    const res = await fetch(rest('dm_reactions?select=*&limit=5000'), { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}
export async function setDmReaction(messageId: string, email: string, type: string): Promise<void> {
  try {
    await fetch(rest('dm_reactions?on_conflict=message_id,email'), {
      method: 'POST',
      headers: { ...(await authHeaders()), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ message_id: messageId, email: String(email || '').toLowerCase(), type }),
    });
  } catch (e) {}
}
export async function removeDmReaction(messageId: string, email: string): Promise<void> {
  try {
    await fetch(rest('dm_reactions?message_id=eq.' + encodeURIComponent(messageId) + '&email=eq.' + encodeURIComponent(String(email || '').toLowerCase())), { method: 'DELETE', headers: await authHeaders() });
  } catch (e) {}
}


// ---- Group chat threads ----
export interface ChatThread { thread_key: string; title: string; members: { email: string; name: string }[]; created_by: string; created_at?: string; }
export function newGroupKey(): string { return 'g:' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
export async function fetchMyThreads(myEmail: string): Promise<ChatThread[]> {
  try {
    const res = await fetch(rest('dm_threads?select=*&order=created_at.desc&limit=500'), { headers: await authHeaders() });
    if (!res.ok) return [];
    const all = await res.json();
    const me = String(myEmail || '').toLowerCase();
    return (all || []).filter((t: any) => Array.isArray(t.members) && t.members.some((m: any) => String(m.email || '').toLowerCase() === me));
  } catch (e) { return []; }
}
export async function createGroupThread(title: string, members: { email: string; name: string }[], creatorEmail: string): Promise<string | null> {
  try {
    const key = newGroupKey();
    const body = { thread_key: key, title: title || 'Group chat', members, created_by: String(creatorEmail || '').toLowerCase() };
    const res = await fetch(rest('dm_threads'), { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
    return res.ok ? key : null;
  } catch (e) { return null; }
}
export async function renameThread(threadKey: string, title: string): Promise<void> {
  try { await fetch(rest('dm_threads?thread_key=eq.' + encodeURIComponent(threadKey)), { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ title }) }); } catch (e) {}
}
export async function setThreadMembers(threadKey: string, members: { email: string; name: string }[]): Promise<void> {
  try { await fetch(rest('dm_threads?thread_key=eq.' + encodeURIComponent(threadKey)), { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ members }) }); } catch (e) {}
}
export async function sendGroupDm(threadKey: string, fromEmail: string, fromName: string, title: string, text: string, image: string | null, memberEmails: string[]): Promise<boolean> {
  try {
    const from = String(fromEmail || '').toLowerCase();
    const body = { from_email: from, from_name: fromName, to_email: '', to_name: title, text: text || '', item_id: null, item_title: null, item_image: image || null, thread_key: threadKey };
    const res = await fetch(rest('dm_messages'), { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
    if (res.ok) {
      (memberEmails || []).forEach((em) => { const e = String(em || '').toLowerCase(); if (e && e !== from) notifyEmail(e, title || fromName, (fromName ? fromName + ': ' : '') + (text || (image ? '📷 Photo' : '')), { type: 'dm', thread: threadKey }); });
    }
    return res.ok;
  } catch (e) { return false; }
}


export async function deleteThread(threadKey: string): Promise<void> {
  try {
    await fetch(rest('dm_messages?thread_key=eq.' + encodeURIComponent(threadKey)), { method: 'DELETE', headers: await authHeaders() });
    await fetch(rest('dm_threads?thread_key=eq.' + encodeURIComponent(threadKey)), { method: 'DELETE', headers: await authHeaders() });
  } catch (e) {}
}
export async function unsendDm(messageId: string): Promise<void> {
  try { await fetch(rest('dm_messages?id=eq.' + encodeURIComponent(messageId)), { method: 'DELETE', headers: await authHeaders() }); } catch (e) {}
}


/** Admin: rename a player across a finished/live event (scores, contests, config). */
export async function renamePlayer(eventId: string, oldName: string, newName: string): Promise<{ ok: boolean; error?: string }> {
  const on = (oldName || '').trim();
  const nn = (newName || '').trim();
  if (!eventId || !on || !nn || on === nn) return { ok: false, error: 'Nothing to change.' };
  try {
    const h = await authHeaders();
    await fetch(rest('live_scores?event_id=eq.' + eventId + '&player_name=eq.' + encodeURIComponent(on)), {
      method: 'PATCH', headers: h, body: JSON.stringify({ player_name: nn }),
    });
    await fetch(rest('live_contests?event_id=eq.' + eventId + '&player_name=eq.' + encodeURIComponent(on)), {
      method: 'PATCH', headers: h, body: JSON.stringify({ player_name: nn }),
    });
    const ev = await getEvent(eventId);
    const cfg: any = (ev && ev.config) || {};
    const groups = (cfg.groups || []).map((g: any[]) =>
      (g || []).map((p: any) => (String(p && p.name || '').trim() === on ? { ...p, name: nn } : p)),
    );
    const teams = (cfg.teams || []).map((t: any[]) =>
      (t || []).map((x: any) =>
        typeof x === 'string'
          ? (x.trim() === on ? nn : x)
          : (x && x.name && String(x.name).trim() === on ? { ...x, name: nn } : x),
      ),
    );
    const patch: any = { groups, teams };
    if (Array.isArray(cfg.excludeFromRecords)) {
      patch.excludeFromRecords = cfg.excludeFromRecords.map((x: string) => (String(x).trim() === on ? nn : x));
    }
    if (cfg.incompletePlayers && typeof cfg.incompletePlayers === 'object' && cfg.incompletePlayers[on] !== undefined) {
      const ip: any = { ...cfg.incompletePlayers };
      ip[nn] = ip[on];
      delete ip[on];
      patch.incompletePlayers = ip;
    }
    const r = await updateEventConfig(eventId, patch);
    return { ok: !!r.ok, error: r.ok ? undefined : (r.error || 'Could not update the round.') };
  } catch (e: any) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}


/** Admin: change the display name of an event (course name is left unchanged). */
export async function renameEventName(eventId: string, newName: string): Promise<{ ok: boolean; error?: string }> {
  const nn = (newName || '').trim();
  if (!eventId || !nn) return { ok: false, error: 'Enter a name.' };
  try {
    const res = await fetch(rest('live_events?id=eq.' + eventId), {
      method: 'PATCH',
      headers: { ...(await authHeaders()), Prefer: 'return=representation' },
      body: JSON.stringify({ name: nn }),
    });
    return { ok: res.ok, error: res.ok ? undefined : ('Could not update (status ' + res.status + ').') };
  } catch (e: any) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}


/** A player's personal-best longest drive (max metres) and closest-to-pin (min metres). */
export async function fetchPlayerContestBests(name: string): Promise<{ longestDrive: number | null; closestToPin: number | null }> {
  if (!name) return { longestDrive: null, closestToPin: null };
  try {
    const res = await fetch(rest('live_contests?select=type,metres&player_name=eq.' + encodeURIComponent(name)), { headers: await authHeaders() });
    if (!res.ok) return { longestDrive: null, closestToPin: null };
    const rows: any[] = await res.json();
    let ld: number | null = null;
    let ctp: number | null = null;
    (rows || []).forEach((r) => {
      const m = typeof r.metres === 'number' ? r.metres : null;
      if (m === null) return;
      if (r.type === 'longestDrive') { if (ld === null || m > ld) ld = m; }
      else if (r.type === 'closestToPin') { if (ctp === null || m < ctp) ctp = m; }
    });
    return { longestDrive: ld, closestToPin: ctp };
  } catch { return { longestDrive: null, closestToPin: null }; }
}


export async function fetchAllFinishedRounds(): Promise<Round[]> {
  try {
    const evs = await fetchFinishedEvents();
    const out: Round[] = [];
    for (const ev of (evs || [])) {
      const fr = await buildFinishedRoundFromEvent(ev);
      (fr as any).roundType = (((ev as any).config && (ev as any).config.roundType) || 'r2tc');
      out.push(fr);
    }
    return out;
  } catch (e) { return []; }
}


export async function fetchPlayerContestRecords(name: string): Promise<{ ld: any; ctp: any }> {
  try {
    const res = await fetch(
      rest('live_contests?select=event_id,type,hole_number,metres&player_name=eq.' + encodeURIComponent(name)),
      { headers: await authHeaders() },
    );
    if (!res.ok) return { ld: null, ctp: null };
    const rows: any[] = await res.json();
    let ld: any = null;
    let ctp: any = null;
    rows.forEach((r: any) => {
      const m = typeof r.metres === 'number' ? r.metres : parseFloat(r.metres);
      if (!isFinite(m)) return;
      if (r.type === 'longestDrive') {
        if (!ld || m > ld.metres) ld = { metres: m, hole: r.hole_number, eventId: r.event_id };
      } else if (r.type === 'closestToPin') {
        if (!ctp || m < ctp.metres) ctp = { metres: m, hole: r.hole_number, eventId: r.event_id };
      }
    });
    const ids = [ld && ld.eventId, ctp && ctp.eventId].filter(Boolean);
    if (ids.length) {
      const er = await fetch(
        rest('live_events?select=id,name,course_name,config,created_at&id=in.(' + ids.join(',') + ')'),
        { headers: await authHeaders() },
      );
      if (er.ok) {
        const evs: any[] = await er.json();
        const byId: Record<string, any> = {};
        evs.forEach((e: any) => { byId[e.id] = e; });
        const label = (x: any) => {
          const e = byId[x.eventId];
          if (e) {
            x.event = e.name || e.course_name || 'R2TC Event';
            x.date = (((e.config && e.config.date) || e.created_at || '') + '').slice(0, 10);
          }
        };
        if (ld) label(ld);
        if (ctp) label(ctp);
      }
    }
    return { ld, ctp };
  } catch (e) {
    return { ld: null, ctp: null };
  }
}
