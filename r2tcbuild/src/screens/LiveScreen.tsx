import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import {
  listOpenEvents, fetchLiveScores, buildStandings, finishLiveEvent,
  buildRoundFromEvent, LiveEvent, LiveStanding,
} from '../logic/liveEvents';
import { getSession, Session } from '../logic/supabase';
import { ADMIN_EMAILS } from '../config';
import { colors, radius } from '../theme';
import { Round } from '../types';

interface Props {
  onBack: () => void;
  onScoreGroup: (round: Round) => void;
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

export default function LiveScreen({ onBack, onScoreGroup }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [watch, setWatch] = useState<LiveEvent | null>(null);
  const [pick, setPick] = useState<LiveEvent | null>(null);
  const [standings, setStandings] = useState<LiveStanding[]>([]);
  const timer = useRef<any>(null);

  const isAdmin =
    !!session &&
    ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((session.email || '').toLowerCase());

  const load = useCallback(async () => {
    const list = await listOpenEvents();
    setEvents(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      setSession(s);
      setCheckedAuth(true);
      if (s) load();
      else setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!watch) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    let active = true;
    const pull = async () => {
      const rows = await fetchLiveScores(watch.id);
      if (active) setStandings(buildStandings(rows, watch.config));
    };
    pull();
    timer.current = setInterval(pull, 8000);
    return () => { active = false; if (timer.current) clearInterval(timer.current); };
  }, [watch]);

  const Header = ({ title, back }: { title: string; back: () => void }) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={back} hitSlop={hit}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={{ width: 54 }} />
    </View>
  );

  if (checkedAuth && !session) {
    return (
      <View style={styles.screen}>
        <Header title="LIVE" back={onBack} />
        <View style={styles.center}>
          <Text style={styles.emoji}>📡</Text>
          <Text style={styles.msg}>Sign in on the home screen to use live tournaments.</Text>
        </View>
      </View>
    );
  }

  if (watch) {
    const fmt = (s: LiveStanding) => (s.toPar === 0 ? 'E' : s.toPar > 0 ? '+' + s.toPar : '' + s.toPar);
    return (
      <View style={styles.screen}>
        <Header title={watch.name} back={() => setWatch(null)} />
        <View style={styles.liveBar}>
          <Text style={styles.liveDot}>● LIVE</Text>
          <Text style={styles.liveSub}>Auto-updating</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {standings.length === 0 ? (
            <Text style={styles.msg}>No scores yet — standings appear as players enter scores.</Text>
          ) : (
            standings.map((s, i) => (
              <View key={s.name + i} style={styles.row}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{s.name}</Text>
                  <Text style={styles.rowDetail}>Group {s.groupNo} · Thru {s.thru}</Text>
                </View>
                <Text style={styles.rowValue}>{fmt(s)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  if (pick) {
    const groups = (pick.config && pick.config.groups) || [];
    return (
      <View style={styles.screen}>
        <Header title="Pick your group" back={() => setPick(null)} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.msg}>Choose the group you're playing in — you can only score your own group.</Text>
          {groups.length === 0 ? (
            <Text style={styles.msg}>This event has no groups set up.</Text>
          ) : (
            groups.map((g: any[], gi: number) => (
              <TouchableOpacity key={gi} style={styles.eventCard} onPress={() => onScoreGroup(buildRoundFromEvent(pick, gi))}>
                <Text style={styles.eventName}>Group {gi + 1}</Text>
                <Text style={styles.rowDetail}>{g.map((p) => p.name).join(', ')}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="LIVE TOURNAMENTS" back={onBack} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.textOnDark} />}
        >
          <Text style={styles.hint}>
            Watch any event live, or tap one to score your group. To run a new
            event, just use "Start a round" on the home screen.
          </Text>

          <Text style={styles.section}>OPEN EVENTS</Text>
          {events.length === 0 ? (
            <Text style={styles.msg}>No live events right now.</Text>
          ) : (
            events.map((ev) => (
              <View key={ev.id} style={styles.eventCard}>
                <Text style={styles.eventName}>{ev.name}</Text>
                {ev.course_name ? <Text style={styles.rowDetail}>{ev.course_name}</Text> : null}
                <View style={styles.eventBtns}>
                  <TouchableOpacity style={[styles.smallBtn, styles.ghost]} onPress={() => setWatch(ev)}>
                    <Text style={styles.ghostText}>Watch leaderboard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => setPick(ev)}>
                    <Text style={styles.smallText}>Score my group</Text>
                  </TouchableOpacity>
                </View>
                {isAdmin ? (
                  <TouchableOpacity onPress={() => { finishLiveEvent(ev.id).then(load); }}>
                    <Text style={styles.finishText}>Finish event</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { paddingTop: 58, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: colors.textOnDarkMuted, fontSize: 15, fontWeight: '700' },
  title: { color: colors.textOnDark, fontSize: 15, fontWeight: '900', letterSpacing: 1, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 40, marginBottom: 10 },
  msg: { color: colors.textOnDarkMuted, textAlign: 'center', fontSize: 14, lineHeight: 20, padding: 12 },
  hint: { color: colors.textOnDarkMuted, fontSize: 13, lineHeight: 19, marginBottom: 14, paddingHorizontal: 4 },
  body: { padding: 16 },
  section: { color: colors.textOnDarkMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  eventCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  eventName: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  eventBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallBtn: { flex: 1, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  smallText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ghost: { backgroundColor: colors.cardAlt },
  ghostText: { color: colors.greenDark, fontWeight: '800', fontSize: 13 },
  finishText: { color: colors.red, fontWeight: '700', fontSize: 12, marginTop: 10, textAlign: 'center' },
  liveBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 8 },
  liveDot: { color: '#FF4D4D', fontWeight: '900', fontSize: 13 },
  liveSub: { color: colors.textOnDarkMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  rank: { width: 28, fontSize: 16, fontWeight: '900', color: colors.greenDark },
  rowMain: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowDetail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowValue: { fontSize: 16, fontWeight: '900', color: colors.text },
});
