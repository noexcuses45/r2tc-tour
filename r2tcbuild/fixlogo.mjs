import fs from 'fs';
const F='src/screens/HomeScreen.tsx';
let s=fs.readFileSync(F,'utf8');
let ch=0;
const lw=s.indexOf('logoWrap: {');
if(lw<0) throw new Error('no logoWrap');
const br=s.indexOf('borderRadius: 12', lw);
if(br<0) throw new Error('no borderRadius in logoWrap');
if(s.slice(lw, br+40).indexOf('borderColor')<0){
  s=s.slice(0,br)+"borderRadius: 25,\n    borderWidth: 2.5,\n    borderColor: '#2E7D57'"+s.slice(br+'borderRadius: 12'.length);
  ch++;
}
if(s.indexOf('logo: { width: 44, height: 44 }')>-1){
  s=s.replace('logo: { width: 44, height: 44 }','logo: { width: 32, height: 32 }');
  ch++;
}
if(ch===0) throw new Error('nothing changed');
fs.writeFileSync(F,s);
console.log('LOGO CIRCLE PATCH ch='+ch);
