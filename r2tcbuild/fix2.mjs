import fs from 'fs';
const files = { setup:'src/screens/SetupScreen.tsx', app:'App.tsx', home:'src/screens/HomeScreen.tsx', live:'src/logic/liveEvents.ts' };
const C = {}; for (const k in files) C[k] = fs.readFileSync(files[k],'utf8');
const E = [
['setup', `export default function SetupScreen({ onCancel, onStart, liveEventId, initialRound }: Props) {`, `export default function SetupScreen({ onCancel, onStart, liveEventId, initialRound }: Props) {\n  const [roundType, setRoundType] = useState<'r2tc' | 'social' | ''>('');`],
['setup', `const start = () => {`, `const start = () => {\n    if (!roundType) { Alert.alert('Choose a round type', 'Tap R2TC Competition or Non Tour Competition at the top first.'); return; }`],
['setup', `status: 'active',`, `status: 'active',\n        roundType,`],
['setup', `<ScrollView contentContainerStyle={styles.scroll}>`, `<ScrollView contentContainerStyle={styles.scroll}>\n          <View style={{ flexDirection: 'row', marginBottom: 14 }}>\n            <TouchableOpacity onPress={() => setRoundType('r2tc')} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center', marginRight: 6, borderColor: roundType === 'r2tc' ? '#2BA84A' : '#CBD5D0', backgroundColor: roundType === 'r2tc' ? '#2BA84A' : 'transparent' }}>\n              <Text style={{ fontWeight: '800', color: roundType === 'r2tc' ? '#FFFFFF' : '#15211B' }}>R2TC Competition</Text>\n            </TouchableOpacity>\n            <TouchableOpacity onPress={() => setRoundType('social')} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center', marginLeft: 6, borderColor: roundType === 'social' ? '#2BA84A' : '#CBD5D0', backgroundColor: roundType === 'social' ? '#2BA84A' : 'transparent' }}>\n              <Text style={{ fontWeight: '800', color: roundType === 'social' ? '#FFFFFF' : '#15211B' }}>Non Tour Competition</Text>\n            </TouchableOpacity>\n          </View>`],
['app', `created_by_email: s && (s as any).email ? (s as any).email : null,`, `created_by_email: s && (s as any).email ? (s as any).email : null,\n          roundType: r.roundType || 'r2tc',`],
['app', `const [rounds, setRounds] = useState<Round[]>([]);`, `const [rounds, setRounds] = useState<Round[]>([]);\n  const [spectateIsSocial, setSpectateIsSocial] = useState(false);\n  const [pastScope, setPastScope] = useState<'all' | 'r2tc'>('all');`],
['app', `setSpectateRound(buildFullRoundFromEvent(ev)); setScreen('spectate');`, `setSpectateRound(buildFullRoundFromEvent(ev)); setSpectateIsSocial(!!((ev as any) && (ev as any).config && (ev as any).config.roundType === 'social')); setScreen('spectate');`],
['app', `{spectateTab === 'chat' ? (`, `{!spectateIsSocial && spectateTab === 'chat' ? (`],
['app', `) : spectateTab === 'settings' && spectateCanEdit ? (`, `) : !spectateIsSocial && spectateTab === 'settings' && spectateCanEdit ? (`],
['app', `<TabButton label="Chat" active={spectateTab === 'chat'} onPress={() => setSpectateTab('chat')} />`, `{!spectateIsSocial && <TabButton label="Chat" active={spectateTab === 'chat'} onPress={() => setSpectateTab('chat')} />}`],
['app', `{spectateCanEdit ? (`, `{!spectateIsSocial && spectateCanEdit ? (`],
['app', `rounds={rounds}`, `rounds={pastScope === 'r2tc' ? rounds.filter((r: any) => ((r.roundType || 'r2tc') !== 'social')) : rounds}`],
['app', `onOpenPastRounds={() => setScreen('pastrounds')}`, `onOpenPastRounds={(scope?: any) => { setPastScope(scope === 'r2tc' ? 'r2tc' : 'all'); setScreen('pastrounds'); }}`],
['home', `<TouchableOpacity style={styles.linkBtn} onPress={onOpenPastRounds}>`, `<TouchableOpacity style={styles.linkBtn} onPress={() => onOpenPastRounds('r2tc')}>`],
['live', `for (const ev of mine) { out.push(await buildFinishedRoundFromEvent(ev)); }`, `for (const ev of mine) { const fr = await buildFinishedRoundFromEvent(ev); (fr as any).roundType = (((ev as any).config && (ev as any).config.roundType) || 'r2tc'); out.push(fr); }`],
];
let fail=[];
for (let i=0;i<E.length;i++){ const [k,o]=E[i]; const n=C[k].split(o).length-1; if(n!==1) fail.push(i+'|'+k+'|count='+n+'|'+o.slice(0,46)); }
if(fail.length){ console.log('ABORT:\n'+fail.join('\n')); process.exit(1); }
for (const [k,o,nw] of E){ C[k]=C[k].split(o).join(nw); }
for (const k in files){ fs.writeFileSync(files[k], C[k]); }
console.log('APPLIED all '+E.length+' edits');
const H='qMnxOEOHfgUrLVNShrJC7';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code;
code['src/screens/SetupScreen.tsx'].contents=C.setup;
code['App.tsx'].contents=C.app;
code['src/screens/HomeScreen.tsx'].contents=C.home;
code['src/logic/liveEvents.ts'].contents=C.live;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
