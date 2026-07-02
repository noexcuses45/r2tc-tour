const id='1Z7WRiRNnWrUB_NggjMKqj_6sZwAoimCJo_yulnzLCYo';
const url='https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq?tqx=out:json&headers=0&sheet=History';
const r=await fetch(url,{headers:{Accept:'text/plain, */*'}});
const t=await r.text();
const json=JSON.parse(t.replace(/^[^(]*\(/,'').replace(/\);?\s*$/,''));
const rows=json.table.rows.map(row=>(row.c||[]).map(c=>c&&c.v!=null?String(c.v):''));
console.log('--- rows the NEW header rule catches (should be section titles only) ---');
rows.forEach((rw,i)=>{ const a=(rw[0]||'').trim(); if(/CHAMPIONS$/i.test(a)) console.log(i+': '+JSON.stringify(a)); });
