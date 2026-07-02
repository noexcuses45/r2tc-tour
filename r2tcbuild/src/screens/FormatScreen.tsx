import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet } from 'react-native';
import { GameFormat } from '../types';
import { FORMAT_OPTIONS, FORMAT_LABELS } from '../logic/formats';
import { colors, radius } from '../theme';

type Settings = { useHandicaps?: boolean; skinValue?: number; carryOver?: boolean; erados?: number; stablefordType?: string; scrambleMethod?: string; bestN?: number };

const META: Record<string, { type: string; desc: string; settings: string[]; cat: string }> = {
  stroke: { cat: 'individual', type: 'Stroke Play', desc: 'Net stroke play. Your handicap-adjusted score against par over the round. Lowest net total wins.', settings: ['useHandicaps'] },
  stableford: { cat: 'individual', type: 'Stableford', desc: 'Points versus net par on each hole: 2 for a net par, 3 for birdie, 4 for eagle, 1 for bogey, 0 for double bogey or worse. Most points wins.', settings: ['useHandicaps'] },
  matchplay: { cat: 'individual', type: 'Match Play', desc: 'You play the others in your group hole by hole. The sole lowest net score wins the hole. Whoever wins the most holes in the group leads.', settings: ['useHandicaps'] },
  skins: { cat: 'individual', type: 'Skins', desc: 'Each hole is worth a set amount (a skin). The sole lowest net score wins it. If the hole is tied, the skin carries to the next hole and the pot grows.', settings: ['skinValue', 'carryOver', 'useHandicaps'] },
  erado: { cat: 'individual', type: 'Stroke Play', desc: 'Net stroke play where your worst holes are erased and counted as net par. Choose how many you can erase. The final hole and any net-par-or-better hole cannot be erased.', settings: ['erados', 'useHandicaps'] },
  duplicate: { cat: 'individual', type: 'Stableford', desc: 'Net Stableford with a random 1x, 2x or 3x multiplier on every hole, shared by the whole field. The final hole always counts double. Most points wins.', settings: ['stablefordType', 'useHandicaps'] },
  bestball: { cat: 'pair', type: 'Team (2v2)', desc: 'Each group of four splits into two teams. The better net score on each team counts for the hole. Played off 85% handicap allowance.', settings: ['useHandicaps'] },
  bb_stroke: { cat: 'pair', type: 'Stroke Play · Pair', desc: 'Better Ball (Four Ball). Each player plays their own ball; on every hole the better of the two net scores counts as the team score. Lowest team total wins. Teams are the pairs in each group.', settings: ['useHandicaps'] },
  bb_stableford: { cat: 'pair', type: 'Stableford · Pair', desc: 'Better Ball Stableford. Each player plays their own ball; the higher Stableford points of the two count as the team score on each hole. Most points wins. Teams are the pairs in each group.', settings: ['useHandicaps'] },
  bb_match: { cat: 'pair', type: 'Match Play · Pair', desc: 'Better Ball Match Play. Two teams of two play match play; each hole the better net score of each team is compared and the lower wins the hole.', settings: ['useHandicaps'] },
  scramble_stroke: { cat: 'pair', type: 'Stroke Play · Pair', desc: 'Two-man scramble: both tee off, take the better shot, and both play on from there until holed — one team score per hole. Team handicap is the combined handicaps divided by 4 (Australian Ambrose; 35/15 optional). Lowest team net wins.', settings: ['scrambleMethod', 'useHandicaps'] },
  scramble_match: { cat: 'pair', type: 'Match Play · Pair', desc: 'Scramble played as match play between two teams. One team score per hole off the combined handicaps divided by 4 (Australian Ambrose; 35/15 optional); the lower net wins the hole.', settings: ['scrambleMethod', 'useHandicaps'] },
  foursome_match: { cat: 'pair', type: 'Match Play · Pair', desc: 'Foursome (alternate shot): partners share one ball and take turns. Match play between two teams off 50% of the combined handicap.', settings: ['useHandicaps'] },
  greensome_match: { cat: 'pair', type: 'Match Play · Pair', desc: 'Greensome: both partners tee off, pick the better ball, then alternate shots to hole out. Match play off 60% of the lower plus 40% of the higher handicap.', settings: ['useHandicaps'] },
  tbb_stroke: { cat: 'team', type: 'Stroke Play · Team', desc: 'Team Best Ball (3–5 players). Each player plays their own ball off 85% handicap; the best N net scores per hole (you choose N) add up as the team score. Lowest team total wins.', settings: ['bestN', 'useHandicaps'] },
  tbb_stableford: { cat: 'team', type: 'Stableford · Team', desc: 'Team Best Ball Stableford (3–5 players). Each player off 85% handicap; the best N Stableford scores per hole count as the team score. Most points wins.', settings: ['bestN', 'useHandicaps'] },
  tscramble_stroke: { cat: 'team', type: 'Stroke Play · Team', desc: 'Team Scramble / Ambrose (3–5 players). Everyone tees off, the best shot is taken and all play on from there — one team score per hole. Team handicap = combined ÷ (2 × players). Lowest net wins.', settings: ['scrambleMethod', 'useHandicaps'] },
};

const DEFAULTS: Settings = { useHandicaps: true, skinValue: 1, carryOver: true, erados: 4, stablefordType: 'Regular', scrambleMethod: 'ambrose4', bestN: 2 };

export default function FormatScreen({ format, settings, onApply, onClose }: { format: GameFormat; settings: Settings; onApply: (f: GameFormat, s: Settings) => void; onClose: () => void }) {
  const [sel, setSel] = useState<GameFormat | null>(null);
  const [cat, setCat] = useState<string>('individual');
  const [draft, setDraft] = useState<Settings>({ ...DEFAULTS, ...(settings || {}) });
  const set = (k: keyof Settings, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const has = (k: string) => sel != null && META[sel].settings.indexOf(k) >= 0;

  return (
    <Modal visible animationType="slide" onRequestClose={sel ? () => setSel(null) : onClose}>
      <View style={styles.screen}>
        <View style={styles.head}>
          <TouchableOpacity onPress={sel ? () => setSel(null) : onClose}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{sel ? META[sel].type.toUpperCase() : 'GAME FORMAT'}</Text>
          <View style={{ width: 50 }} />
        </View>
        {!sel ? (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.lead}>Choose your match type, then open it to adjust its rules.</Text>
            <View style={styles.seg}>
              <TouchableOpacity style={[styles.segBtn, cat === 'individual' && styles.segActive]} onPress={() => setCat('individual')}><Text style={[styles.segTxt, cat === 'individual' && styles.segTxtActive]}>Individual</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.segBtn, cat === 'pair' && styles.segActive]} onPress={() => setCat('pair')}><Text style={[styles.segTxt, cat === 'pair' && styles.segTxtActive]}>Pairs</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.segBtn, cat === 'team' && styles.segActive]} onPress={() => setCat('team')}><Text style={[styles.segTxt, cat === 'team' && styles.segTxtActive]}>Teams</Text></TouchableOpacity>
            </View>
            {FORMAT_OPTIONS.filter(([key]) => (META[key] ? META[key].cat : 'individual') === cat).map(([key, label]) => (
              <TouchableOpacity key={key} style={[styles.card, format === key && styles.cardActive]} onPress={() => setSel(key)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{label}{format === key ? '  ✓' : ''}</Text>
                  <Text style={styles.cardType}>{META[key] ? META[key].type : ''}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.detName}>{FORMAT_LABELS[sel]}</Text>
            <Text style={styles.detType}>{META[sel].type}</Text>
            <Text style={styles.detDesc}>{META[sel].desc}</Text>
            <Text style={styles.section}>GAME FORMAT SETTINGS</Text>
            {has('skinValue') ? (
              <View style={styles.row}>
                <Text style={styles.rowLbl}>Skin value (amount)</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => set('skinValue', Math.max(1, (draft.skinValue || 1) - 1))}><Text style={styles.stepTxt}>-</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{draft.skinValue}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => set('skinValue', (draft.skinValue || 1) + 1)}><Text style={styles.stepTxt}>+</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
            {has('carryOver') ? (
              <View style={styles.row}>
                <Text style={styles.rowLbl}>Use carry over</Text>
                <Switch value={draft.carryOver !== false} onValueChange={(v) => set('carryOver', v)} trackColor={{ true: colors.green }} />
              </View>
            ) : null}
            {has('erados') ? (
              <View style={styles.row}>
                <Text style={styles.rowLbl}>Erados per round</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => set('erados', Math.max(1, (draft.erados || 4) - 1))}><Text style={styles.stepTxt}>-</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{draft.erados}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => set('erados', Math.min(9, (draft.erados || 4) + 1))}><Text style={styles.stepTxt}>+</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
            {has('stablefordType') ? (
              <View style={styles.row}>
                <Text style={styles.rowLbl}>Stableford type</Text>
                <Text style={styles.rowVal}>Regular</Text>
              </View>
            ) : null}
            {has('bestN') ? (
              <View style={styles.row}>
                <Text style={styles.rowLbl}>Count best N scores</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => set('bestN', Math.max(1, (draft.bestN || 2) - 1))}><Text style={styles.stepTxt}>-</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{draft.bestN || 2}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => set('bestN', Math.min(5, (draft.bestN || 2) + 1))}><Text style={styles.stepTxt}>+</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
            {has('scrambleMethod') ? (
              <View style={styles.row}>
                <Text style={styles.rowLbl}>Scramble handicap</Text>
                <TouchableOpacity onPress={() => set('scrambleMethod', draft.scrambleMethod === 'official' ? 'ambrose4' : 'official')}>
                  <Text style={styles.rowVal}>{draft.scrambleMethod === 'official' ? 'Official GA %' : 'Social ÷ N'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.rowLbl}>Use handicaps</Text>
              <Switch value={draft.useHandicaps !== false} onValueChange={(v) => set('useHandicaps', v)} trackColor={{ true: colors.green }} />
            </View>
            <TouchableOpacity style={styles.selectBtn} onPress={() => onApply(sel, draft)}>
              <Text style={styles.selectTxt}>Select</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f5f4' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 48, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6ece8' },
  back: { color: colors.green, fontWeight: '700', fontSize: 15 },
  title: { fontWeight: '800', fontSize: 16, color: '#143a22', letterSpacing: 0.5 },
  body: { padding: 14, paddingBottom: 60 },
  lead: { color: '#5b6b62', fontSize: 13, marginBottom: 12 },
  seg: { flexDirection: 'row', backgroundColor: '#e6ece8', borderRadius: 10, padding: 4, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segActive: { backgroundColor: '#fff' },
  segTxt: { color: '#5b6b62', fontWeight: '700', fontSize: 14 },
  segTxtActive: { color: colors.green },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e6ece8' },
  cardActive: { borderColor: colors.green, borderWidth: 2 },
  cardName: { fontWeight: '800', fontSize: 15, color: '#143a22' },
  cardType: { color: '#7c8a82', fontSize: 12, marginTop: 2 },
  chev: { color: '#b8c2bc', fontSize: 24, fontWeight: '300' },
  detName: { fontWeight: '800', fontSize: 22, color: '#143a22' },
  detType: { color: colors.green, fontWeight: '700', fontSize: 13, marginTop: 2, marginBottom: 10 },
  detDesc: { color: '#3c4a42', fontSize: 14, lineHeight: 21 },
  section: { fontWeight: '800', fontSize: 12, color: '#7c8a82', letterSpacing: 0.6, marginTop: 22, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: '#eef2f0' },
  rowLbl: { color: '#143a22', fontSize: 15, fontWeight: '600', flex: 1 },
  rowVal: { color: colors.green, fontWeight: '700', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 40, height: 34, borderRadius: 8, backgroundColor: '#e7f3ec', alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: colors.green, fontWeight: '800', fontSize: 18 },
  stepVal: { minWidth: 40, textAlign: 'center', fontWeight: '800', fontSize: 16, color: '#143a22' },
  selectBtn: { backgroundColor: colors.green, borderRadius: 22, paddingVertical: 15, alignItems: 'center', marginTop: 26 },
  selectTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
