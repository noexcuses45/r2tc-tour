import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { holeResults, playingHandicap, totalPar } from '../logic/scoring';
import { colors, radius } from '../theme';
import { Round } from '../types';

interface Props {
  round: Round;
  onEndGame?: () => void;
}

function shapeFor(gross, par) {
  if (gross == null) return { kind: 'none' };
  const d = gross - par;
  if (d <= -2) return { kind: 'circle', bg: '#F2A100' };
  if (d === -1) return { kind: 'circle', bg: '#E23B3B' };
  if (d === 0) return { kind: 'none' };
  if (d === 1) return { kind: 'square', bg: '#5C9BD5' };
  return { kind: 'square', bg: '#26467A' };
}

export default function ScorecardScreen({ round, onEndGame }: Props) {
  const holes = round.holes || [];
  const nums = round.holeNumbers || holes.map((_, i) => i + 1);
  const splitAt = holes.length > 9 ? 9 : holes.length;

  const Section = ({ res, label, from, to }) => {
    const idx = [];
    for (let i = from; i < to; i++) idx.push(i);
    const sumPar = idx.reduce((s, i) => s + (holes[i] ? holes[i].par : 0), 0);
    const sumGross = idx.reduce((s, i) => s + ((res[i] && res[i].gross) || 0), 0);
    const sumNet = idx.reduce((s, i) => s + ((res[i] && res[i].net) || 0), 0);
    return (
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={[styles.lab, styles.head]}>Hole</Text>
          {idx.map((i) => (<Text key={i} style={[styles.cell, styles.head]}>{nums[i]}</Text>))}
          <Text style={[styles.tot, styles.head]}>{label}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.lab}>SI</Text>
          {idx.map((i) => (<Text key={i} style={[styles.cell, styles.muted]}>{holes[i] ? holes[i].strokeIndex : ''}</Text>))}
          <Text style={styles.tot}> </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.lab}>Par</Text>
          {idx.map((i) => (<Text key={i} style={[styles.cell, styles.muted]}>{holes[i] ? holes[i].par : ''}</Text>))}
          <Text style={[styles.tot, styles.muted]}>{sumPar}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.lab}>Score</Text>
          {idx.map((i) => {
            const g = res[i] ? res[i].gross : null;
            const sh = shapeFor(g, holes[i] ? holes[i].par : 0);
            if (sh.kind === 'none') return (<Text key={i} style={[styles.cell, styles.scoreTxt]}>{g == null ? '–' : g}</Text>);
            return (
              <View key={i} style={styles.cell}>
                <View style={[styles.shape, sh.kind === 'circle' ? styles.circle : styles.square, { backgroundColor: sh.bg }]}>
                  <Text style={styles.shapeTxt}>{g}</Text>
                </View>
              </View>
            );
          })}
          <Text style={[styles.tot, styles.bold]}>{sumGross || '–'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.lab}>Net</Text>
          {idx.map((i) => (<Text key={i} style={[styles.cell, styles.muted]}>{res[i] && res[i].net != null ? res[i].net : '–'}</Text>))}
          <Text style={[styles.tot, styles.muted]}>{sumNet || '–'}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>SCORECARDS</Text>
        <Text style={styles.sub}>{round.courseName} · {new Date(round.date).toLocaleDateString()}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {round.players.map((p, pi) => {
          const res = holeResults(p, holes);
          const gross = res.reduce((s, r) => s + (r.gross || 0), 0);
          const net = res.reduce((s, r) => s + (r.net || 0), 0);
          const phcp = playingHandicap(p.handicap, holes.length);
          return (
            <View key={pi} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>HCP {phcp} · {gross || '–'} ({net || '–'})</Text>
              </View>
              <Section res={res} label="OUT" from={0} to={splitAt} />
              {holes.length > 9 ? <Section res={res} label="IN" from={9} to={holes.length} /> : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalTxt}>Total Gross {gross || '–'}  ·  Net {net || '–'}  ·  Par {totalPar(holes)}</Text>
              </View>
            </View>
          );
        })}
        <View style={styles.legend}>
          <View style={styles.legItem}><View style={[styles.dot, styles.dotRound, { backgroundColor: '#F2A100' }]} /><Text style={styles.legTxt}>Eagle+</Text></View>
          <View style={styles.legItem}><View style={[styles.dot, styles.dotRound, { backgroundColor: '#E23B3B' }]} /><Text style={styles.legTxt}>Birdie</Text></View>
          <View style={styles.legItem}><View style={[styles.dot, { backgroundColor: '#5C9BD5' }]} /><Text style={styles.legTxt}>Bogey</Text></View>
          <View style={styles.legItem}><View style={[styles.dot, { backgroundColor: '#26467A' }]} /><Text style={styles.legTxt}>Dbl+</Text></View>
        </View>
        {onEndGame ? (
          <TouchableOpacity style={styles.endBtn} onPress={onEndGame} activeOpacity={0.9}>
            <Text style={styles.endTxt}>End game</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: { color: colors.textOnDark, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.textOnDarkMuted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  scroll: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 10, marginBottom: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  section: { marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  lab: { width: 34, fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  cell: { flex: 1, height: 26, textAlign: 'center', fontSize: 12, color: colors.text, alignItems: 'center', justifyContent: 'center' },
  scoreTxt: { fontWeight: '700' },
  tot: { width: 30, textAlign: 'center', fontSize: 12, color: colors.text },
  head: { backgroundColor: colors.greenDark, color: '#fff', fontWeight: '700' },
  muted: { color: colors.textMuted },
  bold: { fontWeight: '800' },
  shape: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  circle: { borderRadius: 11 },
  square: { borderRadius: 3 },
  shapeTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  totalRow: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  totalTxt: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 2, marginBottom: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginVertical: 3 },
  dot: { width: 14, height: 14, borderRadius: 3, marginRight: 4 },
  dotRound: { borderRadius: 7 },
  legTxt: { fontSize: 11, color: colors.textOnDarkMuted },
  endBtn: { backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  endTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
