import fs from 'fs';
{
  const F='src/screens/GpsScreen.tsx';
  let s=fs.readFileSync(F,'utf8');
  let ch=0;
  if(s.indexOf('fmbMetres')<0){
    const imp="} from '../logic/flyover';";
    if(s.indexOf(imp)<0) throw new Error('flyover import not found');
    s=s.replace(imp, "  fetchGreens,\n  pickGreenForHole,\n  fmbMetres,\n  GreenPoly,\n"+imp);
    ch++;
  }
  if(s.indexOf('const [greens, setGreens]')<0){
    const anchor="const [holes, setHoles] = useState<HoleGeo[]>([]);";
    if(s.indexOf(anchor)<0) throw new Error('holes state not found');
    const eff=anchor+"\n"+
"  const [greens, setGreens] = useState<GreenPoly[] | null>(null);\n"+
"  useEffect(() => {\n"+
"    if (greens || !holes || holes.length === 0) return;\n"+
"    let glat = 0, glon = 0, gn = 0;\n"+
"    for (const h of holes) { if (h.green) { glat += h.green.lat; glon += h.green.lon; gn++; } }\n"+
"    if (gn === 0) return;\n"+
"    const gcenter = { lat: glat / gn, lon: glon / gn };\n"+
"    let grad = 0;\n"+
"    for (const h of holes) { if (h.green) { const gd = distanceMetres(gcenter, h.green); if (gd > grad) grad = gd; } }\n"+
"    const gradius = Math.min(2500, Math.round(grad) + 400);\n"+
"    let galive = true;\n"+
"    fetchGreens(gcenter, gradius).then((gg) => { if (galive) setGreens(gg); }).catch(() => { if (galive) setGreens([]); });\n"+
"    return () => { galive = false; };\n"+
"  }, [holes, greens]);";
    s=s.replace(anchor, eff);
    ch++;
  }
  if(s.indexOf('const fmb =')<0){
    const anchor="const toGreenLive = pos ? distanceMetres(pos, hole.green) : null;";
    if(s.indexOf(anchor)<0) throw new Error('toGreenLive not found');
    const comp=anchor+"\n"+
"  const greenPoly = (greens && hole && hole.green) ? pickGreenForHole(hole.green, greens) : null;\n"+
"  const fmb = (greenPoly && pos) ? fmbMetres(pos, greenPoly) : null;";
    s=s.replace(anchor, comp);
    ch++;
  }
  if(s.indexOf('>FRONT<')<0){
    const t=s.indexOf('fmt(toGreenLive)');
    if(t<0) throw new Error('toGreenLive render not found');
    const rc=s.indexOf('</View>', t);
    if(rc<0) throw new Error('row close not found');
    const at=rc+'</View>'.length;
    const card="\n        {fmb ? (\n"+
"          <View pointerEvents=\"none\" style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>\n"+
"            <View style={{ alignItems: 'center', marginHorizontal: 9 }}>\n"+
"              <Text style={{ color: '#9CD67D', fontSize: 10, fontWeight: '800' }}>FRONT</Text>\n"+
"              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{fmt(fmb.front)}</Text>\n"+
"            </View>\n"+
"            <View style={{ alignItems: 'center', marginHorizontal: 9 }}>\n"+
"              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>MIDDLE</Text>\n"+
"              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{fmt(fmb.middle)}</Text>\n"+
"            </View>\n"+
"            <View style={{ alignItems: 'center', marginHorizontal: 9 }}>\n"+
"              <Text style={{ color: '#F0A6A6', fontSize: 10, fontWeight: '800' }}>BACK</Text>\n"+
"              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{fmt(fmb.back)}</Text>\n"+
"            </View>\n"+
"          </View>\n"+
"        ) : null}";
    s=s.slice(0,at)+card+s.slice(at);
    ch++;
  }
  if(ch===0) throw new Error('GpsScreen nothing changed');
  fs.writeFileSync(F,s);
  console.log('GpsScreen ch='+ch);
}
{
  const F='src/screens/HomeScreen.tsx';
  let s=fs.readFileSync(F,'utf8');
  let ch=0;
  const NEW='https://static.wixstatic.com/media/f56536_a054d2de22284c2586b610a7ef78b3bc~mv2.png/v1/fill/w_200,h_200,al_c,q_85,enc_auto/logo.png';
  const a=s.indexOf('const LOGO_URL =');
  if(a<0) throw new Error('no LOGO_URL');
  const semi=s.indexOf("';", a);
  if(semi<0) throw new Error('no end quote');
  if(s.slice(a,semi).indexOf(NEW)<0){ s=s.slice(0,a)+"const LOGO_URL = '"+NEW+"'"+s.slice(semi+1); ch++; }
  const oldA="notifAuthor: { color: colors.text, fontWeight: '700', fontSize: 14 }";
  if(s.indexOf(oldA)>-1){ s=s.replace(oldA, "notifAuthor: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 }"); ch++; }
  if(ch===0) throw new Error('HomeScreen nothing changed');
  fs.writeFileSync(F,s);
  console.log('HomeScreen ch='+ch);
}
