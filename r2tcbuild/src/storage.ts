import AsyncStorage from '@react-native-async-storage/async-storage';
import { Player, Round } from './types';

const KEYS = {
  players: 'r2tc.players',
  rounds: 'r2tc.rounds',
  activeRound: 'r2tc.activeRound',
};

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function saveJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const loadPlayers = () => loadJson<Player[]>(KEYS.players, []);
export const savePlayers = (players: Player[]) => saveJson(KEYS.players, players);

export const loadRounds = () => loadJson<Round[]>(KEYS.rounds, []);
export const saveRounds = (rounds: Round[]) => saveJson(KEYS.rounds, rounds);

export const loadActiveRound = () => loadJson<Round | null>(KEYS.activeRound, null);
export const saveActiveRound = (round: Round | null) =>
  round === null
    ? AsyncStorage.removeItem(KEYS.activeRound)
    : saveJson(KEYS.activeRound, round);

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
