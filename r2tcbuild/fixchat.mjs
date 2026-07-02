import fs from 'fs';
const f='App.tsx';
let c=fs.readFileSync(f,'utf8');
const E=[
[`import React, { useEffect, useState } from 'react';`, `import React, { useEffect, useRef, useState } from 'react';`],
[`, deleteLiveEvent } from './src/logic/liveEvents';`, `, deleteLiveEvent, fetchMessages } from './src/logic/liveEvents';`],
[`const [pastScope, setPastScope] = useState<'all' | 'r2tc'>('all');`, `const [pastScope, setPastScope] = useState<'all' | 'r2tc'>('all');\n  const [chatUnread, setChatUnread] = useState(false);\n  const chatSeenRef = useRef<number>(0);\n  useEffect(() => {\n    const evId: any = activeRound && (activeRound as any).liveEventId;\n    if (!evId) { setChatUnread(false); return; }\n    let alive = true;\n    const check = async () => {\n      try {\n        const msgs: any = await fetchMessages(evId);\n        if (!alive || !msgs || !msgs.length) return;\n        const latest = Math.max.apply(null, msgs.map((m: any) => new Date(m.created_at).getTime() || 0));\n        if (roundTab === 'chat') { chatSeenRef.current = latest; setChatUnread(false); }\n        else if (chatSeenRef.current === 0) { chatSeenRef.current = latest; }\n        else if (latest > chatSeenRef.current) { setChatUnread(true); }\n      } catch (e) {}\n    };\n    check();\n    const id = setInterval(check, 8000);\n    return () => { alive = false; clearInterval(id); };\n  }, [activeRound, roundTab]);`],
[`onPress={() => setRoundTab('chat')}`, `onPress={() => setRoundTab('chat')}\n              badge={chatUnread}`],
[`function TabButton({\n  label,\n  active,\n  onPress,\n}: {\n  label: string;\n  active: boolean;\n  onPress: () => void;\n}) {`, `function TabButton({\n  label,\n  active,\n  onPress,\n  badge,\n}: {\n  label: string;\n  active: boolean;\n  onPress: () => void;\n  badge?: boolean;\n}) {`],
[`{active ? <View style={styles.tabDot} /> : null}`, `{active ? <View style={styles.tabDot} /> : null}\n      {badge ? <View style={styles.tabBadge} /> : null}`],
[`tabDot: {`, `tabBadge: { position: 'absolute', top: 2, right: '30%', width: 9, height: 9, borderRadius: 5, backgroundColor: '#E5484D' },\n  tabDot: {`],
];
let fail=[];
for(let i=0;i<E.length;i++){ const o=E[i][0]; const n=c.split(o).length-1; if(n!==1) fail.push(i+' count='+n+' :: '+o.slice(0,40)); }
if(fail.length){ console.log('ABORT:\n'+fail.join('\n')); process.exit(1); }
for(const [o,nw] of E){ c=c.split(o).join(nw); }
fs.writeFileSync(f,c);
console.log('chat unread badge applied');
const H='NRfCeYxVnbkVTrt2QY3zS';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code;
code['App.tsx'].contents=c;
code['src/screens/ChatScreen.tsx'].contents=fs.readFileSync('src/screens/ChatScreen.tsx','utf8');
code['src/screens/MessagesScreen.tsx'].contents=fs.readFileSync('src/screens/MessagesScreen.tsx','utf8');
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
