import fs from 'fs';
const SNACK='1d0ckIrJD7zdkz52qD2y9';
const F='src/logic/liveEvents.ts';
let s=fs.readFileSync(F,'utf8');
const fnIdx=s.indexOf('export async function deleteLiveEvent');
if(fnIdx<0) throw new Error('no deleteLiveEvent');
const marker="live_events?id=eq.";
const mIdx=s.indexOf(marker,fnIdx);
if(mIdx<0) throw new Error('no live_events delete');
if(s.slice(fnIdx,mIdx).indexOf('live_scores?event_id=eq.')>-1) throw new Error('already patched');
const lineStart=s.lastIndexOf('\n',mIdx)+1;
const indent=(s.slice(lineStart).match(/^[ \t]*/)||[''])[0];
const ins=indent+"const _ch = await authHeaders();\n"+indent+"await fetch(rest('live_scores?event_id=eq.' + id), { method: 'DELETE', headers: _ch }).catch(function(){});\n"+indent+"await fetch(rest('live_messages?event_id=eq.' + id), { method: 'DELETE', headers: _ch }).catch(function(){});\n"+indent+"await fetch(rest('live_contests?event_id=eq.' + id), { method: 'DELETE', headers: _ch }).catch(function(){});\n";
s=s.slice(0,lineStart)+ins+s.slice(lineStart);
fs.writeFileSync(F,s);
console.log('LOCAL PATCH OK indent='+indent.length);
try{
const H={'Snack-Api-Version':'3.0.0','Content-Type':'application/json'};
const g=await fetch('https://exp.host/--/api/v2/snack/'+SNACK,{headers:H});
const gj=await g.json();
const m=gj.manifest||gj;
const code=gj.code||m.code;
code['src/logic/liveEvents.ts'].contents=s;
const payload={code,dependencies:m.dependencies,sdkVersion:m.sdkVersion,name:m.name||'r2tc',description:m.description||''};
const p=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:H,body:JSON.stringify(payload)});
const pj=await p.json();
console.log('SNACK '+(pj.id||pj.hashId||JSON.stringify(pj).slice(0,140)));
}catch(e){console.log('SNACK PUSH SKIPPED: '+e.message);}
