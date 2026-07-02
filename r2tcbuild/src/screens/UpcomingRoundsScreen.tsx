import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { listOpenEvents, LiveEvent, deleteLiveEvent } from '../logic/liveEvents';
import { colors, radius } from '../theme';

export default function UpcomingRoundsScreen({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
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
            return (
              <View key={ev.id} style={styles.card}>
                <Text style={styles.date}>{d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                <Text style={styles.name}>{ev.name}</Text>
                {ev.course_name ? <Text style={styles.sub}>{ev.course_name}</Text> : null}
                <Text style={styles.sub}>{(cfg.format ? String(cfg.format) : 'game').toUpperCase()} · {count} players</Text>
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
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, marginBottom: 12 },
  date: { color: colors.green, fontWeight: '800', fontSize: 13, marginBottom: 4 },
  delBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#fdecec', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  delTxt: { color: '#c0392b', fontWeight: '800', fontSize: 13 },
  name: { color: '#143a22', fontWeight: '800', fontSize: 17 },
  sub: { color: '#5b6b62', fontSize: 13, marginTop: 2 },
});
