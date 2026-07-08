import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchPlayerByName, Profile } from '../logic/supabase';
import {
  fetchTourLeaderboards,
  fetchHandicapForGolfId,
  fetchHandicapByName,
  fetchScoresForGolfId,
  fetchApiSlope,
  dailyHandicap,
  cleanLeaderName,
  PastScore,
} from '../logic/sheets';
import { fetchPlayerHistory, fetchPlayerContestRecords } from '../logic/liveEvents';
import { colors, radius } from '../theme';

export default function PlayerProfileModal({ name, onClose, onOpenRound }: { name: string; onClose: () => void; onOpenRound?: (eventId: string) => void }) {
  const [prof, setProf] = useState<Profile | null>(null);
  const [points, setPoints] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [officialHcp, setOfficialHcp] = useState<number | null>(null);
  const [dailyHcp, setDailyHcp] = useState<number | null>(null);
  const [dailyCourse, setDailyCourse] = useState<string>('');
  const [scores, setScores] = useState<PastScore[]>([]);
  const [bests, setBests] = useState<any>({ ld: null, ctp: null });

  useEffect(() => {
    let active = true;
    Promise.all([fetchPlayerByName(name), fetchTourLeaderboards()]).then(([p, boards]: any) => {
      if (!active) return;
      setProf(p);
      (async () => {
        {
          let h: number | null = null;
          if (p && (p as any).golf_id) { h = await fetchHandicapForGolfId((p as any).golf_id); }
          if (h === null || h === undefined) { h = await fetchHandicapByName(name); }
          if (active) setOfficialHcp(typeof h === 'number' ? h : null);
        }
        const hist = await fetchPlayerHistory(name);
        if (active) setScores(hist);
        const cb = await fetchPlayerContestRecords(name);
        if (active) setBests(cb);
      })();
      const row = ((boards && boards.tourPoints) || []).find(
        (rw: any) => cleanLeaderName(rw.name) === cleanLeaderName(name),
      );
      setPoints(row ? row.value : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [name]);

  const initials = name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
  const totalsArr = (scores || []).map((s) => s.score).filter((v) => typeof v === 'number');
  const roundsCount = totalsArr.length;
  const strokeArr = (scores || []).filter((s: any) => (s.holeCount == null || s.holeCount === 18) && !s.excluded && !s.incomplete && (s.format == null || s.format === 'stroke' || s.format === 'stableford')).map((s: any) => s.score).filter((v: any) => typeof v === 'number');
  const avg = strokeArr.length ? (strokeArr.reduce((a: number, b: number) => a + b, 0) / strokeArr.length).toFixed(1) : null;
  const best = strokeArr.length ? Math.min.apply(null, strokeArr) : null;
  const stbArr = (scores || []).map((s: any) => s.stableford).filter((v: any) => typeof v === 'number');
  const bestStb = stbArr.length ? Math.max.apply(null, stbArr) : null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handleBar} />
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              <View style={styles.avatarWrap}>
                {prof && prof.avatar_url ? (
                  <Image source={{ uri: prof.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPh]}><Text style={styles.avatarTxt}>{initials}</Text></View>
                )}
              </View>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.meta}>📍 R2TC Tour Member</Text>
              <Text style={styles.bio}>{prof && prof.bio ? prof.bio : 'No bio yet.'}</Text>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{officialHcp != null ? officialHcp : (prof && typeof prof.handicap === 'number' ? prof.handicap : '—')}</Text>
                  <Text style={styles.statLbl}>Handicap</Text>
                </View>
                
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{avg != null ? avg : '—'}</Text>
                  <Text style={styles.statLbl}>Scoring Avg</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{best != null ? best : '—'}</Text>
                  <Text style={styles.statLbl}>Best Stroke</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{bestStb !== null ? bestStb : '\u2014'}</Text>
                  <Text style={styles.statLbl}>Best Stableford</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{roundsCount || '—'}</Text>
                  <Text style={styles.statLbl}>Rounds</Text>
                </View>
              </View>
              
              <View style={styles.tpRow}><Text style={styles.tpVal}>{points || '—'}</Text><Text style={styles.tpLbl}>Tour Points</Text></View>
              
              {scores && scores.length ? (
                <View style={styles.scoresBox}>
                  {bests.ld || bests.ctp ? (
                  <View style={{ width: '100%', marginBottom: 10 }}>
                    {bests.ld ? (
                      <TouchableOpacity onPress={() => { if (onOpenRound && bests.ld.eventId) { onClose(); onOpenRound(bests.ld.eventId); } }} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 }}>
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>Longest Drive  {bests.ld.metres}m</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{bests.ld.event || ''}{onOpenRound ? '   (view round)' : ''}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {bests.ctp ? (
                      <TouchableOpacity onPress={() => { if (onOpenRound && bests.ctp.eventId) { onClose(); onOpenRound(bests.ctp.eventId); } }} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 }}>
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>Closest to Pin  {bests.ctp.metres}m</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{bests.ctp.event || ''}{onOpenRound ? '   (view round)' : ''}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.scoresTitle}>R2TC Tournament Scores</Text>
                  {scores.slice(0, 8).map((s, i) => (
                    <View key={i} style={styles.scoreRow}>
                      <Text style={styles.scoreDate}>{s.date}</Text>
                      <Text style={styles.scoreCourse} numberOfLines={1}>{s.course}</Text>
                      <Text style={styles.scoreVal}>{s.score != null ? s.score : '—'}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {!prof ? (
                <Text style={styles.note}>This player hasn't set up an app profile yet.</Text>
              ) : null}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeTxt}>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dailyNote: { color: colors.textMuted, fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  scoresBox: { width: '100%', marginTop: 16 },
  scoresTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  scoreDate: { color: colors.textMuted, fontSize: 12, width: 88 },
  scoreCourse: { color: colors.text, fontSize: 13, flex: 1, paddingHorizontal: 8 },
  scoreVal: { color: colors.green, fontWeight: '700', fontSize: 14, width: 44, textAlign: 'right' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bgDark, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, maxHeight: '85%' },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#555', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  center: { padding: 40, alignItems: 'center' },
  body: { padding: 20, alignItems: 'center' },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPh: { backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 32, fontWeight: '900' },
  name: { color: colors.textOnDark, fontSize: 22, fontWeight: '900' },
  meta: { color: colors.textOnDarkMuted, fontSize: 13, marginTop: 4 },
  bio: { color: colors.textOnDarkMuted, fontSize: 14, textAlign: 'center', marginTop: 14, lineHeight: 20 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 20 },
  stat: { alignItems: 'center' },
  statVal: { color: '#E8C547', fontSize: 22, fontWeight: '900' },
  statLbl: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  tpRow: { alignItems: 'center', marginTop: 16 },
  tpVal: { color: '#E8C547', fontSize: 20, fontWeight: '900' },
  tpLbl: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  achBox: { width: '100%', marginTop: 16, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  achTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  achBody: { color: colors.textMuted, fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 12, marginTop: 18, textAlign: 'center' },
  closeBtn: { marginHorizontal: 20, marginTop: 8, backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  closeTxt: { color: colors.text, fontWeight: '800', fontSize: 15 },
});
