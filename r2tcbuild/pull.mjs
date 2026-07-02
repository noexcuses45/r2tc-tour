import fs from 'fs'; import path from 'path';
const H='lA1lMkBMC7NH200xk5mrm';
const skip=['package.json','app.json','tsconfig.json','babel.config.js','metro.config.js','README.md','.gitignore','index.js','index.ts','app.config.js','google-services.json','eas.json'];
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json();
let n=0;
for(const [p,v] of Object.entries(j.code)){
  if(skip.includes(p)) continue;
  if(v.type && v.type!=='CODE') continue;
  if(typeof v.contents!=='string') continue;
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p, v.contents);
  n++;
}
console.log('wrote',n,'files');
