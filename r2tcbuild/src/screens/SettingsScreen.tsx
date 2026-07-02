import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchLiveScores, getEvent, setLiveScore, clearLiveScore, updateEventConfig } from '../logic/liveEvents';
import { fetchAllPlayers } from '../logic/supabase';
import { colors, radius } from '../theme';
import { Round } from '../types';

interface P { id: string; name: string; handicap: number; groupNo: number; }

export default function SettingsScreen({ round, onClose }: { round: Round; onClose: () => void }) {
  const eventId = round.liveEventId as string;
  const [players, setPlayers] = useState<P[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [gGroups, setGGroups] = useState<any[][]>([]);
  const [picked, setPicked] = useState<{ gi: number; si: number } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{ gi: number; si: number } | null>(null);
  useEffect(() => { fetchAllPlayers().then(setRoster); }, []);
  const tapFilled = (gi: number, si: number) => {
    if (!picked) { setPicked({ gi, si }); return; }
    setGGroups((prev) => { const next = prev.map((g) => g.slice()); const a = next[picked.gi][picked.si]; next[picked.gi][picked.si] = next[gi][si]; next[gi][si] = a; return next; });
    setPicked(null);
  };
  const tapEmpty = (gi: number, si: number) => {
    if (picked) {
      setGGroups((prev) => { const next = prev.map((g) => g.slice()); next[gi][si] = next[picked.gi][picked.si]; next[picked.gi][picked.si] = null; return next; });
      setPicked(null);
    } else { setPickerTarget({ gi, si }); }
  };
  const placeFromRoster = (rp: any) => {
    if (!pickerTarget) return;
    setGGroups((prev) => { const next = prev.map((g) => g.slice()); next[pickerTarget.gi][pickerTarget.si] = { id: rp.id, name: rp.name, handicap: rp.handicap }; return next; });
    setPickerTarget(null);
  };
  const clearSlot = (gi: number, si: number) => setGGroups((prev) => { const next = prev.map((g) => g.slice()); next[gi][si] = null; return next; });
  const removeGroup = (gi: number) => { setPicked(null); setGGroups((prev) => prev.filter((_, i) => i !== gi)); };
  const addGroup = () => setGGroups((prev) => prev.concat([[null, null, null, null]]));
  const saveGroups = async () => {
    const groups = gGroups.map((g) => g.filter(Boolean).map((p: any) => ({ id: p.id, name: p.name, handicap: p.handicap })));
    const res = await updateEventConfig(eventId, { groups });
    if (res && res.ok) Alert.alert('Changes saved ✓', 'Your group changes are now live for everyone.');
    else Alert.alert('Could not save', (res && res.error) || 'Please check your connection and try again.');
  };
  const [scores, setScores] = useState<any[]>([]);
  const [sel, setSel] = useState<P | null>(null);
  const [editHole, setEditHole] = useState<number | null>(null);
  const [ldHoles, setLdHoles] = useState<number[]>([]);
  const [c2pHoles, setC2pHoles] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const holeNumbers: number[] = round.holeNumbers || [];
  const parByNo: any = {};
  holeNumbers.forEach((hn, i) => { if (round.holes[i]) parByNo[hn] = round.holes[i].par; });

  const load = async () => {
    const ev = await getEvent(eventId);
    const cfg = (ev && ev.config) || {};
    let srcGroups: any[] = cfg.groups || [];
    const hasCloud = srcGroups.length > 0 && srcGroups.some((g: any[]) => (g || []).length > 0);
    if (!hasCloud) {
      const localGroups = ((round as any).groups || []).map((ids: any[]) => (ids || []).map((id: any) => {
        const p = ((round as any).players || []).find((pp: any) => pp.id === id);
        return p ? { id: p.id, name: p.name, handicap: p.handicap } : null;
      }).filter(Boolean));
      if (localGroups.length > 0 && localGroups.some((g: any[]) => g.length > 0)) srcGroups = localGroups;
      else if ((round as any).players && (round as any).players.length) srcGroups = [((round as any).players).map((p: any) => ({ id: p.id, name: p.name, handicap: p.handicap }))];
    }
    const ps: P[] = [];
    (srcGroups || []).forEach((g: any[], gi: number) => {
      (g || []).forEach((pl: any) => ps.push({ id: pl.id, name: pl.name, handicap: pl.handicap || 0, groupNo: gi + 1 }));
    });
    setPlayers(ps);
    const grouped = (srcGroups || []).map((g: any[]) => { const slots: any[] = (g || []).map((pl: any) => ({ id: pl.id, name: pl.name, handicap: pl.handicap || 0 })); while (slots.length < 4) slots.push(null); return slots; });
    if (grouped.length === 0) grouped.push([null, null, null, null]);
    setGGroups(grouped);
    const c = cfg.contests || (round as any).contests || {};
    setLdHoles(c.longestDrive || []);
    setC2pHoles(c.closestToPin || []);
    setScores(await fetchLiveScores(eventId));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const scoreFor = (name: string, hn: number) => {
    const row = scores.find((s) => s.player_name === name && s.hole_number === hn);
    return row && row.strokes != null ? row.strokes : null;
  };

  const apply = async (val: number | null) => {
    if (!sel || editHole == null) return;
    if (val == null) await clearLiveScore(eventId, sel.name, editHole);
    else await setLiveScore(eventId, sel.name, sel.handicap, sel.groupNo, editHole, val);
    setEditHole(null);
    setScores(await fetchLiveScores(eventId));
  };

  const toggle = (holeNo: number, list: number[], set: (v: number[]) => void) => {
    set(list.includes(holeNo) ? list.filter((h) => h !== holeNo) : [...list, holeNo].sort((a, b) => a - b));
  };

  const saveContest = async () => {
    const res = await updateEventConfig(eventId, { contests: { longestDrive: ldHoles, closestToPin: c2pHoles } });
    if (res.ok) {
      Alert.alert('Changes saved ✓', 'Contest holes updated for this event.');
    } else {
      Alert.alert('Could not save', 'Status ' + res.status + ' · rows changed: ' + res.count + (res.error ? '\n' + res.error : ''));
    }
  };

  const contestRows: [string, number[], (v: number[]) => void][] = [
    ['Longest Drive', ldHoles, setLdHoles],
    ['Closest to the Pin', c2pHoles, setC2pHoles],
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 60 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.note}>Only the event creator sees this. Edits update the shared leaderboard for everyone.</Text>
          <View style={styles.gmCard}>
            <Text style={styles.gmHeading}>PLAYERS & GROUPS</Text>
            <Text style={styles.pickHint}>{picked ? 'Holding a player — tap any spot to drop, or tap another player to swap.' : 'Tap a player to pick them up, then tap a spot to move or swap.'}</Text>
            {gGroups.map((g, gi) => (
              <View key={'g' + gi} style={styles.grpBox}>
                <View style={styles.grpHead}>
                  <Text style={styles.grpHeadTxt}>Group {gi + 1}</Text>
                  <TouchableOpacity onPress={() => removeGroup(gi)}><Text style={styles.grpRemove}>Remove</Text></TouchableOpacity>
                </View>
                <View style={styles.slotGrid}>
                  {[0, 1, 2, 3].map((si) => {
                    const p = g[si];
                    const isPicked = !!picked && picked.gi === gi && picked.si === si;
                    return p ? (
                      <TouchableOpacity key={si} style={[styles.slotFilled, isPicked ? styles.slotPicked : null]} onPress={() => tapFilled(gi, si)}>
                        <Text style={styles.slotName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.slotSub}>HCP {p.handicap}</Text>
                        <TouchableOpacity style={styles.slotX} onPress={() => clearSlot(gi, si)}><Text style={styles.slotXTxt}>✕</Text></TouchableOpacity>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity key={si} style={[styles.slotEmpty, picked ? styles.slotDrop : null]} onPress={() => tapEmpty(gi, si)}>
                        <Text style={styles.slotAdd}>{picked ? 'Drop here' : '+ Add Player'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            {pickerTarget ? (
              <View style={styles.gmRoster}>
                <Text style={styles.gmGroupTitle}>Add to Group {pickerTarget.gi + 1}</Text>
                {roster.filter((rp) => !gGroups.some((g) => g.some((p: any) => p && (p.id === rp.id || (p.name || '').toLowerCase() === (rp.name || '').toLowerCase())))).slice(0, 40).map((rp) => (
                  <TouchableOpacity key={rp.id} style={styles.gmRosterItem} onPress={() => placeFromRoster(rp)}><Text style={styles.gmRosterTxt}>{rp.name} · HCP {rp.handicap}</Text></TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.gmRosterItem} onPress={() => setPickerTarget(null)}><Text style={[styles.gmRosterTxt, { color: '#c0392b' }]}>Cancel</Text></TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.gmAddBtn} onPress={addGroup}><Text style={styles.gmAddTxt}>+ Add group</Text></TouchableOpacity>
            <TouchableOpacity style={styles.gmSave} onPress={saveGroups}><Text style={styles.gmSaveTxt}>Save group changes</Text></TouchableOpacity>
          </View>

          <Text style={styles.section}>EDIT A PLAYER'S SCORE</Text>
          <View style={styles.chips}>
            {players.map((p) => (
              <TouchableOpacity key={p.name + p.groupNo} style={[styles.chip, sel && sel.name === p.name ? styles.chipOn : null]} onPress={() => { setSel(p); setEditHole(null); }}>
                <Text style={[styles.chipTxt, sel && sel.name === p.name ? styles.chipTxtOn : null]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sel ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{sel.name} · Group {sel.groupNo} · HCP {sel.handicap}</Text>
              <View style={styles.grid}>
                {holeNumbers.map((hn) => {
                  const v = scoreFor(sel.name, hn);
                  return (
                    <TouchableOpacity key={hn} style={[styles.cell, editHole === hn ? styles.cellOn : null]} onPress={() => setEditHole(hn)}>
                      <Text style={styles.cellHole}>{hn}</Text>
                      <Text style={styles.cellScore}>{v != null ? v : '–'}</Text>
                      <Text style={styles.cellPar}>par {parByNo[hn] || '-'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editHole != null ? (
                <View style={styles.keypad}>
                  <Text style={styles.keypadLabel}>Hole {editHole} — tap a score</Text>
                  <View style={styles.keys}>
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                      <TouchableOpacity key={n} style={styles.key} onPress={() => apply(n)}><Text style={styles.keyTxt}>{n}</Text></TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.key, styles.keyClear]} onPress={() => apply(null)}><Text style={styles.keyTxt}>Clear</Text></TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.section}>CONTESTS</Text>
          <Text style={styles.note}>Tap holes to add or remove. The highlighted ones were marked when the round was created.</Text>
          {contestRows.map(([label, list, set]) => (
            <View key={label} style={styles.card}>
              <Text style={styles.cardTitle}>{label}</Text>
              <View style={styles.cGrid}>
                {holeNumbers.map((hn) => {
                  const on = list.includes(hn);
                  return (
                    <TouchableOpacity key={hn} style={[styles.cHole, on ? styles.cHoleOn : null]} onPress={() => toggle(hn, list, set)}>
                      <Text style={[styles.cHoleTxt, on ? styles.cHoleTxtOn : null]}>{hn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.saveBtn} onPress={saveContest}><Text style={styles.saveTxt}>Save contests</Text></TouchableOpacity>
          <View style={{ height: 50 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gmCard: { backgroundColor: '#fff', borderRadius: radius.md, padding: 12, marginBottom: 14 },
  gmHeading: { color: '#143a22', fontWeight: '800', fontSize: 13, letterSpacing: 0.4, marginBottom: 8 },
  gmGroup: { marginBottom: 8 },
  gmGroupTitle: { color: colors.green, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  gmRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  gmName: { flex: 1, color: '#143a22', fontSize: 13, fontWeight: '600' },
  gmMove: { backgroundColor: '#e7f3ec', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 6 },
  gmMoveTxt: { color: colors.green, fontWeight: '700', fontSize: 12 },
  gmRemove: { paddingHorizontal: 6, paddingVertical: 4 },
  gmRemoveTxt: { color: '#c0392b', fontWeight: '800', fontSize: 14 },
  gmBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  gmAddBtn: { backgroundColor: '#e7f3ec', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  gmAddTxt: { color: colors.green, fontWeight: '700', fontSize: 12 },
  gmRoster: { marginTop: 8, backgroundColor: '#f4f7f5', borderRadius: 8, padding: 6 },
  gmRosterItem: { paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#e6ece8' },
  gmRosterTxt: { color: '#143a22', fontSize: 13 },
  gmSave: { backgroundColor: colors.green, borderRadius: 18, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  gmSaveTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pickHint: { color: '#5b6b62', fontSize: 12, marginBottom: 8 },
  grpBox: { borderWidth: 1, borderColor: '#e1e8e4', borderRadius: radius.md, marginBottom: 12, overflow: 'hidden' },
  grpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.green, paddingHorizontal: 12, paddingVertical: 8 },
  grpHeadTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  grpRemove: { color: '#fff', fontWeight: '700', fontSize: 13 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 10 },
  slotFilled: { width: '48%', minHeight: 64, borderRadius: 10, backgroundColor: '#eef6f1', borderWidth: 1, borderColor: '#cfe3d7', padding: 8, marginBottom: 10, justifyContent: 'center' },
  slotPicked: { borderColor: colors.green, borderWidth: 2, backgroundColor: '#dff0e6' },
  slotEmpty: { width: '48%', minHeight: 64, borderRadius: 10, borderWidth: 2, borderColor: '#c7cfca', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  slotDrop: { borderColor: colors.green, backgroundColor: '#f0f8f3' },
  slotName: { color: '#143a22', fontWeight: '700', fontSize: 13 },
  slotSub: { color: '#5b6b62', fontSize: 11, marginTop: 2 },
  slotAdd: { color: colors.green, fontWeight: '700', fontSize: 13 },
  slotX: { position: 'absolute', top: 4, right: 6, padding: 2 },
  slotXTxt: { color: '#c0392b', fontWeight: '800', fontSize: 13 },
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16 },
  back: { color: colors.green, fontWeight: '800', fontSize: 15, width: 60 },
  title: { color: colors.textOnDark, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16 },
  note: { color: colors.textOnDarkMuted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  section: { color: colors.green, fontWeight: '900', fontSize: 13, letterSpacing: 1, marginBottom: 8, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  chipOn: { backgroundColor: colors.green },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 13 },
  chipTxtOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginTop: 8, marginBottom: 8 },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 52, backgroundColor: colors.cardAlt, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  cellOn: { backgroundColor: colors.greenDark },
  cellHole: { color: colors.textMuted, fontSize: 10 },
  cellScore: { color: colors.text, fontSize: 18, fontWeight: '900' },
  cellPar: { color: colors.textMuted, fontSize: 9 },
  keypad: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10 },
  keypadLabel: { color: colors.textOnDarkMuted, fontSize: 12, marginBottom: 8 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: { width: 56, backgroundColor: colors.cardAlt, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  keyClear: { backgroundColor: '#7a2e2e', width: 80 },
  keyTxt: { color: colors.text, fontWeight: '800', fontSize: 15 },
  cGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cHole: { width: 46, height: 44, borderRadius: 8, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  cHoleOn: { backgroundColor: colors.green },
  cHoleTxt: { color: colors.text, fontWeight: '800', fontSize: 15 },
  cHoleTxtOn: { color: '#fff' },
  saveBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
