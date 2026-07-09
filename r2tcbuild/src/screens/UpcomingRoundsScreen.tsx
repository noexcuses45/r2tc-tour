import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { listOpenEvents, LiveEvent, deleteLiveEvent, fetchEventRsvps, setMyRsvp, myEmail, EventRsvp } from '../logic/liveEvents';
import { getProfile } from '../logic/supabase';
import { colors, radius } from '../theme';

export default function UpcomingRoundsScreen({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvps, setRsvps] = useState<Record<string, EventRsvp[]>>({});
  const [meEmail, setMeEmail] = useState('');
  const [meName, setMeName] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  useEffect(() => { let alive = true; (async () => { const em = await myEmail(); if (alive) setMeEmail(em); try { const pr: any = await getProfile(); if (alive && pr && pr.name) setMeName(pr.name); } catch (e) {} })(); return () => { alive = false; }; }, []);
  useEffect(() => { let alive = true; (async () => { const map: Record<string, EventRsvp[]> = {}; await Promise.all((events || []).map(async (ev: any) => { map[ev.id] = await fetchEventRsvps(ev.id); })); if (alive) setRsvps(map); })(); return () => { alive = false; }; }, [events]);
  useEffect(() => {
    let on = true;
    listOpenEvents().then((evs) => {
      if (!on) return;
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const future = (evs || []).filter((ev) => { const d = ev.config && ev.config.date; return d && new Date(d).getTime() > end.getTime(); });
      future.sort((a, b) => String(a.config.date).localeCompare(String(b.config.date)));
      setEvents(future); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>UPCOMING ROUNDS</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
        ) : events.length === 0 ? (
          <Text style={styles.empty}>No upcoming rounds scheduled. A round shows here until the day it is played, then moves to the home screen.</Text>
        ) : (
          events.map((ev) => {
            const cfg = ev.config || {};
            const count = (cfg.groups || []).reduce((a, g) => a + (g ? g.length : 0), 0);
            const d = new Date(cfg.date);
        const evR = rsvps[ev.id] || [];
        const myIdx = evR.findIndex((r) => (r.player_email || '').toLowerCase() === meEmail);
        const iAmPlaying = myIdx >= 0;
        const myGroup = myIdx >= 0 ? Math.floor(myIdx / 4) + 1 : 0;
        const evStart = isNaN(d.getTime()) ? 0 : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const today0 = new Date(); today0.setHours(0, 0, 0, 0);
        const revealed = evStart > 0 && today0.getTime() >= evStart;
            return (
              <View key={ev.id} style={styles.card}>
                <Text style={styles.date}>{d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                <Text style={styles.name}>{ev.name}</Text>
                {ev.course_name ? <Text style={styles.sub}>{ev.course_name}</Text> : null}
                <Text style={styles.sub}>{(cfg.format ? String(cfg.format) : 'game').toUpperCase()} · {evR.length} playing</Text>
              <TouchableOpacity style={[styles.playBtn, iAmPlaying ? styles.playBtnOn : null]} disabled={!!busy[ev.id]} onPress={async () => { setBusy((b) => ({ ...b, [ev.id]: true })); const ok = await setMyRsvp(ev.id, meName, !iAmPlaying); if (ok) { const fresh = await fetchEventRsvps(ev.id); setRsvps((m) => ({ ...m, [ev.id]: fresh })); } else { Alert.alert('Could not update', 'Please try again.'); } setBusy((b) => ({ ...b, [ev.id]: false })); }}>
                <Text style={[styles.playTxt, iAmPlaying ? styles.playTxtOn : null]}>{busy[ev.id] ? '...' : iAmPlaying ? 'Not playing' : 'Playing'}</Text>
              </TouchableOpacity>
              <Text style={styles.playNote}>{iAmPlaying ? 'Click here to unplay' : 'Click here to play'}</Text>
              {iAmPlaying ? <Text style={styles.groupNote}>{revealed ? ("You're in Group " + myGroup) : "You're in - group revealed on the day"}</Text> : null}
                <TouchableOpacity style={styles.delBtn} onPress={() => Alert.alert('Delete round', 'Delete "' + ev.name + '"?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteLiveEvent(ev.id).then((res) => { if (res && res.ok && res.deleted > 0) setEvents((prev) => prev.filter((e) => e.id !== ev.id)); else Alert.alert('Could not delete', (res && res.error) || 'Please try again.'); }); } }])}>
                  <Text style={styles.delTxt}>Delete round</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 48, paddingBottom: 14 },
  back: { color: colors.green, fontWeight: '700', fontSize: 15 },
  title: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  body: { padding: 14, paddingBottom: 60 },
  empty: { color: '#9fb0a6', fontSize: 14, textAlign: 'center', marginTop: 30, lineHeight: 20 },
  playBtn: { alignSelf: 'flex-start', backgroundColor: '#1c6b45', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 20, marginTop: 12 },
  playBtnOn: { backgroundColor: '#eef4f0', borderWidth: 1, borderColor: '#c9d6cd' },
  playTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  playTxtOn: { color: '#3a5c49' },
  playNote: { color: '#5f7d6e', fontSize: 11, fontWeight: '600', marginTop: 4 },
  groupNote: { color: '#1c6b45', fontSize: 12, fontWeight: '800', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, marginBottom: 12 },
  date: { color: colors.green, fontWeight: '800', fontSize: 13, marginBottom: 4 },
  delBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fdecec', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  delTxt: { color: '#c0392b', fontWeight: '800', fontSize: 13 },
  name: { color: '#143a22', fontWeight: '800', fontSize: 17 },
  sub: { color: '#5b6b62', fontSize: 13, marginTop: 2 },
});
