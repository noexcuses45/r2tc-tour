import fs from 'fs';
const F='src/screens/HomeScreen.tsx';
let s=fs.readFileSync(F,'utf8');
let changed=0;
if(s.indexOf('Golf Link {(profile')<0){
  const a=s.indexOf('<Text style={styles.profileHcp}>GA Handicap');
  if(a<0) throw new Error('profileHcp anchor not found');
  const close=s.indexOf('</Text>',a)+7;
  const ls=s.lastIndexOf('\n',a)+1;
  const indent=(s.slice(ls).match(/^[ \t]*/)||[''])[0];
  const ins='\n'+indent+"<Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>Golf Link {(profile && (profile as any).golf_id) ? (profile as any).golf_id : '—'}</Text>";
  s=s.slice(0,close)+ins+s.slice(close);
  changed++;
}
if(s.indexOf('Refresh data')<0){
  const sb=s.indexOf('styles.signOutBtn');
  if(sb<0) throw new Error('signOutBtn not found');
  const to=s.lastIndexOf('<TouchableOpacity',sb);
  if(to<0) throw new Error('signout TouchableOpacity not found');
  const ls=s.lastIndexOf('\n',to)+1;
  const indent=(s.slice(ls).match(/^[ \t]*/)||[''])[0];
  const btn=
  indent+"<TouchableOpacity\n"+
  indent+"  style={{ backgroundColor: '#1E2B25', borderWidth: 1, borderColor: '#33433B', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 12 }}\n"+
  indent+"  onPress={async () => {\n"+
  indent+"    const gid = (profile && (profile as any).golf_id) || '';\n"+
  indent+"    if (gid) { setMyGaHcp(null); fetchHandicapForGolfId(gid).then(setMyGaHcp).catch(function(){}); }\n"+
  indent+"    try { await onRefresh(); } catch (e) {}\n"+
  indent+"  }}\n"+
  indent+">\n"+
  indent+"  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{refreshing ? 'Refreshing…' : 'Refresh data'}</Text>\n"+
  indent+"</TouchableOpacity>\n";
  s=s.slice(0,ls)+btn+s.slice(ls);
  changed++;
}
if(changed===0) throw new Error('nothing changed');
fs.writeFileSync(F,s);
console.log('UI PATCH OK changed='+changed);
