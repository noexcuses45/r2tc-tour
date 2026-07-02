import fs from 'fs';
const lf='src/logic/liveEvents.ts';
let c=fs.readFileSync(lf,'utf8');
const block = `export async function deleteLiveEvent(eventId: string): Promise<void> {\n  try {\n    await fetch(rest('live_scores?event_id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n    await fetch(rest('live_messages?event_id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n    await fetch(rest('live_contests?event_id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n    await fetch(rest('live_events?id=eq.' + eventId), { method: 'DELETE', headers: await authHeaders() });\n  } catch (e) {}\n}\n\n`;
const bn=c.split(block).length-1;
if(bn!==1){ console.log('ABORT live block count='+bn); process.exit(1); }
c=c.split(block).join(''); fs.writeFileSync(lf,c);
console.log('live deleteLiveEvent count now', c.split('function deleteLiveEvent').length-1);
let a=fs.readFileSync('App.tsx','utf8');
const impMine=`import { markGroupFinished, fetchMyFinishedRounds, buildFinishedRoundFromEvent, deleteLiveEvent } from './src/logic/liveEvents';`;
const impsWith=(a.match(/import \{[^}]*\} from '\.\/src\/logic\/liveEvents';/g)||[]).filter(l=>l.includes('deleteLiveEvent'));
console.log('app liveEvents-imports-with-deleteLiveEvent=', impsWith.length);
if(impsWith.length>1){ a=a.replace(impMine, `import { markGroupFinished, fetchMyFinishedRounds, buildFinishedRoundFromEvent } from './src/logic/liveEvents';`); fs.writeFileSync('App.tsx',a); console.log('removed duplicate App import'); }
const H='BqvcA9il_I-Pqs0PLXtv3';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code;
code['src/logic/liveEvents.ts'].contents=fs.readFileSync(lf,'utf8');
code['App.tsx'].contents=fs.readFileSync('App.tsx','utf8');
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
