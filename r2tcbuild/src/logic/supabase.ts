// ---------- Supabase backend (plain REST — no extra packages needed) ----------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { leaderboard } from './scoring';
import { Round, TourLeaderboardRow, TourLeaderboards } from '../types';

export const SUPABASE_URL = 'https://unxfoxfzfvqjtakcfwhs.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_sOKxIpuC3JXo1vaf8p9GqQ_qmJHIfLq';

const SESSION_KEY = 'r2tc.supabaseSession';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  email: string;
}

const baseHeaders = {
  apikey: SUPABASE_KEY,
  'Content-Type': 'application/json',
};

async function readHeaders(): Promise<any> {
  try {
    const session = await getSession();
    if (session && (session as any).access_token) return { ...baseHeaders, Authorization: 'Bearer ' + (session as any).access_token };
  } catch (e) {}
  return baseHeaders;
}

const authUrl = (path: string) => `${SUPABASE_URL}/auth/v1/${path}`;
const restUrl = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;

async function saveSession(s: Session | null): Promise<void> {
  if (s === null) await AsyncStorage.removeItem(SESSION_KEY);
  else await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

async function refreshSession(s: Session): Promise<Session> {
  const res = await fetch(authUrl('token?grant_type=refresh_token'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (!res.ok) {
    await saveSession(null);
    throw new Error('Session expired — please sign in again.');
  }
  const json = await res.json();
  const next: Session = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    email: s.email,
  };
  await saveSession(next);
  return next;
}

/** Current session, auto-refreshed. Null when signed out. */
async function getSessionInner(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    let s = JSON.parse(raw) as Session;
    if (Date.now() / 1000 > s.expires_at - 60) s = await refreshSession(s);
    return s;
  } catch {
    return null;
  }
}

/** Step 1: email the player a 6-digit sign-in code. */
export async function requestLoginCode(email: string): Promise<void> {
  const res = await fetch(authUrl('otp'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ email: email.trim(), create_user: true }),
  });
  if (!res.ok) {
    throw new Error('Could not send the code — check the email address.');
  }
}

/** Step 2: verify the code from the email. */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<Session> {
  const res = await fetch(authUrl('verify'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      type: 'email',
      email: email.trim(),
      token: code.trim(),
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error('Wrong or expired code — try again.');
  }
  const s: Session = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    email: email.trim(),
  };
  await saveSession(s);
  return s;
}

export async function signOut(): Promise<void> {
  await saveSession(null);
}

// ---------- Tour leaderboards (live from the database) ----------

interface PointsRow {
  player_name: string;
  points: number;
  rounds_played: number;
}

interface ContestRow {
  type: string;
  player_name: string;
  metres: number;
  event_name: string | null;
}

/** Null when the database is unreachable or still empty (callers fall back). */
export async function fetchSupabaseLeaderboards(): Promise<TourLeaderboards | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const [pRes, cRes] = await Promise.all([
      fetch(restUrl('tour_points_leaderboard?select=*'), { headers: await readHeaders(), signal: ctrl.signal }),
      fetch(restUrl('contest_leaderboard?select=*'), { headers: await readHeaders(), signal: ctrl.signal }),
    ]);
    clearTimeout(timer);
    if (!pRes.ok || !cRes.ok) return null;
    const points = (await pRes.json()) as PointsRow[];
    const contests = (await cRes.json()) as ContestRow[];
    if (points.length === 0 && contests.length === 0) return null;

    const tourPoints: TourLeaderboardRow[] = points.map((r, i) => ({
      rank: i + 1,
      name: r.player_name,
      value: `${r.points.toLocaleString()} pts`,
      detail: `${r.rounds_played} round${r.rounds_played === 1 ? '' : 's'}`,
    }));
    const byType = (type: string, ascending: boolean): TourLeaderboardRow[] =>
      contests
        .filter((c) => c.type === type)
        .sort((a, b) => (ascending ? a.metres - b.metres : b.metres - a.metres))
        .slice(0, 10)
        .map((c, i) => ({
          rank: i + 1,
          name: c.player_name,
          value: `${c.metres} m`,
          detail: c.event_name ?? undefined,
        }));

    return {
      tourPoints,
      longestDrive: byType('longestDrive', false),
      closestToPin: byType('closestToPin', true),
      isSample: false,
    };
  } catch {
    return null;
  }
}

// ---------- Upload a finished round ----------

/** Tour points by finishing position; everyone past 10th gets last value. */
export const TOUR_POINTS_TABLE = [100, 80, 65, 55, 50, 45, 40, 35, 30, 25];

export async function pushRound(round: Round): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Sign in first to upload rounds.');
  const auth = {
    ...baseHeaders,
    Authorization: `Bearer ${session.access_token}`,
  };

  const standings = leaderboard(
    round.players,
    round.holes,
    round.primaryFormat === 'stableford' ? 'stableford' : 'stroke',
  );

  const roundRes = await fetch(restUrl('rounds'), {
    method: 'POST',
    headers: { ...auth, Prefer: 'return=representation' },
    body: JSON.stringify({
      name: round.name,
      course_name: round.courseName,
      played_at: round.date,
      format: round.primaryFormat,
      data: round,
      status: 'finished',
    }),
  });
  if (!roundRes.ok) throw new Error(`Upload failed (${roundRes.status}).`);
  const [saved] = await roundRes.json();

  const results = standings
    .filter((s) => s.thru > 0)
    .map((s, i) => ({
      round_id: saved.id,
      player_name: s.player.name,
      gross: s.gross,
      net: s.net,
      stableford: s.stableford,
      tour_points:
        TOUR_POINTS_TABLE[i] ?? TOUR_POINTS_TABLE[TOUR_POINTS_TABLE.length - 1],
    }));
  if (results.length > 0) {
    const r = await fetch(restUrl('round_results'), {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(results),
    });
    if (!r.ok) throw new Error(`Results upload failed (${r.status}).`);
  }

  const contests = (round.contestResults ?? []).map((c) => ({
    round_id: saved.id,
    event_name: round.name,
    type: c.type,
    hole_number: c.holeNumber,
    player_name: c.winner,
    metres: c.metres,
  }));
  if (contests.length > 0) {
    const r = await fetch(restUrl('contest_results'), {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(contests),
    });
    if (!r.ok) throw new Error(`Contest upload failed (${r.status}).`);
  }
}


// ---------- Email + password auth & player profiles ----------

export interface Profile {
  id: string;
  auth_user_id?: string;
  email: string;
  name?: string;
  first_name?: string;
  surname?: string;
  handicap: number;
  golf_id?: string;
  bio?: string;
  avatar_url?: string;
}

async function getUser(session: Session): Promise<any | null> {
  try {
    const res = await fetch(authUrl('user'), {
      headers: { ...baseHeaders, Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Insert or update the signed-in player's profile row. */
export async function upsertProfile(
  session: Session,
  p: { firstName: string; surname: string; handicap: number; golfId?: string },
): Promise<void> {
  const user = await getUser(session);
  if (!user || !user.id) return;
  await fetch(restUrl('players'), {
    method: 'POST',
    headers: {
      ...baseHeaders,
      Authorization: `Bearer ${session.access_token}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: user.id,
      auth_user_id: user.id,
      email: session.email,
      name: (p.firstName.trim() + ' ' + p.surname.trim()).trim(),
      handicap: p.handicap,
      ...((p.golfId || '').trim() ? { golf_id: (p.golfId || '').trim() } : {}),
    }),
  });
}

/** Register a new player with email + password and profile details. */
export async function signUp(
  email: string,
  password: string,
  firstName: string,
  surname: string,
  handicap: number,
  golfId: string,
): Promise<{ session: Session | null; needsConfirm: boolean }> {
  const res = await fetch(authUrl('signup'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      email: email.trim(),
      password,
      data: { first_name: firstName.trim(), surname: surname.trim(), handicap, golf_id: golfId.trim() },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      json.msg || json.error_description || json.error || 'Could not register.',
    );
  }
  if (json.access_token) {
    const s: Session = {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
      email: email.trim(),
    };
    await saveSession(s);
    await upsertProfile(s, { firstName, surname, handicap, golfId });
    return { session: s, needsConfirm: false };
  }
  return { session: null, needsConfirm: true };
}

/** Sign in an existing player with email + password. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<Session> {
  const res = await fetch(authUrl('token?grant_type=password'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.msg || 'Wrong email or password.',
    );
  }
  const s: Session = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    email: email.trim(),
  };
  await saveSession(s);
  try {
    const md = (json.user && json.user.user_metadata) || {};
    await upsertProfile(s, {
      firstName: md.first_name ?? '',
      surname: md.surname ?? '',
      handicap: typeof md.handicap === 'number' ? md.handicap : Number(md.handicap) || 0,
    });
  } catch {}
  return s;
}

/** The signed-in player's profile, or null when signed out / unavailable. */
export async function getProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await getUser(session);
  if (!user || !user.id) return null;
  try {
    const res = await fetch(restUrl(`players?id=eq.${user.id}&select=*`), {
      headers: { ...baseHeaders, Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (rows && rows[0]) { const r0 = rows[0]; const pp = (r0.name || '').trim().split(/\s+/); return { ...r0, first_name: pp[0] || '', surname: pp.slice(1).join(' ') } as Profile; }
  } catch {}
  // Fall back to auth metadata if the players row isn't there yet.
  const md = user.user_metadata || {};
  const fbName = ((md.first_name || '') + ' ' + (md.surname || '')).trim() || (session.email ? session.email.split('@')[0] : 'Member');
  try {
    await fetch(restUrl('players'), {
      method: 'POST',
      headers: { ...baseHeaders, Authorization: 'Bearer ' + session.access_token, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: user.id, auth_user_id: user.id, email: session.email, name: fbName, golf_id: (md.golf_id || '').trim(), handicap: typeof md.handicap === 'number' ? md.handicap : Number(md.handicap) || 0 }),
    });
  } catch {}
  return {
    id: user.id,
    email: session.email,
    first_name: md.first_name ?? '',
    surname: md.surname ?? '',
    handicap: typeof md.handicap === 'number' ? md.handicap : Number(md.handicap) || 0,
    golf_id: (md.golf_id || '').trim(),
  };
}


/** Find any player's public profile by their display name. */
export async function fetchPlayerByName(name: string): Promise<Profile | null> {
  try {
    const res = await fetch(restUrl('players?select=*'), { headers: await readHeaders() });
    if (!res.ok) return null;
    const rows = await res.json();
    const target = (name || '').trim().toLowerCase();
    return rows.find((r: any) => (r.name || '').trim().toLowerCase() === target) || null;
  } catch {
    return null;
  }
}

/** Save the signed-in player's bio / avatar to their shared profile. */
export async function saveProfileExtras(session: Session, extras: { bio?: string; avatar_url?: string; golf_id?: string; name?: string }): Promise<void> {
  const user = await getUser(session);
  if (!user || !user.id) return;
  await fetch(restUrl('players?id=eq.' + user.id), {
    method: 'PATCH',
    headers: { ...baseHeaders, Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify(extras),
  });
}


export interface RosterPlayer {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  golfId: string;
  handicap: number;
  avatar_url?: string;
}

/** All registered players (the tour roster). */
export async function fetchAllPlayers(): Promise<RosterPlayer[]> {
  try {
    const res = await fetch(restUrl('players?select=id,auth_user_id,name,email,golf_id,handicap,avatar_url&order=name.asc'), { headers: await readHeaders() });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows || []).map((r: any) => ({
      id: r.id,
      authUserId: r.auth_user_id,
      name: (r.name || '').trim(),
      email: (r.email || '').trim(),
      golfId: (r.golf_id || '').trim(),
      handicap: typeof r.handicap === 'number' ? r.handicap : Number(r.handicap) || 0,
      avatar_url: r.avatar_url,
    }));
  } catch {
    return [];
  }
}


/** Change the signed-in user's login email (sends a confirmation link). */
export async function updateEmail(session: Session, newEmail: string): Promise<void> {
  await fetch(authUrl('user'), {
    method: 'PUT',
    headers: { ...baseHeaders, Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ email: newEmail.trim() }),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(authUrl('recover'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ email: email.trim() }),
  });
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<Session> {
  const res = await fetch(authUrl('verify'), {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ type: 'recovery', email: email.trim(), token: code.trim() }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.msg || 'Invalid or expired code.');
  }
  const s: Session = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in || 3600),
    email: email.trim(),
  };
  await saveSession(s);
  await fetch(authUrl('user'), {
    method: 'PUT',
    headers: { ...baseHeaders, Authorization: 'Bearer ' + s.access_token },
    body: JSON.stringify({ password: newPassword }),
  });
  return s;
}

export async function updatePassword(session: Session, newPassword: string): Promise<void> {
  await fetch(authUrl('user'), {
    method: 'PUT',
    headers: { ...baseHeaders, Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ password: newPassword }),
  });
}


export async function deleteRemoteRound(round: Round): Promise<void> {
  try {
    const session = await getSession();
    if (!session) return;
    const auth = { ...baseHeaders, Authorization: 'Bearer ' + session.access_token };
    const q = restUrl('rounds?select=id&name=eq.' + encodeURIComponent(round.name || '') + '&played_at=eq.' + encodeURIComponent((round as any).date || ''));
    const res = await fetch(q, { headers: auth });
    if (!res.ok) return;
    const rows = await res.json();
    for (const row of (rows || [])) {
      const id = row.id;
      await fetch(restUrl('round_results?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('round_scores?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('contest_results?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('round_groups?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('rounds?id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
    }
  } catch (e) {}
}


export async function deleteMyAccount(): Promise<void> {
  const s = await getSession();
  const token = s ? (s as any).access_token : '';
  await fetch(restUrl('rpc/delete_my_account'), {
    method: 'POST',
    headers: { ...baseHeaders, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  await saveSession(null);
}


export async function reportContent(p: { contentType: string; contentId?: string; contentAuthor?: string; reason?: string }): Promise<void> {
  const sess = await getSession();
  const token = sess ? (sess as any).access_token : '';
  const email = sess ? (sess as any).email : '';
  await fetch(restUrl('content_reports'), {
    method: 'POST',
    headers: { ...baseHeaders, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reporter_email: email, content_type: p.contentType, content_id: p.contentId || null, content_author: p.contentAuthor || null, reason: p.reason || null }),
  });
}

export async function blockUser(p: { email?: string; name?: string }): Promise<void> {
  const sess = await getSession();
  const token = sess ? (sess as any).access_token : '';
  const email = sess ? (sess as any).email : '';
  await fetch(restUrl('user_blocks'), {
    method: 'POST',
    headers: { ...baseHeaders, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ blocker_email: email, blocked_email: p.email || null, blocked_name: p.name || null }),
  });
}

export async function fetchMyBlocks(): Promise<{ blocked_email: string | null; blocked_name: string | null }[]> {
  const sess = await getSession();
  const token = sess ? (sess as any).access_token : '';
  try {
    const r = await fetch(restUrl('user_blocks?select=blocked_email,blocked_name'), {
      headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) {
    return [];
  }
}


let _sessInFlight: Promise<Session | null> | null = null;
export function getSession(): Promise<Session | null> {
  if (!_sessInFlight) {
    _sessInFlight = getSessionInner()
      .catch(() => null)
      .finally(() => { _sessInFlight = null; });
  }
  return _sessInFlight;
}

/** Remove one of the signed-in player's blocks (messaging only). */
export async function unblockUser(p: { email?: string | null; name?: string | null }): Promise<void> {
  const sess = await getSession();
  const token = sess ? (sess as any).access_token : '';
  let q = 'user_blocks?';
  if (p.email) q += 'blocked_email=eq.' + encodeURIComponent(String(p.email));
  else if (p.name) q += 'blocked_name=eq.' + encodeURIComponent(String(p.name));
  else return;
  await fetch(restUrl(q), {
    method: 'DELETE',
    headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
  });
}
