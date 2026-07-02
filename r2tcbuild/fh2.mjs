const id='1Z7WRiRNnWrUB_NggjMKqj_6sZwAoimCJo_yulnzLCYo';
const url='https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq?tqx=out:json&headers=0&sheet=History';
const r=await fetch(url,{headers:{Accept:'text/plain, */*'}});
const t=await r.text();
const json=JSON.parse(t.replace(/^[^(]*\(/,'').replace(/\);?\s*$/,''));
const rows=json.table.rows.map(row=>(row.c||[]).map(c=>c&&c.v!=null?String(c.v):''));
console.log('TOTAL', rows.length);
rows.forEach((rw,i)=>{ const s=rw.join(' | '); if(/grade|longest|closest|champion/i.test(s)) console.log(i+': '+JSON.stringify(rw)); });
