import fs from 'fs';
const HS='src/screens/HomeScreen.tsx';
let c=fs.readFileSync(HS,'utf8');
const aAnchor="const isVideo = a.type === 'video';";
if(c.split(aAnchor).length-1!==1){console.log('ABORT A count='+(c.split(aAnchor).length-1));process.exit(1);}
c=c.replace(aAnchor, aAnchor+"\n      if (isVideo && a.fileSize && a.fileSize > 49 * 1024 * 1024) { Alert.alert('Video too large', 'Videos must be under 50 MB to post on the tour feed. Try a shorter clip or record at a lower resolution.'); return; }");
const re=/Alert\.alert\('Upload failed',[^;]*\);/;
if(!re.test(c)){console.log('ABORT B no match');process.exit(1);}
c=c.replace(re, "Alert.alert('Upload failed', media && media.type === 'video' ? 'Could not upload the video - it must be under 50 MB. Try a shorter clip.' : 'Could not upload the media - check the storage setup.');");
fs.writeFileSync(HS,c);
console.log('edited HomeScreen ok');
const H='lA1lMkBMC7NH200xk5mrm';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json();
const code=j.code; code[HS].contents=c;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json();
console.log('snack saved '+(sj.id||sj.hashId||JSON.stringify(sj)));
