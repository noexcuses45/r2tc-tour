import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CourseRecordRow, fetchCourseRecords } from '../logic/sheets';
import { colors, radius } from '../theme';

interface Props {
  onBack: () => void;
}

/** Course records straight from the tour sheet ('Course Records' tab). */
export default function CourseRecordsScreen({ onBack }: Props) {
  const [rows, setRows] = useState<CourseRecordRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCourseRecords()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>COURSE RECORDS</Text>
        <View style={{ width: 60 }} />
      </View>
      {rows === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} size="large" />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Course records will appear here once they are added to the tour sheet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {rows.map((r, i) => (
            <View key={r.course + i} style={styles.card}>
              <Text style={styles.course}>{r.course}</Text>
              <View style={styles.recordRow}>
                <Text style={styles.record}>{r.record}</Text>
                <View style={styles.holder}>
                  {r.player ? <Text style={styles.player}>{r.player}</Text> : null}
                  {r.year ? <Text style={styles.year}>{r.year}</Text> : null}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDarker },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.bgDark,
  },
  back: { color: '#fff', fontSize: 16, fontWeight: '700', width: 60 },
  title: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
    flex: 1,
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  empty: { color: colors.textOnDarkMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#0F3B2A',
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.greenDark,
  },
  course: { color: '#fff', fontSize: 17, fontWeight: '900' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  record: { color: colors.gold, fontSize: 26, fontWeight: '900' },
  holder: { alignItems: 'flex-end' },
  player: { color: colors.textOnDark, fontSize: 14, fontWeight: '800' },
  year: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 1 },
});
