import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

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

export default function PlayerCard({ results, holes, nums, mode }: any) {
  const front: number[] = []; const back: number[] = [];
  (nums || []).forEach((n: number, i: number) => { (i < 9 ? front : back).push(n); });
  const siByNo: any = {}, parByNo: any = {}, gross: any = {}, pts: any = {}, nets: any = {};
  (nums || []).forEach((n: number, i: number) => { siByNo[n] = holes[i] ? holes[i].strokeIndex : ''; parByNo[n] = holes[i] ? holes[i].par : ''; gross[n] = results[i] ? results[i].gross : null; pts[n] = results[i] ? results[i].stableford : 0; nets[n] = results[i] ? results[i].net : null; });
  const totGross = (results || []).reduce((t: number, r: any) => t + (r.gross || 0), 0);
  const totPts = (results || []).reduce((t: number, r: any) => t + (r.stableford || 0), 0);
  const totNet = (results || []).reduce((t: number, r: any) => t + (r.net || 0), 0);
  return (
    <View style={styles.card}>
      <ScoreGrid nos={front} siByNo={siByNo} parByNo={parByNo} gross={gross} pts={pts} netByNo={nets} mode={mode} totalLabel={'Out'} />
      {back.length > 0 ? <ScoreGrid nos={back} siByNo={siByNo} parByNo={parByNo} gross={gross} pts={pts} netByNo={nets} mode={mode} totalLabel={'In'} /> : null}
      <View style={styles.totRow}><Text style={styles.totLabel}>Total</Text><Text style={styles.totVal}>{mode === 'stableford' ? (totGross + '  strokes  ·  ' + totPts + ' pts') : (totNet + ' net  ·  ' + totGross + ' gross')}</Text></View>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.sw, { backgroundColor: '#E06666' }]} /><Text style={styles.legendTxt}>birdie</Text></View>
        <View style={styles.legendItem}><View style={[styles.sw, { backgroundColor: '#9FC5E8' }]} /><Text style={styles.legendTxt}>bogey</Text></View>
        <View style={styles.legendItem}><View style={[styles.sw, { backgroundColor: '#2E6DA4' }]} /><Text style={styles.legendTxt}>dbl+</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 6 },
  gRow: { flexDirection: 'row', alignItems: 'stretch' },
  gHead: { width: 42, fontSize: 11, fontWeight: '800', color: '#5b6b62', paddingVertical: 4, paddingLeft: 2 },
  gCell: { flex: 1, textAlign: 'center', fontSize: 12, color: '#1a1a1a', paddingVertical: 4 },
  gTot: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#111', fontSize: 12, paddingVertical: 4 },
  gTotHead: { fontWeight: '900', color: '#5b6b62' },
  gScoreWrap: { flex: 1, marginHorizontal: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  gScoreTxt: { fontSize: 13, fontWeight: '800', color: '#111' },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 8 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e3e8e4', marginTop: 8, paddingTop: 8 },
  totLabel: { fontWeight: '800', fontSize: 14, color: '#15211b' },
  totVal: { fontWeight: '700', fontSize: 13, color: '#15211b' },
  legend: { flexDirection: 'row', marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  sw: { width: 18, height: 18, borderRadius: 4, marginRight: 6 },
  legendTxt: { fontSize: 12, color: '#6b7a72' },
});
