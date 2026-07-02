import fs from 'fs';
const lf='src/logic/liveEvents.ts';
let c=fs.readFileSync(lf,'utf8');
const m='export async function deleteLiveEvent(eventId: string): Promise<void> {';
const first=c.indexOf(m), second=c.indexOf(m, first+1);
if(second!==-1){ c=c.slice(0,first)+c.slice(second); fs.writeFileSync(lf,c); console.log('LIVE removed dup -> now', c.split(m).length-1); } else { console.log('LIVE no dup, count', c.split(m).length-1); }
const app=fs.readFileSync('App.tsx','utf8');
console.log('APP onDeleteRound def=', app.split('const onDeleteRound').length-1, ' importDup=', app.split('buildFinishedRoundFromEvent, deleteLiveEvent').length-1, ' jsxOnDelete=', app.split('onDelete={onDeleteRound}').length-1);
const prs=fs.readFileSync('src/screens/PastRoundsScreen.tsx','utf8');
console.log('PRS trashBlocks=', prs.split('isAdmin && onDelete ?').length-1, ' sigDup=', prs.split('isAdmin?: boolean').length-1);
