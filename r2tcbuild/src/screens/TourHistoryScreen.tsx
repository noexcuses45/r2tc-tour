import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { fetchHistory } from '../logic/sheets';
import { colors, radius } from '../theme';

interface ChampEntry { year: string; champion: string; second: string; secondLabel: string; }
interface Award { label: string; winner: string; runnerUp: string; }
interface Trip { heading: string; awards: Award[]; }
type Section =
  | { kind: 'champions'; title: string; entries: ChampEntry[] }
  | { kind: 'trips'; title: string; trips: Trip[] };

const cell = (r: string[] | undefined, i: number) => ((r && r[i]) || '').trim();

const SECTION_TITLES: { [k: string]: string } = {
  'A GRADE CHAMPIONS': 'A Grade Champions',
  'B GRADE CHAMPIONS': 'B Grade Champions',
  'C GRADE CHAMPIONS': 'C Grade Champions',
  'LONGEST DRIVE CHAMPIONS': 'Longest Drive Champions',
  'CLOSEST TO THE PIN CHAMPIONS': 'Closest to the Pin Champions',
  'TOUR CHAMPIONS': 'Tour Champions',
  'MASTERS CHAMPIONS': 'Masters Champions',
  'PENNANT CHAMPIONS': 'Pennant Champions',
  'AWAY TRIP TOURNAMENT CHAMPIONS': 'Away Trip Tournaments',
  'ANNUAL SEASON 2 MAN AMBROSE': 'Annual 2 Man Ambrose',
};

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Tidy an ALL-CAPS award label,
// e.g. "$50 ALL IN 2 MAN AMBROSE CHAMPIONS" -> "$50 All In 2 Man Ambrose".
const tidyLabel = (raw: string) => {
  const s = raw.replace(/\bCHAMPIONS?\b/gi, '').replace(/\s+/g, ' ').trim();
  return s ? titleCase(s) : 'Champion';
};

function parseSections(rows: string[][]): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  let curTrip: Trip | null = null;
  let pendingLabel: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const a = cell(rows[i], 0);
    const b = cell(rows[i], 1);
    if (!a) continue;

    const upper = a.toUpperCase();

    if (SECTION_TITLES[upper]) {
      if (upper === 'AWAY TRIP TOURNAMENT CHAMPIONS') {
        cur = { kind: 'trips', title: SECTION_TITLES[upper], trips: [] };
      } else {
        cur = { kind: 'champions', title: SECTION_TITLES[upper], entries: [] };
      }
      sections.push(cur);
      curTrip = null;
      pendingLabel = null;
      continue;
    }

    if (cur && cur.kind === 'champions') {
      let yearLabel: string | null = null;
      const m = a.match(/^(\d{4})\s+CHAMPION$/i);
      if (m) {
        yearLabel = m[1];
      } else {
        const m2 = a.match(/^(\d{4})\s+(.*?)\s+CHAMPIONS?$/i);
        if (m2) yearLabel = m2[1] + (m2[2] ? ' ' + titleCase(m2[2].trim()) : '');
      }
      if (yearLabel) {
        const next = rows[i + 1] || [];
        const secondLabel = /runner/i.test(b) ? 'Runner-up' : (b || 'Runner-up');
        cur.entries.push({
          year: yearLabel,
          champion: cell(next, 0),
          second: cell(next, 1),
          secondLabel,
        });
        i++;
      }
      continue;
    }

    if (cur && cur.kind === 'trips') {
      const tripHeading = a.match(/^(\d{4})\b\s*(.*?)\s*CHAMPION$/i);
      if (tripHeading) {
        const venue = (tripHeading[2] || '').trim();
        curTrip = {
          heading: `${tripHeading[1]} ${venue ? titleCase(venue) : 'Tournament'}`,
          awards: [],
        };
        cur.trips.push(curTrip);
        pendingLabel = 'Champion';
      } else if (/CHAMPIONS?$/i.test(a)) {
        if (!curTrip) {
          curTrip = { heading: 'Tournament', awards: [] };
          cur.trips.push(curTrip);
        }
        pendingLabel = tidyLabel(a);
      } else if (curTrip && pendingLabel) {
        curTrip.awards.push({ label: pendingLabel, winner: a, runnerUp: b });
        pendingLabel = null;
      }
      continue;
    }
  }

  return sections;
}

export default function TourHistoryScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory().then((r) => { setRows(r); setLoading(false); });
  }, []);

  const sections = parseSections(rows);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>HISTORY</Text>
        <View style={{ width: 70 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {sections.length === 0 ? (
            <Text style={styles.empty}>History will appear here once it is added to the tour sheet.</Text>
          ) : (
            sections.map((sec) => (
              <View key={sec.title} style={styles.sectionWrap}>
                <Text style={styles.section}>🏆 {sec.title}</Text>
                {sec.kind === 'champions'
                  ? sec.entries.map((c) => (
                      <View key={sec.title + c.year} style={styles.card}>
                        <Text style={styles.year}>{c.year}</Text>
                        <View style={styles.line}>
                          <Text style={styles.label}>🏆 Champion</Text>
                          <Text style={styles.champ}>{c.champion || '—'}</Text>
                        </View>
                        {c.second ? (
                          <View style={styles.line}>
                            <Text style={styles.label}>{/runner/i.test(c.secondLabel) ? '🥈' : '📊'} {c.secondLabel}</Text>
                            <Text style={styles.runner}>{c.second}</Text>
                          </View>
                        ) : null}
                      </View>
                    ))
                  : sec.trips.map((t, ti) => (
                      <View key={sec.title + t.heading + ti} style={styles.card}>
                        <Text style={styles.year}>{t.heading}</Text>
                        {t.awards.map((aw, ai) => (
                          <View key={ai} style={[styles.awardRow, ai === 0 ? styles.awardRowFirst : null]}>
                            <Text style={styles.awardLabel}>{aw.label}</Text>
                            <Text style={styles.awardWinner}>{aw.winner || '—'}</Text>
                            {aw.runnerUp ? <Text style={styles.runnerSmall}>Runner-up: {aw.runnerUp}</Text> : null}
                          </View>
                        ))}
                      </View>
                    ))}
              </View>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16 },
  back: { color: colors.green, fontWeight: '800', fontSize: 15, width: 70 },
  title: { color: colors.textOnDark, fontWeight: '900', fontSize: 16, letterSpacing: 1, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16 },
  sectionWrap: { marginBottom: 18 },
  section: { color: '#E8C547', fontWeight: '900', fontSize: 15, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  empty: { color: colors.textOnDarkMuted, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  year: { color: '#E8C547', fontWeight: '900', fontSize: 20, marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  champ: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1, textAlign: 'right', marginLeft: 10 },
  runner: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 10 },
  awardRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 8 },
  awardRowFirst: { borderTopWidth: 0, paddingTop: 0, marginTop: 0 },
  awardLabel: { color: '#E8C547', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  awardWinner: { color: colors.text, fontSize: 15, fontWeight: '800' },
  runnerSmall: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
});
