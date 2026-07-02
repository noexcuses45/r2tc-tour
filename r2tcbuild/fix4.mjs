import fs from 'fs';
const files = { app:'App.tsx', live:'src/logic/liveEvents.ts', prs:'src/screens/PastRoundsScreen.tsx' };
const C = {}; for (const k in files) C[k] = fs.readFileSync(files[k],'utf8');
const E = [
['live', `export async function deleteThread(threadKey: string): Promise<void> {`, `export async function deleteLiveEvent(eventId: string): Promise<void> {\n  try {\n    await fetch(rest('live_scores?event_id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n    await fetch(rest('live_messages?event_id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n    await fetch(rest('live_contests?event_id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n    await fetch(rest('live_events?id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n  } catch (e) {}\n}\n\nexport async function deleteThread(threadKey: string): Promise<void> {`],
['app', `import { markGroupFinished, fetchMyFinishedRounds, buildFinishedRoundFromEvent } from './src/logic/liveEvents';`, `import { markGroupFinished, fetchMyFinishedRounds, buildFinishedRoundFromEvent, deleteLiveEvent } from './src/logic/liveEvents';`],
['app', `const [pastScope, setPastScope] = useState<'all' | 'r2tc'>('all');`, `const [pastScope, setPastScope] = useState<'all' | 'r2tc'>('all');\n  const onDeleteRound = (r: any) => { Alert.alert('Delete event', 'Permanently delete "' + (r.name || 'this event') + '" and its scores? This cannot be undone.', [ { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { if (r.liveEventId) await deleteLiveEvent(r.liveEventId); setRounds((prev: any) => prev.filter((x: any) => x.liveEventId !== r.liveEventId)); } catch (e) {} } } ]); };`],
['app', `rounds={pastScope === 'r2tc' ? rounds.filter((r: any) => ((r.roundType || 'r2tc') !== 'social')) : rounds}`, `rounds={pastScope === 'r2tc' ? rounds.filter((r: any) => ((r.roundType || 'r2tc') !== 'social')) : rounds}\n          isAdmin={!!meEmail && ADMIN_EMAILS.map((e: string) => e.toLowerCase()).includes(meEmail.toLowerCase())}\n          onDelete={onDeleteRound}`],
['prs', `export default function PastRoundsScreen({ rounds, onView, onBack }: { rounds: Round[]; onView: (r: Round) => void; onBack: () => void }) {`, `export default function PastRoundsScreen({ rounds, onView, onBack, isAdmin, onDelete }: { rounds: Round[]; onView: (r: Round) => void; onBack: () => void; isAdmin?: boolean; onDelete?: (r: Round) => void }) {`],
['prs', `<Text style={styles.chev}>`, `{isAdmin && onDelete ? (<TouchableOpacity onPress={() => onDelete(r)} hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }} style={{ paddingHorizontal: 6 }}><Text style={{ fontSize: 20 }}>🗑️</Text></TouchableOpacity>) : null}\n              <Text style={styles.chev}>`],
];
let fail=[];
for (let i=0;i<E.length;i++){ const [k,o]=E[i]; const n=C[k].split(o).length-1; if(n!==1) fail.push(i+'|'+k+'|count='+n+'|'+o.slice(0,46)); }
if(fail.length){ console.log('ABORT:\n'+fail.join('\n')); process.exit(1); }
for (const [k,o,nw] of E){ C[k]=C[k].split(o).join(nw); }
for (const k in files){ fs.writeFileSync(files[k], C[k]); }
console.log('APPLIED '+E.length+' edits');
const H='pVh98Go-OJSc2VNOwDT6j';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code;
code['App.tsx'].contents=C.app;
code['src/logic/liveEvents.ts'].contents=C.live;
code['src/screens/PastRoundsScreen.tsx'].contents=C.prs;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
