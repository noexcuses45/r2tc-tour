import fs from 'fs';
const F='src/screens/HomeScreen.tsx';
let s=fs.readFileSync(F,'utf8');
let ch=0;
const NEW='https://static.wixstatic.com/media/f56536_a054d2de22284c2586b610a7ef78b3bc~mv2.png';
const a=s.indexOf('const LOGO_URL =');
if(a<0) throw new Error('no LOGO_URL');
const semi=s.indexOf("';", a);
if(semi<0) throw new Error('no end quote');
if(s.slice(a,semi).indexOf(NEW)<0){ s=s.slice(0,a)+"const LOGO_URL = '"+NEW+"'"+s.slice(semi+1); ch++; }
const b="borderRadius: 25,\n    borderWidth: 2.5,\n    borderColor: '#2E7D57',";
if(s.indexOf(b)>-1){ s=s.replace(b,"borderRadius: 25,"); ch++; }
if(s.indexOf('logo: { width: 32, height: 32 }')>-1){ s=s.replace('logo: { width: 32, height: 32 }','logo: { width: 50, height: 50 }'); ch++; }
if(ch===0) throw new Error('nothing changed');
fs.writeFileSync(F,s);
console.log('LOGO SWAP ch='+ch);
