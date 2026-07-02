import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchLiveScores, buildStandings, LiveStanding, fetchContestResults } from '../logic/liveEvents';
import { ambroseTeamHcp } from '../logic/scoring';
import { colors, radius } from '../theme';
import { Round } from '../types';
import PlayerProfileModal from './PlayerProfileModal';

type Mode = 'stableford' | 'stroke' | 'contests' | 'skins' | 'matchplay' | 'erado' | 'duplicate';

const SCORE_BG: any = {
  eagle: { backgroundColor: '#F1C232' },
  birdie: { backgroundColor: '#E06666' },
  bogey: { backgroundColor: '#9FC5E8' },
  dbl: { backgroundColor: '#2E6DA4' },
};
const SCORE_TX: any = {
  eagle: { color: '#5b4a00' },
  birdie: { color: '#fff' },
  bogey: { color: '#0b2540' },
  dbl: { color: '#fff' },
};
function scoreKey(g: number | null, par: number | null): string | null {
  if (g == null || par == null) return null;
  const d = g - par;
  if (d <= -2) return 'eagle';
  if (d === -1) return 'birdie';
  if (d === 0) return null;
  if (d === 1) return 'bogey';
  return 'dbl';
}

function ScoreGrid({ nos, siByNo, parByNo, gross, pts, netByNo, mode, totalLabel }: any) {
  const sum = (f: any) => nos.reduce((t: number, n: number) => t + (f(n) || 0), 0);
  return (
    <View style={styles.block}>
      <View style={styles.gRow}>
        <Text style={styles.gHead}>Hole</Text>
        {nos.map((n: number) => (
          <Text key={'h' + n} style={styles.gCell}>{n}</Text>
        ))}
        <Text style={[styles.gCell, styles.gTotHead]}>{totalLabel}</Text>
      </View>
      <View style={styles.gRow}>
        <Text style={styles.gHead}>HCP</Text>
        {nos.map((n: number) => (
          <Text key={'i' + n} style={styles.gCell}>{siByNo[n]}</Text>
        ))}
        <Text style={[styles.gCell, styles.gTot]} />
      </View>
      <View style={styles.gRow}>
        <Text style={styles.gHead}>Par</Text>
        {nos.map((n: number) => (
          <Text key={'p' + n} style={styles.gCell}>{parByNo[n]}</Text>
        ))}
        <Text style={[styles.gCell, styles.gTot]}>{sum((n: number) => parByNo[n])}</Text>
      </View>
      <View style={styles.gRow}>
        <Text style={styles.gHead}>Score</Text>
        {nos.map((n: number) => {
          const g = gross[n] != null ? gross[n] : null;
          const k = scoreKey(g, parByNo[n]);
          return (
            <View key={'s' + n} style={[styles.gScoreWrap, k ? SCORE_BG[k] : null]}>
              <Text style={[styles.gScoreTxt, k ? SCORE_TX[k] : null]}>{g != null ? g : '–'}</Text>
            </View>
          );
        })}
        <Text style={[styles.gCell, styles.gTot]}>{sum((n: number) => gross[n]) || '–'}</Text>
      </View>
      {mode === 'stroke' ? (
        <View style={styles.gRow}>
          <Text style={styles.gHead}>Net</Text>
          {nos.map((n: number) => (
            <Text key={'nt' + n} style={styles.gCell}>{netByNo && netByNo[n] != null ? netByNo[n] : '–'}</Text>
          ))}
          <Text style={[styles.gCell, styles.gTot]}>{sum((n: number) => (netByNo ? netByNo[n] : 0)) || '–'}</Text>
        </View>
      ) : null}
      {mode === 'stableford' ? (
        <View style={styles.gRow}>
          <Text style={styles.gHead}>Pts</Text>
          {nos.map((n: number) => (
            <Text key={'pt' + n} style={[styles.gCell, styles.gPts]}>{pts[n] != null ? pts[n] : '–'}</Text>
          ))}
          <Text style={[styles.gCell, styles.gTot]}>{sum((n: number) => pts[n])}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ContestsView({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const timer = useRef<any>(null);
  useEffect(() => {
    let active = true;
    const pull = async () => {
      const data = await fetchContestResults(eventId);
      if (active) setRows(data);
    };
    pull();
    timer.current = setInterval(pull, 8000);
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [eventId]);

  const types: [string, string, string][] = [
    ['longestDrive', 'Longest Drive', '🏌️'],
    ['closestToPin', 'Closest to the Pin', '🎯'],
  ];
  const sections = types.map(([type, label, icon]) => {
    const byHole: any = {};
    rows.filter((r) => r.type === type).forEach((r) => {
      (byHole[r.hole_number] = byHole[r.hole_number] || []).push(r);
    });
    const holes = Object.keys(byHole).map(Number).sort((a, b) => a - b);
    holes.forEach((h) => {
      byHole[h].sort((a: any, b: any) => {
        const am = a.metres == null ? Infinity : a.metres;
        const bm = b.metres == null ? Infinity : b.metres;
        return type === 'longestDrive' ? bm - am : am - bm;
      });
    });
    return { type, label, icon, holes, byHole };
  });
  const anyData = sections.some((s) => s.holes.length > 0);
  if (!anyData) {
    return <Text style={styles.msg}>No contest results yet — they appear here as players record longest drive / closest to the pin.</Text>;
  }
  return (
    <View>
      {sections.map((sec) =>
        sec.holes.length === 0 ? null : (
          <View key={sec.type} style={styles.cSection}>
            <Text style={styles.cHeader}>{sec.icon} {sec.label}</Text>
            {sec.holes.map((h) => (
              <View key={sec.type + h} style={styles.cHoleBlock}>
                <Text style={styles.cHoleLabel}>Hole {h}</Text>
                {sec.byHole[h].map((e: any, i: number) => (
                  <View key={e.player_name + i} style={[styles.cRow, i === 0 ? styles.cRowWin : null]}>
                    <Text style={[styles.cRank, i === 0 ? styles.cWinTxt : null]}>{i + 1}.</Text>
                    <Text style={[styles.cName, i === 0 ? styles.cWinTxt : null]}>{e.player_name}</Text>
                    <Text style={[styles.cMetres, i === 0 ? styles.cWinTxt : null]}>{e.metres != null ? e.metres + ' m' : '—'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}

const FMT_TAB: any = { skins: 'Skins', matchplay: 'Match Play', erado: 'Erado', duplicate: 'Duplicate', bb_stroke: 'Better Ball', bb_stableford: 'Better Ball', bb_match: 'Better Ball', scramble_stroke: 'Scramble', scramble_match: 'Scramble', foursome_match: 'Foursome', greensome_match: 'Greensome', tbb_stroke: 'Best Ball', tbb_stableford: 'Best Ball', tscramble_stroke: 'Scramble' };
function dmult(hn: number, lastNo: number) { if (hn === lastNo) return 2; return (((hn * 2654435761) >>> 0) % 3) + 1; }
function computeTeams(standings, teams, order, parByNo, siByNo, fmt, opts) {
  opts = opts || {};
  var byName = {}; standings.forEach(function (s) { byName[s.name] = s; });
  var rows = []; var lastNo = order[order.length - 1];
  var oneBall = ['scramble_stroke', 'scramble_match', 'foursome_match', 'greensome_match', 'tscramble_stroke'].indexOf(fmt) >= 0;
  function teamStrokes(thcp, hn) {
    var n = order.length; var si = siByNo[hn] || 0; var rank = 0;
    order.forEach(function (h) { if ((siByNo[h] || 0) < si) rank++; }); rank += 1;
    if (thcp >= 0) { var base = Math.floor(thcp / n); var extra = thcp % n; return base + (rank <= extra ? 1 : 0); }
    var gg = -thcp; var b2 = Math.floor(gg / n); var e2 = gg % n; var er = n - rank + 1; return -(b2 + (er <= e2 ? 1 : 0));
  }
  function memberNet(m, hn, pct) { if (!m || !m.holes || m.holes[hn] === undefined) return undefined; return m.holes[hn] - teamStrokes(Math.round(pct * (m.handicap || 0)), hn); }
  function teamHcpFor(members) {
    var hs = members.map(function (m) { return m ? (m.handicap || 0) : 0; });
    var sum = hs.reduce(function (a, b) { return a + b; }, 0); var low = Math.min.apply(null, hs), high = Math.max.apply(null, hs);
    if (fmt === 'scramble_stroke' || fmt === 'scramble_match' || fmt === 'tscramble_stroke') return ambroseTeamHcp(hs, opts.scrambleMethod);
    if (fmt === 'foursome_match') return Math.round(0.5 * sum);
    if (fmt === 'greensome_match') return Math.round(0.6 * low + 0.4 * high);
    return null;
  }
  (teams || []).forEach(function (team) {
    var members = team.map(function (nm) { return byName[nm]; }).filter(Boolean); if (!members.length) return;
    var grp = members[0].groupNo; var teamName = team.join(' & ');
    var thru = 0, toPar = 0, netStrokes = 0, pts = 0; var tnets = {};
    if (oneBall) {
      var thcp = teamHcpFor(members);
      order.forEach(function (hn) { var par = parByNo[hn] || 0; var gr = members.map(function (m) { return m.holes ? m.holes[hn] : undefined; }).filter(function (v) { return v !== undefined; }); if (!gr.length) return; var g = Math.min.apply(null, gr); var net = g - teamStrokes(thcp, hn); tnets[hn] = net; thru++; netStrokes += net; toPar += net - par; });
      rows.push({ name: teamName, teamHcp: thcp, groupNo: grp, thru: thru, toPar: toPar, netToPar: toPar, net: netStrokes, points: 0, _tnets: tnets, nets: {}, pts: {}, holes: {}, _pair: true });
    } else {
      var allow = (fmt === 'bb_match') ? 0.9 : 0.85;
      var bestN = (fmt === 'tbb_stroke' || fmt === 'tbb_stableford') ? (opts.bestN || 2) : 1;
      var strokeType = (fmt === 'bb_stroke' || fmt === 'tbb_stroke' || fmt === 'bb_match');
      order.forEach(function (hn) {
        var par = parByNo[hn] || 0;
        var nets = members.map(function (m) { return memberNet(m, hn, allow); }).filter(function (v) { return v !== undefined; });
        if (!nets.length) return; thru++;
        if (strokeType) { nets.sort(function (a, b) { return a - b; }); var take = nets.slice(0, bestN); var sum2 = take.reduce(function (a, b) { return a + b; }, 0); netStrokes += sum2; toPar += sum2 - (par * Math.min(bestN, nets.length)); tnets[hn] = take[0]; }
        else { var stbs = nets.map(function (nv) { return Math.max(0, 2 + par - nv); }); stbs.sort(function (a, b) { return b - a; }); pts += stbs.slice(0, bestN).reduce(function (a, b) { return a + b; }, 0); }
      });
      rows.push({ name: teamName, teamHcp: null, groupNo: grp, thru: thru, toPar: toPar, netToPar: toPar, net: netStrokes, points: pts, _tnets: tnets, nets: {}, pts: {}, holes: {}, _pair: true });
    }
  });
  if (['bb_match', 'scramble_match', 'foursome_match', 'greensome_match'].indexOf(fmt) >= 0) {
    var byG = {}; rows.forEach(function (r) { r.won = 0; (byG[r.groupNo] = byG[r.groupNo] || []).push(r); });
    Object.keys(byG).forEach(function (gk) { var ts = byG[gk]; if (ts.length < 2) return; var t1 = ts[0], t2 = ts[1]; order.forEach(function (hn) { var n1 = t1._tnets[hn], n2 = t2._tnets[hn]; if (n1 === undefined || n2 === undefined) return; if (n1 < n2) t1.won += 1; else if (n2 < n1) t2.won += 1; }); });
  }
  var stablefordType = (fmt === 'bb_stableford' || fmt === 'tbb_stableford');
  var matchType = ['bb_match', 'scramble_match', 'foursome_match', 'greensome_match'].indexOf(fmt) >= 0;
  rows.forEach(function (r) { r.disp = matchType ? (r.won || 0) : stablefordType ? r.points : r.net; });
  if (matchType || stablefordType) rows.sort(function (a, b) { return (b.disp - a.disp) || b.thru - a.thru; });
  else rows.sort(function (a, b) { return a.toPar - b.toPar || b.thru - a.thru; });
  return rows;
}

function computeFormat(standings, order, parByNo, fmt, opts) {
  opts = opts || {};
  var useH = opts.useHandicaps !== false;
  var lastNo = order[order.length - 1];
  var hv = function (s, hn) { var m = useH ? s.nets : s.holes; return m ? m[hn] : undefined; };
  var stbl = function (s, hn) { if (useH) return s.pts ? s.pts[hn] : undefined; var g = s.holes ? s.holes[hn] : undefined; if (g === undefined) return undefined; return Math.max(0, 2 + (parByNo[hn] || 0) - g); };
  var score = {}, toPar = {}, net = {};
  standings.forEach(function (s) { score[s.name] = 0; toPar[s.name] = useH ? s.netToPar : s.toPar; net[s.name] = useH ? s.net : s.strokes; });
  var meta = { pot: 0, nextHole: null, value: opts.skinValue || 1 };
  if (fmt === 'erado') {
    var N = opts.eradoCount || 4;
    standings.forEach(function (s) {
      var overs = [];
      order.forEach(function (hn) { var v = hv(s, hn); if (v !== undefined) overs.push({ hn: hn, over: v - (parByNo[hn] || 0) }); });
      var erasable = overs.filter(function (x) { return x.over > 0 && x.hn !== lastNo; }).sort(function (a, b) { return b.over - a.over; }).slice(0, N);
      var erased = {}; erasable.forEach(function (x) { erased[x.hn] = 1; });
      var tp = 0, saved = 0;
      overs.forEach(function (x) { if (erased[x.hn]) saved += x.over; else tp += x.over; });
      toPar[s.name] = tp; net[s.name] = (useH ? s.net : s.strokes) - saved; score[s.name] = net[s.name];
    });
  } else if (fmt === 'duplicate') {
    standings.forEach(function (s) { var dp = 0; order.forEach(function (hn) { var p = stbl(s, hn); if (p !== undefined) dp += p * dmult(hn, lastNo); }); score[s.name] = dp; });
  } else if (fmt === 'skins') {
    var carry = opts.carryOver !== false; var total = standings.length;
    var sk = {}; standings.forEach(function (s) { sk[s.name] = 0; });
    var pot = 1; var nextHole = null;
    for (var i = 0; i < order.length; i++) {
      var hn = order[i];
      var have = standings.filter(function (s) { return hv(s, hn) !== undefined; });
      if (have.length < total) { nextHole = hn; break; }
      var mn = Math.min.apply(null, have.map(function (s) { return hv(s, hn); }));
      var w = have.filter(function (s) { return hv(s, hn) === mn; });
      if (w.length === 1) { sk[w[0].name] += pot; pot = 1; } else { if (carry) pot += 1; else pot = 1; }
    }
    standings.forEach(function (s) { score[s.name] = sk[s.name]; });
    meta.pot = pot; meta.nextHole = nextHole;
  } else if (fmt === 'matchplay') {
    var byG = {}; standings.forEach(function (s) { (byG[s.groupNo] = byG[s.groupNo] || []).push(s); });
    Object.keys(byG).forEach(function (gk) {
      var grp = byG[gk];
      order.forEach(function (hn) {
        var have = grp.filter(function (s) { return hv(s, hn) !== undefined; });
        if (have.length < 2) return;
        var mn = Math.min.apply(null, have.map(function (s) { return hv(s, hn); }));
        var w = have.filter(function (s) { return hv(s, hn) === mn; });
        if (w.length === 1) score[w[0].name] += 1;
      });
    });
  }
  return { score: score, toPar: toPar, net: net, meta: meta };
}

export default function LiveLeaderboard({ round }: { round: Round }) {
  const [standings, setStandings] = useState<LiveStanding[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>((['skins', 'matchplay', 'erado', 'duplicate', 'bb_stroke', 'bb_stableford', 'bb_match', 'scramble_stroke', 'scramble_match', 'foursome_match', 'greensome_match', 'tbb_stroke', 'tbb_stableford', 'tscramble_stroke'].indexOf((round as any).primaryFormat) >= 0 ? (round as any).primaryFormat : 'stableford') as Mode);
  const [profileName, setProfileName] = useState<string | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!round.liveEventId) return;
    let active = true;
    const cfg = { holes: round.holes, holeNumbers: round.holeNumbers };
    const pull = async () => {
      const rows = await fetchLiveScores(round.liveEventId as string);
      if (active) setStandings(buildStandings(rows, cfg));
    };
    pull();
    timer.current = setInterval(pull, 8000);
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [round.liveEventId]);

  const holeNumbers: number[] = (round.holeNumbers as number[]) || [];
  const parByNo: Record<number, number> = {};
  const siByNo: Record<number, number> = {};
  holeNumbers.forEach((hn, i) => { if (round.holes[i]) parByNo[hn] = round.holes[i].par; });
  holeNumbers.forEach((hn, i) => { if (round.holes[i]) siByNo[hn] = round.holes[i].strokeIndex; });
  const displayNos = [...holeNumbers].sort((a, b) => a - b);
  const front = displayNos.slice(0, 9);
  const back = displayNos.slice(9);

  const fmtPar = (n: number) => (n === 0 ? 'E' : n > 0 ? '+' + n : '' + n);
  const fmt = (round as any).primaryFormat as string;
  const special = ['skins', 'matchplay', 'erado', 'duplicate', 'bb_stroke', 'bb_stableford', 'bb_match', 'scramble_stroke', 'scramble_match', 'foursome_match', 'greensome_match', 'tbb_stroke', 'tbb_stableford', 'tscramble_stroke'].indexOf(fmt) >= 0;
  const isPair = ['bb_stroke', 'bb_stableford', 'bb_match', 'scramble_stroke', 'scramble_match', 'foursome_match', 'greensome_match', 'tbb_stroke', 'tbb_stableford', 'tscramble_stroke'].indexOf(fmt) >= 0;
  const fs = (round as any).formatSettings || {};
  const fmtData = special ? computeFormat(standings, holeNumbers, parByNo, fmt, { skinValue: fs.skinValue, carryOver: fs.carryOver, eradoCount: fs.erados, useHandicaps: fs.useHandicaps !== false }) : null;
  const teamRanked = (isPair && mode === fmt) ? computeTeams(standings, (round as any).teams || [], holeNumbers, parByNo, siByNo, fmt, { scrambleMethod: fs.scrambleMethod, bestN: fs.bestN }) : null;
  const scoreHdr = mode === 'skins' ? 'SKINS' : (mode === 'matchplay' || mode === 'bb_match' || mode === 'scramble_match' || mode === 'foursome_match' || mode === 'greensome_match') ? 'HOLES' : (mode === 'duplicate' || mode === 'stableford' || mode === 'bb_stableford' || mode === 'tbb_stableford') ? 'PTS' : 'NET';
  const scoreCell = (s: any) => {
    if (s._pair) return s.disp;
    if (fmtData && (mode === 'skins' || mode === 'matchplay' || mode === 'duplicate')) return fmtData.score[s.name];
    if (fmtData && mode === 'erado') return fmtData.net[s.name];
    return mode === 'stableford' ? s.points : s.net;
  };
  const ranked = teamRanked ? teamRanked : [...standings].sort((a, b) => {
    if (mode === 'erado' && fmtData) return (fmtData.toPar[a.name] - fmtData.toPar[b.name]) || b.thru - a.thru;
    if (fmtData && (mode === 'skins' || mode === 'matchplay' || mode === 'duplicate')) return (fmtData.score[b.name] - fmtData.score[a.name]) || b.thru - a.thru;
    return mode === 'stableford' ? b.points - a.points || b.thru - a.thru : a.netToPar - b.netToPar || b.thru - a.thru;
  });

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Text style={styles.dot}>● LIVE</Text>
        <Text style={styles.sub}>Whole field · tap a name for the scorecard</Text>
      </View>
      <View style={styles.tabs}>
        {special ? (
          <TouchableOpacity style={[styles.tab, mode === fmt && styles.tabActive]} onPress={() => setMode(fmt as Mode)}>
            <Text style={[styles.tabTxt, mode === fmt && styles.tabTxtActive]}>{FMT_TAB[fmt]}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.tab, mode === 'stableford' && styles.tabActive]} onPress={() => setMode('stableford')}>
          <Text style={[styles.tabTxt, mode === 'stableford' && styles.tabTxtActive]}>Stableford</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'stroke' && styles.tabActive]} onPress={() => setMode('stroke')}>
          <Text style={[styles.tabTxt, mode === 'stroke' && styles.tabTxtActive]}>Stroke</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'contests' && styles.tabActive]} onPress={() => setMode('contests')}>
          <Text style={[styles.tabTxt, mode === 'contests' && styles.tabTxtActive]}>Contests</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {mode === 'skins' && fmtData && fmtData.meta.nextHole ? (
          <Text style={styles.skinNote}>Pot riding: {fmtData.meta.pot} skin{fmtData.meta.pot === 1 ? '' : 's'} (worth {fmtData.meta.pot * (fmtData.meta.value || 1)}) on hole {fmtData.meta.nextHole}</Text>
        ) : null}
        {mode !== 'contests' && ranked.length > 0 ? (
          <View style={styles.headRow}>
            <Text style={styles.hRank}>#</Text>
            <Text style={styles.hName}>NAME</Text>
            <Text style={styles.hScore}>{scoreHdr}</Text>
            <Text style={styles.hToPar}>TO PAR</Text>
            <Text style={styles.hThru}>THRU</Text>
            <View style={styles.hChevSpacer} />
          </View>
        ) : null}
        {mode === 'contests' ? (
          <ContestsView eventId={round.liveEventId as string} />
        ) : ranked.length === 0 ? (
          <Text style={styles.msg}>No scores in yet — standings appear as players enter scores.</Text>
        ) : (
          ranked.map((s, i) => {
            const _rv = (r: any) => (r._pair ? r.disp : mode === 'stableford' ? r.points : (fmtData && (mode === 'skins' || mode === 'matchplay' || mode === 'duplicate')) ? fmtData.score[r.name] : (fmtData && mode === 'erado') ? fmtData.toPar[r.name] : r.netToPar);
            let _r1 = i; while (_r1 > 0 && _rv(ranked[_r1 - 1]) === _rv(s)) _r1--;
            const _rank = _r1 + 1;
            const _tied = (i > 0 && _rv(ranked[i - 1]) === _rv(s)) || (i < ranked.length - 1 && _rv(ranked[i + 1]) === _rv(s));
            const isOpen = expanded === s.name;
            return (
              <View key={s.name + i} style={styles.cardWrap}>
                <TouchableOpacity style={styles.row} onPress={() => setExpanded(isOpen ? null : s.name)}>
                  <Text style={styles.rank}>{(_tied ? '=' : '') + _rank}</Text>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setExpanded(isOpen ? null : s.name)}>
                    <Text style={[styles.name, styles.nameLink]}>{s.name}</Text>
                    <Text style={styles.detail}>{s._pair ? ((s.teamHcp != null ? 'Team HCP ' + s.teamHcp : 'Team') + ' · Group ' + s.groupNo) : ('HCP ' + s.handicap + ' · Group ' + s.groupNo)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.colScore}>{scoreCell(s)}</Text>
                  <Text style={styles.colToPar}>{fmtPar(mode === 'erado' && fmtData ? fmtData.toPar[s.name] : s.netToPar)}</Text>
                  <View style={styles.thruCol}>
                    <Text style={styles.thruVal}>{s.thru >= displayNos.length ? 'F' : (s.thru ? s.thru : '–')}</Text>
                  </View>
                  <Text style={styles.chev}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {isOpen ? (
                  <View style={styles.card}>
                    <ScoreGrid nos={front} siByNo={siByNo} parByNo={parByNo} gross={s.holes} pts={s.pts} netByNo={s.nets} mode={mode} totalLabel={'Out'} />
                    {back.length > 0 ? (
                      <ScoreGrid nos={back} siByNo={siByNo} parByNo={parByNo} gross={s.holes} pts={s.pts} netByNo={s.nets} mode={mode} totalLabel={'In'} />
                    ) : null}
                    <View style={styles.totRow}>
                      <Text style={styles.totLabel}>Total</Text>
                      <Text style={styles.totVal}>
                        {mode === 'stableford' ? s.strokes + ' strokes  ·  ' + s.points + ' pts' : s.net + ' net  ·  ' + s.strokes + ' gross  ·  ' + fmtPar(s.netToPar)}
                      </Text>
                    </View>
                    <View style={styles.legend}>
                      <View style={[styles.lg, SCORE_BG.birdie]} /><Text style={styles.lgT}>birdie</Text>
                      <View style={[styles.lg, SCORE_BG.bogey]} /><Text style={styles.lgT}>bogey</Text>
                      <View style={[styles.lg, SCORE_BG.dbl]} /><Text style={styles.lgT}>dbl+</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
      {profileName ? (
        <PlayerProfileModal name={profileName} onClose={() => setProfileName(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skinNote: { color: '#1f7a44', fontWeight: '700', fontSize: 12, marginBottom: 8 },
  colScore: { fontSize: 14, fontWeight: '700', color: colors.text, width: 46, textAlign: 'center' },
  colToPar: { fontSize: 18, fontWeight: '900', color: colors.text, width: 54, textAlign: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4 },
  hRank: { width: 26, fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  hName: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  hScore: { width: 46, fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textAlign: 'center' },
  hToPar: { width: 54, fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textAlign: 'center' },
  hThru: { width: 42, fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textAlign: 'center' },
  hChevSpacer: { width: 22 },
  thruCol: { width: 42, alignItems: 'center' },
  thruVal: { color: colors.text, fontWeight: '700', fontSize: 15 },
  thruLbl: { color: colors.textMuted, fontSize: 9, letterSpacing: 0.5 },
  screen: { flex: 1, backgroundColor: colors.bgDark },
  bar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingTop: 50, paddingBottom: 8 },
  dot: { color: '#FF4D4D', fontWeight: '900', fontSize: 13 },
  sub: { color: colors.textOnDarkMuted, fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center' },
  tabActive: { backgroundColor: colors.green },
  tabTxt: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  tabTxtActive: { color: '#fff' },
  body: { paddingHorizontal: 12, paddingTop: 2 },
  msg: { color: colors.textOnDarkMuted, textAlign: 'center', padding: 20, lineHeight: 20 },
  cardWrap: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12 },
  rank: { width: 26, fontSize: 16, fontWeight: '900', color: colors.greenDark },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  nameLink: { textDecorationLine: 'underline' },
  detail: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  val: { fontSize: 18, fontWeight: '900', color: colors.text, minWidth: 40, textAlign: 'right' },
  chev: { width: 22, textAlign: 'center', fontSize: 11, color: colors.textMuted },
  card: { backgroundColor: '#fff', borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, marginTop: 2, paddingVertical: 8, paddingHorizontal: 6 },
  block: { marginBottom: 6 },
  gRow: { flexDirection: 'row', alignItems: 'stretch' },
  gHead: { width: 42, fontSize: 11, fontWeight: '800', color: '#5b6b62', paddingVertical: 4, paddingLeft: 2 },
  gCell: { flex: 1, textAlign: 'center', fontSize: 12, color: '#1a1a1a', paddingVertical: 4 },
  gPts: { color: '#2E6DA4', fontWeight: '700' },
  gScoreWrap: { flex: 1, marginHorizontal: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  gScoreTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  gTot: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#111', fontSize: 12, paddingVertical: 4 },
  gTotHead: { fontWeight: '900', color: '#5b6b62' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', marginTop: 4, paddingTop: 6, paddingHorizontal: 4 },
  totLabel: { fontWeight: '900', color: '#1a1a1a', fontSize: 13 },
  totVal: { color: '#444', fontSize: 12, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingHorizontal: 4 },
  lg: { width: 12, height: 12, borderRadius: 3, marginLeft: 8 },
  lgT: { fontSize: 10, color: '#777' },
  cSection: { marginBottom: 16 },
  cHeader: { color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 8 },
  cHoleBlock: { backgroundColor: colors.card, borderRadius: radius.md, padding: 10, marginBottom: 8 },
  cHoleLabel: { color: colors.textMuted, fontWeight: '800', fontSize: 12, marginBottom: 6 },
  cRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  cRowWin: { backgroundColor: colors.green },
  cRank: { width: 28, color: colors.text, fontWeight: '800', fontSize: 14 },
  cName: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 14 },
  cMetres: { color: colors.text, fontWeight: '800', fontSize: 14 },
  cWinTxt: { color: '#fff' },
});
