import fs from 'fs';
{
  const F='src/logic/supabase.ts';
  let s=fs.readFileSync(F,'utf8');
  if(s.indexOf('deleteRemoteRound')<0){
    const fn=`

export async function deleteRemoteRound(round: Round): Promise<void> {
  try {
    const session = await getSession();
    if (!session) return;
    const auth = { ...baseHeaders, Authorization: 'Bearer ' + session.access_token };
    const q = restUrl('rounds?select=id&name=eq.' + encodeURIComponent(round.name || '') + '&played_at=eq.' + encodeURIComponent((round as any).date || ''));
    const res = await fetch(q, { headers: auth });
    if (!res.ok) return;
    const rows = await res.json();
    for (const row of (rows || [])) {
      const id = row.id;
      await fetch(restUrl('round_results?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('round_scores?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('contest_results?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('round_groups?round_id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
      await fetch(restUrl('rounds?id=eq.' + id), { method: 'DELETE', headers: auth }).catch(function(){});
    }
  } catch (e) {}
}
`;
    fs.writeFileSync(F, s+fn);
    console.log('supabase: added deleteRemoteRound');
  } else { console.log('supabase: already present'); }
}
{
  const F='App.tsx';
  let s=fs.readFileSync(F,'utf8');
  let ch=0;
  const imp=`import { getSession, getProfile, pushRound } from './src/logic/supabase';`;
  if(s.indexOf('deleteRemoteRound')<0){
    if(s.indexOf(imp)<0) throw new Error('import anchor not found');
    s=s.replace(imp, `import { getSession, getProfile, pushRound, deleteRemoteRound } from './src/logic/supabase';`);
    ch++;
  }
  if(s.indexOf('x.id !== r.id')<0){
    const old=`setRounds((prev: any) => prev.filter((x: any) => x.liveEventId !== r.liveEventId))`;
    if(s.indexOf(old)<0) throw new Error('onDeleteRound anchor not found');
    const neu=`setRounds((prev: any) => { const _n = (prev || []).filter((x: any) => x.id !== r.id); saveRounds(_n); return _n; }); try { await deleteRemoteRound(r); } catch (e8) {}`;
    s=s.replace(old, neu);
    ch++;
  }
  if(ch===0) throw new Error('App.tsx nothing changed');
  fs.writeFileSync(F, s);
  console.log('App.tsx changed='+ch);
}
