import { HoleInfo, RoundPlayer } from '../types';

export function ambroseTeamHcp(handicaps: number[], method?: string): number {
  const N = handicaps.length || 1;
  const sum = handicaps.reduce((a, b) => a + b, 0);
  if (method === 'official') {
    const sorted = handicaps.slice().sort((a, b) => a - b);
    const pcts = N === 2 ? [0.35, 0.15] : N === 3 ? [0.3, 0.2, 0.1] : N === 4 ? [0.25, 0.2, 0.15, 0.1] : null;
    if (pcts) { let t = 0; for (let i = 0; i < N; i++) t += pcts[i] * sorted[i]; return Math.round(t); }
  }
  return Math.round(sum / (2 * N));
}

/**
 * Playing handicap for the round.
 * Full 18 -> rounded handicap index; 9 holes -> half, rounded.
 */
export function playingHandicap(handicapIndex: number, holeCount: number): number {
  const h = holeCount <= 9 ? handicapIndex / 2 : handicapIndex;
  return Math.round(h);
}

/**
 * Strokes received on a hole, allocated by stroke index over the holes
 * actually being played. Supports handicaps above the hole count
 * (second allocation) and negative (plus) handicaps.
 */
export function strokesReceived(
  playingHcp: number,
  hole: HoleInfo,
  holes: HoleInfo[],
): number {
  const n = holes.length;
  // Rank this hole's stroke index among the holes being played (1..n)
  const rank = holes.filter((h) => h.strokeIndex < hole.strokeIndex).length + 1;
  if (playingHcp >= 0) {
    const base = Math.floor(playingHcp / n);
    const extra = playingHcp % n;
    return base + (rank <= extra ? 1 : 0);
  }
  // Plus handicap: give strokes back starting at the easiest hole
  const give = -playingHcp;
  const easeRank = n - rank + 1; // 1 = easiest
  const base = Math.floor(give / n);
  const extra = give % n;
  return -(base + (easeRank <= extra ? 1 : 0));
}

export interface HoleResult {
  gross: number | null;
  strokes: number; // strokes received
  net: number | null;
  stableford: number | null;
}

export function holeResults(player: RoundPlayer, holes: HoleInfo[]): HoleResult[] {
  const phcp = playingHandicap(player.handicap, holes.length);
  return holes.map((hole, i) => {
    const gross = player.scores[i] ?? null;
    const strokes = strokesReceived(phcp, hole, holes);
    if (gross === null) {
      return { gross: null, strokes, net: null, stableford: null };
    }
    const net = gross - strokes;
    const stableford = Math.max(0, 2 + hole.par - net);
    return { gross, strokes, net, stableford };
  });
}

export interface PlayerStanding {
  player: RoundPlayer;
  playingHcp: number;
  thru: number; // holes completed
  gross: number;
  net: number;
  /** Net score relative to par over holes played */
  netToPar: number;
  grossToPar: number;
  stableford: number;
}

export function playerStanding(player: RoundPlayer, holes: HoleInfo[]): PlayerStanding {
  const results = holeResults(player, holes);
  let thru = 0;
  let gross = 0;
  let net = 0;
  let parPlayed = 0;
  let stableford = 0;
  results.forEach((r, i) => {
    if (r.gross !== null && r.net !== null && r.stableford !== null) {
      thru += 1;
      gross += r.gross;
      net += r.net;
      stableford += r.stableford;
      parPlayed += holes[i].par;
    }
  });
  return {
    player,
    playingHcp: playingHandicap(player.handicap, holes.length),
    thru,
    gross,
    net,
    netToPar: net - parPlayed,
    grossToPar: gross - parPlayed,
    stableford,
  };
}

/** Sorted standings. Stroke play: best net to par first. Stableford: most points first. */
export function leaderboard(
  players: RoundPlayer[],
  holes: HoleInfo[],
  format: 'stroke' | 'stableford',
): PlayerStanding[] {
  const standings = players.map((p) => playerStanding(p, holes));
  standings.sort((a, b) => {
    // Players yet to start go last
    if (a.thru === 0 && b.thru === 0) return 0;
    if (a.thru === 0) return 1;
    if (b.thru === 0) return -1;
    if (format === 'stableford') {
      if (b.stableford !== a.stableford) return b.stableford - a.stableford;
      return b.thru - a.thru;
    }
    if (a.netToPar !== b.netToPar) return a.netToPar - b.netToPar;
    return b.thru - a.thru;
  });
  return standings;
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

/** Label for a gross score on a hole, e.g. Birdie / Bogey */
export function scoreLabel(gross: number, par: number): string {
  const diff = gross - par;
  if (gross === 1) return 'Hole in one';
  switch (diff) {
    case -3: return 'Albatross';
    case -2: return 'Eagle';
    case -1: return 'Birdie';
    case 0: return 'Par';
    case 1: return 'Bogey';
    case 2: return 'Double Bogey';
    default:
      return diff < 0 ? '' : `+${diff}`;
  }
}

export function totalPar(holes: HoleInfo[]): number {
  return holes.reduce((s, h) => s + h.par, 0);
}
