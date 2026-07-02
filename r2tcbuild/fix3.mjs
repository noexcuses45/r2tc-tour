import fs from 'fs';
const f='src/screens/SetupScreen.tsx';
let c=fs.readFileSync(f,'utf8');
const E=[
[`color: roundType === 'r2tc' ? '#FFFFFF' : '#15211B'`, `color: '#FFFFFF'`],
[`color: roundType === 'social' ? '#FFFFFF' : '#15211B'`, `color: '#FFFFFF'`],
];
for(const [o,n] of E){ if(c.split(o).length-1!==1){console.log('ABORT '+o);process.exit(1);} c=c.split(o).join(n); }
fs.writeFileSync(f,c);
console.log('white labels applied');
const H='JYQTc2txluMxGdnhZhgOH';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code; code[f].contents=c;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
