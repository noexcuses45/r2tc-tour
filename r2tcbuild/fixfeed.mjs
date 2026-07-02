import fs from 'fs';
const f='src/screens/HomeScreen.tsx';
let c=fs.readFileSync(f,'utf8');
const E=[
[`import React, { useCallback, useEffect, useState } from 'react';`, `import React, { useCallback, useEffect, useRef, useState } from 'react';`],
[`} from 'react-native';`, `  findNodeHandle,\n} from 'react-native';`],
[`const [postText, setPostText] = useState('');`, `const [postText, setPostText] = useState('');\n  const feedScrollRef = useRef<any>(null);\n  const composerInputRef = useRef<any>(null);`],
[`contentContainerStyle={styles.scroll}\n        refreshControl={`, `ref={feedScrollRef}\n        keyboardShouldPersistTaps="handled"\n        contentContainerStyle={styles.scroll}\n        refreshControl={`],
[`placeholder="Share something with the tour…"`, `ref={composerInputRef}\n                  onFocus={() => { const inp: any = composerInputRef.current; const sv: any = feedScrollRef.current; if (!inp || !sv) return; const node = findNodeHandle(inp); const resp = sv.getScrollResponder ? sv.getScrollResponder() : null; if (node != null && resp && resp.scrollResponderScrollNativeHandleToKeyboard) { resp.scrollResponderScrollNativeHandleToKeyboard(node, 110, true); } }}\n                  placeholder="Share something with the tour…"`],
];
let fail=[];
for(let i=0;i<E.length;i++){ const o=E[i][0]; const n=c.split(o).length-1; if(n!==1) fail.push(i+' count='+n+' :: '+o.slice(0,38)); }
if(fail.length){ console.log('ABORT:\n'+fail.join('\n')); process.exit(1); }
for(const [o,nw] of E){ c=c.split(o).join(nw); }
fs.writeFileSync(f,c);
console.log('feed composer scroll-on-focus applied');
const H='EHdAuTZmbbiBv6RCz3R5l';
const r=await fetch('https://exp.host/--/api/v2/snack/'+H,{headers:{'Snack-Api-Version':'3.0.0'}});
const j=await r.json(); const code=j.code; code[f].contents=c;
const sr=await fetch('https://exp.host/--/api/v2/snack/save',{method:'POST',headers:{'Content-Type':'application/json','Snack-Api-Version':'3.0.0'},body:JSON.stringify({manifest:j.manifest,code,dependencies:j.dependencies})});
const sj=await sr.json(); console.log('SNACK '+(sj.id||sj.hashId||JSON.stringify(sj)));
