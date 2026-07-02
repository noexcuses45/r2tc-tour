import fs from 'fs';
const f='src/screens/ChatScreen.tsx';
let c=fs.readFileSync(f,'utf8');
const o='behavior="padding"';
const n="behavior={Platform.OS === 'ios' ? 'padding' : 'height'}";
if(c.split(o).length-1!==1){console.log('ABORT count='+(c.split(o).length-1));process.exit(1);}
c=c.split(o).join(n); fs.writeFileSync(f,c);
console.log('chat keyboard behavior -> platform-aware');
const H='NRfCeYxVnbkVTrt2QY3zS';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code; code[f].contents=c;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
