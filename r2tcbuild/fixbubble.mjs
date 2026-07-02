import fs from 'fs';
const f='src/screens/MessagesScreen.tsx';
let c=fs.readFileSync(f,'utf8');
const o="bubble: { maxWidth: '80%', ";
const n="bubble: { ";
if(c.split(o).length-1!==1){console.log('ABORT count='+(c.split(o).length-1));process.exit(1);}
c=c.split(o).join(n); fs.writeFileSync(f,c);
console.log('removed nested maxWidth from message bubble');
const H='NRfCeYxVnbkVTrt2QY3zS';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code;
code['src/screens/MessagesScreen.tsx'].contents=c;
code['src/screens/ChatScreen.tsx'].contents=fs.readFileSync('src/screens/ChatScreen.tsx','utf8');
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
