// ---------- Core data types for R2TC Tour ----------

export interface Player {
  id: string;
  name: string;
  handicap: number; // WHS handicap index
}

export interface HoleInfo {
  par: number;
  strokeIndex: number; // 1 = hardest hole
}

export type HoleSelection = 'full18' | 'front9' | 'back9';

export type GameFormat =
  | 'stroke'
  | 'stableford'
  | 'matchplay'
  | 'skins'
  | 'bestball'
  | 'erado'
  | 'duplicate'
  | 'bb_stroke'
  | 'bb_stableford'
  | 'bb_match'
  | 'scramble_stroke'
  | 'scramble_match'
  | 'foursome_match'
  | 'greensome_match'
  | 'tbb_stroke'
  | 'tbb_stableford'
  | 'tscramble_stroke';

export interface RoundPlayer {
  id: string;
  name: string;
  handicap: number;
  /** Gross strokes per played hole; null = not entered yet */
  scores: (number | null)[];
}

// ---------- Contests (Longest Drive / Closest to the Pin) ----------

export type ContestType = 'longestDrive' | 'closestToPin';

export interface ContestHoles {
  longestDrive: number[]; // hole numbers
  closestToPin: number[]; // hole numbers
}

export interface ContestResult {
  type: ContestType;
  holeNumber: number;
  winner: string;
  /** Drive distance or distance to pin */
  metres: number | null;
}

export interface Round {
  id: string;
  name: string;
  courseName: string;
  date: string; // ISO
  holeSelection: HoleSelection;
  /** Info for the holes actually being played (9 or 18 entries) */
  holes: HoleInfo[];
  /** Hole numbers as displayed (e.g. 10..18 for back nine) */
  holeNumbers: number[];
  primaryFormat: GameFormat;
  formatSettings?: any;
  players: RoundPlayer[];
  /** Player ids per group (groups can be adjusted before the round) */
  groups?: string[][];
  /** Starting hole per group (shotgun start), aligned with `groups` */
  groupStartHoles?: number[];
  /** Tee time per group (free text), aligned with `groups` */
  groupTeeTimes?: (string | null)[];
  /** If set, this round feeds a shared live tournament. */
  liveEventId?: string;
  /** Which event group number this round scores (1-based). */
  liveGroupNo?: number;
  /** Email of the player who created this event (controls in-round Settings). */
  creatorEmail?: string;
  /**
   * 2-player team/match pairings (player ids), used by Match Play and
   * 2v2 Best Ball. Derived from groups at round start: 1 & 2 vs 3 & 4.
   */
  teams?: string[][];
  /** Optional: holes with contests on them */
  contests?: ContestHoles;
  /** Recorded contest winners */
  contestResults?: ContestResult[];
  status: 'active' | 'finished';
}

// ---------- Tour leaderboards (Google Sheet backed) ----------

export interface TourLeaderboardRow {
  rank: number;
  name: string;
  value: string; // points, metres, etc.
  detail?: string; // e.g. event name
}

export interface TourLeaderboards {
  tourPoints: TourLeaderboardRow[];
  longestDrive: TourLeaderboardRow[];
  closestToPin: TourLeaderboardRow[];
  /** true when showing built-in sample data instead of the live sheet */
  isSample: boolean;
}


export interface Fixture {
  round: string;
  date: string;
  venue: string;
  teeTime: string;
  cost?: string;
  format?: string;
}
