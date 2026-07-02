// ---------- Game format logic: Match Play, Skins, 2v2 Best Ball ----------

import { playingHandicap, strokesReceived } from './scoring';
import { GameFormat, HoleInfo, Round, RoundPlayer } from '../types';

export const FORMAT_OPTIONS: [GameFormat, string][] = [
  ['stroke', 'Stroke NET'],
  ['stableford', 'Stableford'],
  ['matchplay', 'Match Play'],
  ['skins', 'Skins'],
  ['erado', 'Erado'],
  ['duplicate', 'Duplicate'],
  ['bb_stroke', 'Better Ball — Stroke'],
  ['bb_stableford', 'Better Ball — Stableford'],
  ['bb_match', 'Better Ball — Match Play'],
  ['scramble_stroke', '2-Man Scramble — Stroke'],
  ['scramble_match', 'Scramble — Match Play'],
  ['foursome_match', 'Foursome — Match Play'],
  ['greensome_match', 'Greensome — Match Play'],
  ['tbb_stroke', 'Best Ball — Stroke (Team)'],
  ['tbb_stableford', 'Best Ball — Stableford (Team)'],
  ['tscramble_stroke', 'Scramble — Stroke (Team)'],
];

export const FORMAT_LABELS: Record<GameFormat, string> = {
  stroke: 'Stroke Play NET',
  stableford: 'Stableford',
  matchplay: 'Match Play',
  skins: 'Skins',
  erado: 'Erado',
  duplicate: 'Duplicate',
  bestball: '2v2 Best Ball',
  bb_stroke: 'Better Ball — Stroke',
  bb_stableford: 'Better Ball — Stableford',
  bb_match: 'Better Ball — Match Play',
  scramble_stroke: '2-Man Scramble — Stroke',
  scramble_match: 'Scramble — Match Play',
  foursome_match: 'Foursome — Match Play',
  greensome_match: 'Greensome — Match Play',
  tbb_stroke: 'Best Ball — Stroke (Team)',
  tbb_stableford: 'Best Ball — Stableford (Team)',
  tscramble_stroke: 'Scramble — Stroke (Team)',
};

export const FORMAT_HINTS: Record<GameFormat, string> = {
  stroke: 'Net + Stableford leaderboards are both tracked — this picks the main one.',
  stableford: 'Net + Stableford leaderboards are both tracked — this picks the main one.',
  matchplay:
    'Matches are made inside each group: player 1 vs 2, player 3 vs 4. ' +
    'The higher handicap gets the difference in strokes.',
  skins:
    'Everyone competes. Lowest net score wins the hole — ties carry the ' +
    'skin to the next hole.',
  erado:
    'Stroke play where your worst holes are auto-erased to net par (default 4 per round). The final hole and net-par-or-better holes are protected. Lowest net wins.',
  duplicate:
    'Net Stableford with a random 1x / 2x / 3x multiplier on each hole, shared by everyone. The final hole always counts double. Most points wins.',
  bestball:
    'Each group of 4 splits into two teams: players 1 & 2 vs 3 & 4. ' +
    'Best net score of the team counts (85% handicap allowance).',
  bb_stroke:
    'Pairs play their own balls; the better net score of the two counts as the team score on each hole. Lowest team total wins.',
  bb_stableford:
    'Pairs play their own balls; the higher Stableford points of the two count as the team score on each hole. Most points wins.',
  bb_match:
    'Two teams of two play match play; the better net score of each team is compared on every hole and the lower wins the hole.',
  scramble_stroke:
    'Both partners tee off, the better shot is taken and both play on from there until holed — one team score per hole. Team handicap is the combined handicaps divided by 4 (Australian Ambrose; 35/15 optional). Lowest net wins.',
  scramble_match:
    'Scramble played as match play between two teams. One team score per hole off the combined handicaps divided by 4 (Australian Ambrose; 35/15 optional); lower net wins the hole.',
  foursome_match:
    'Alternate shot: partners play one ball, taking turns. Match play between two teams off 50% of the combined handicap.',
  greensome_match:
    'Both partners tee off, pick the better ball, then alternate shots to hole out. Match play off 60% of the lower plus 40% of the higher handicap.',
};

/** WHS-style handicap allowance for a format. */
export function formatAllowance(format: GameFormat): number {
  return format === 'bestball' ? 0.85 : 1;
}

/** Playing handicap with the format's allowance applied. */
export function effectivePlayingHcp(
  format: GameFormat,
  handicapIndex: number,
  holeCount: number,
): number {
  const base = holeCount <= 9 ? handicapIndex / 2 : handicapIndex;
  return Math.round(base * formatAllowance(format));
}

/** Net score per hole (null where no gross entered) for a given playing hcp. */
function netScores(
  player: RoundPlayer,
  holes: HoleInfo[],
  phcp: number,
): (number | null)[] {
  return holes.map((h, i) => {
    const gross = player.scores[i];
    if (gross === null || gross === undefined) return null;
    return gross - strokesReceived(phcp, h, holes);
  });
}

// ---------- Match Play ----------

export type HoleMark = 'a' | 'b' | 'half' | null;

export interface MatchState {
  a: RoundPlayer;
  b: RoundPlayer;
  /** Strokes the higher-handicap player receives (difference method) */
  strokesGiven: number;
  /** One mark per hole: who won it (null = not played / after match decided) */
  marks: HoleMark[];
  /** Holes up for player A (negative = B up) */
  diff: number;
  thru: number;
  finished: boolean;
  /** e.g. "Luke 3&2" · "All square thru 6" · "Luke 2 UP thru 9" */
  summary: string;
}

/**
 * Matches derived from groups: consecutive pairs inside each group
 * (1 vs 2, 3 vs 4). Falls back to pairing the player list in order.
 */
export function matchesForRound(round: Round): [RoundPlayer, RoundPlayer][] {
  const byId = new Map(round.players.map((p) => [p.id, p]));
  const pairs: [RoundPlayer, RoundPlayer][] = [];
  for (const g of round.groups ?? []) {
    for (let i = 0; i + 1 < g.length; i += 2) {
      const a = byId.get(g[i]);
      const b = byId.get(g[i + 1]);
      if (a && b) pairs.push([a, b]);
    }
  }
  if (pairs.length === 0) {
    for (let i = 0; i + 1 < round.players.length; i += 2) {
      pairs.push([round.players[i], round.players[i + 1]]);
    }
  }
  return pairs;
}

export function matchState(
  a: RoundPlayer,
  b: RoundPlayer,
  holes: HoleInfo[],
): MatchState {
  // 100% of the difference: lower handicap plays off scratch.
  const phA = playingHandicap(a.handicap, holes.length);
  const phB = playingHandicap(b.handicap, holes.length);
  const low = Math.min(phA, phB);
  const netA = netScores(a, holes, phA - low);
  const netB = netScores(b, holes, phB - low);

  const marks: HoleMark[] = [];
  let diff = 0;
  let thru = 0;
  let decided = false;
  let decidedAt = 0; // hole index (1-based) where the match was decided

  for (let i = 0; i < holes.length; i++) {
    const na = netA[i];
    const nb = netB[i];
    if (decided || na === null || nb === null) {
      marks.push(null);
      continue;
    }
    thru += 1;
    if (na < nb) {
      diff += 1;
      marks.push('a');
    } else if (nb < na) {
      diff -= 1;
      marks.push('b');
    } else {
      marks.push('half');
    }
    const remaining = holes.length - (i + 1);
    if (Math.abs(diff) > remaining) {
      decided = true;
      decidedAt = i + 1;
    }
  }

  const first = (p: RoundPlayer) => p.name.split(' ')[0];
  let summary: string;
  let finished = false;
  if (decided) {
    finished = true;
    const winner = diff > 0 ? a : b;
    const rem = holes.length - decidedAt;
    summary =
      rem > 0
        ? `${first(winner)} wins ${Math.abs(diff)}&${rem}`
        : `${first(winner)} wins ${Math.abs(diff)} UP`;
  } else if (thru === holes.length) {
    finished = true;
    summary =
      diff === 0
        ? 'Match halved'
        : `${first(diff > 0 ? a : b)} wins ${Math.abs(diff)} UP`;
  } else if (thru === 0) {
    summary = 'Not started';
  } else if (diff === 0) {
    summary = `All square thru ${thru}`;
  } else {
    summary = `${first(diff > 0 ? a : b)} ${Math.abs(diff)} UP thru ${thru}`;
  }

  return {
    a,
    b,
    strokesGiven: Math.abs(phA - phB),
    marks,
    diff,
    thru,
    finished,
    summary,
  };
}

// ---------- Skins ----------

export interface SkinsRow {
  player: RoundPlayer;
  skins: number;
  /** Display hole numbers won, e.g. [3, 7] */
  holesWon: number[];
}

export interface SkinsState {
  rows: SkinsRow[]; // sorted, most skins first
  /** Skins riding on the next undecided hole (1 = no carry) */
  pot: number;
  /** Display number of the next undecided hole, null when all settled */
  nextHole: number | null;
  /** Skins left unclaimed at the end of the round (final-hole tie) */
  unclaimed: number;
}

/**
 * Net skins across all players. A hole is settled only once every player
 * has a score for it; ties carry the pot to the next hole.
 */
export function skinsState(round: Round): SkinsState {
  const holes = round.holes;
  const players = round.players;
  const phcp = new Map(
    players.map((p) => [p.id, playingHandicap(p.handicap, holes.length)]),
  );
  const nets = players.map((p) => netScores(p, holes, phcp.get(p.id) ?? 0));

  const won = new Map<string, number[]>(); // playerId -> hole indexes won
  const wonSkins = new Map<string, number>(); // playerId -> total skins
  let pot = 0;
  let nextHole: number | null = null;
  let unclaimed = 0;

  for (let i = 0; i < holes.length; i++) {
    pot += 1;
    const holeNets = nets.map((n) => n[i]);
    if (holeNets.some((n) => n === null)) {
      nextHole = round.holeNumbers[i];
      break;
    }
    const values = holeNets as number[];
    const best = Math.min(...values);
    const winners = players.filter((_, pi) => values[pi] === best);
    if (winners.length === 1) {
      const id = winners[0].id;
      won.set(id, [...(won.get(id) ?? []), i]);
      wonSkins.set(id, (wonSkins.get(id) ?? 0) + pot);
      pot = 0;
    }
    if (i === holes.length - 1) {
      unclaimed = pot;
      pot = 0;
    }
  }

  const rows: SkinsRow[] = players.map((p) => ({
    player: p,
    skins: wonSkins.get(p.id) ?? 0,
    holesWon: (won.get(p.id) ?? []).map((i) => round.holeNumbers[i]),
  }));
  rows.sort(
    (x, y) => y.skins - x.skins || x.player.name.localeCompare(y.player.name),
  );

  return { rows, pot: nextHole !== null ? pot : 0, nextHole, unclaimed };
}

// ---------- 2v2 Best Ball ----------

export interface TeamStanding {
  ids: string[];
  name: string;
  players: RoundPlayer[];
  thru: number;
  net: number;
  netToPar: number;
  stableford: number;
  /** Best net per hole (null = no team member has a score yet) */
  holeNets: (number | null)[];
}

/** Teams derived from groups: players 1 & 2 vs 3 & 4 in each group of 4. */
export function teamsForRound(round: Round): string[][] {
  if (round.teams && round.teams.length > 0) return round.teams;
  const teams: string[][] = [];
  for (const g of round.groups ?? []) {
    for (let i = 0; i + 1 < g.length; i += 2) {
      teams.push([g[i], g[i + 1]]);
    }
  }
  return teams;
}

export function bestBallStandings(round: Round): TeamStanding[] {
  const holes = round.holes;
  const byId = new Map(round.players.map((p) => [p.id, p]));
  const out: TeamStanding[] = [];

  for (const ids of teamsForRound(round)) {
    const members = ids
      .map((id) => byId.get(id))
      .filter((p): p is RoundPlayer => !!p);
    if (members.length === 0) continue;
    const memberNets = members.map((p) =>
      netScores(p, holes, effectivePlayingHcp('bestball', p.handicap, holes.length)),
    );
    const holeNets: (number | null)[] = holes.map((_, i) => {
      const avail = memberNets
        .map((n) => n[i])
        .filter((n): n is number => n !== null);
      return avail.length > 0 ? Math.min(...avail) : null;
    });
    let thru = 0;
    let net = 0;
    let parPlayed = 0;
    let stableford = 0;
    holeNets.forEach((n, i) => {
      if (n === null) return;
      thru += 1;
      net += n;
      parPlayed += holes[i].par;
      stableford += Math.max(0, 2 + holes[i].par - n);
    });
    out.push({
      ids,
      name: members.map((p) => p.name.split(' ')[0]).join(' & '),
      players: members,
      thru,
      net,
      netToPar: net - parPlayed,
      stableford,
      holeNets,
    });
  }

  out.sort((x, y) => {
    if (x.thru === 0 && y.thru === 0) return 0;
    if (x.thru === 0) return 1;
    if (y.thru === 0) return -1;
    if (x.netToPar !== y.netToPar) return x.netToPar - y.netToPar;
    return y.thru - x.thru;
  });
  return out;
}
