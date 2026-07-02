// Offline score queue: online-first; on network failure scores queue here
// and auto-sync every 15s until delivered. Pure JS - no native deps (OTA-safe).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'r2tc.scoreQueue.v1';

export type QueuedScore = {
  k: string;
  op: 'set' | 'clear';
  event_id: string;
  player_name: string;
  handicap: number;
  group_no: number;
  hole_number: number;
  strokes: number | null;
  ts: number;
};

let sender: ((item: QueuedScore) => Promise<boolean>) | null = null;
let timer: any = null;
let flushing = false;

async function readQ(): Promise<QueuedScore[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch (e) { return []; }
}
async function writeQ(q: QueuedScore[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(q.slice(-1000))); } catch (e) {}
}

function schedule(): void {
  if (!timer) timer = setInterval(function () { flushScoreQueue(); }, 15000);
}
function stopTimer(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export function initScoreQueue(sendFn: (item: QueuedScore) => Promise<boolean>): void {
  sender = sendFn;
  setTimeout(function () { flushScoreQueue(); }, 4000);
}

export async function enqueueScore(item: QueuedScore): Promise<void> {
  const q = (await readQ()).filter(function (x) { return x.k !== item.k; });
  q.push(item);
  await writeQ(q);
  schedule();
}

export async function pendingScoreCount(): Promise<number> {
  return (await readQ()).length;
}

export async function flushScoreQueue(): Promise<void> {
  if (flushing || !sender) return;
  flushing = true;
  try {
    let q = await readQ();
    while (q.length) {
      let ok = false;
      try { ok = await sender(q[0]); } catch (e) { ok = false; }
      if (!ok) { schedule(); break; }
      q = q.slice(1);
      await writeQ(q);
    }
    if (!q.length) stopTimer();
  } finally { flushing = false; }
}
