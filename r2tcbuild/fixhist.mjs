import fs from 'fs';
const f='src/screens/TourHistoryScreen.tsx';
let c=fs.readFileSync(f,'utf8');
const anchor=`const SECTION_TITLES: { [k: string]: string } = {`;
const add=anchor+`\n  'A GRADE CHAMPIONS': 'A Grade Champions',\n  'B GRADE CHAMPIONS': 'B Grade Champions',\n  'C GRADE CHAMPIONS': 'C Grade Champions',\n  'LONGEST DRIVE CHAMPIONS': 'Longest Drive Champions',\n  'CLOSEST TO THE PIN CHAMPIONS': 'Closest to the Pin Champions',`;
if(c.split(anchor).length-1!==1){console.log('ABORT anchor count='+(c.split(anchor).length-1));process.exit(1);}
c=c.split(anchor).join(add); fs.writeFileSync(f,c);
console.log('added 5 award-category section titles');
const H='GOul2JmpuckAOrNmdh0L7';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code; code[f].contents=c;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
