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

/**
 * Course records hub. The tour sheet's 'Course Records' tab drives it:
 * Category | Course | Record | Player | Year. Each distinct category
 * becomes a button; tapping it shows that category's records.
 */
export default function CourseRecordsScreen({ onBack }: Props) {
  const [rows, setRows] = useState<CourseRecordRow[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCourseRecords()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  const categories: string[] = [];
  for (const r of rows || []) {
    if (categories.indexOf(r.category) < 0) categories.push(r.category);
  }
  const inCategory = category ? (rows || []).filter((r) => r.category === category) : [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (category ? setCategory(null) : onBack())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {category ? category.toUpperCase() : 'COURSE RECORDS'}
        </Text>
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
      ) : category === null ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.lead}>Pick a record book</Text>
          {categories.map((c) => {
            const n = (rows || []).filter((r) => r.category === c).length;
            return (
              <TouchableOpacity key={c} style={styles.catBtn} onPress={() => setCategory(c)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{c}</Text>
                  <Text style={styles.catSub}>{n} record{n === 1 ? '' : 's'}</Text>
                </View>
                <Text style={styles.catArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {inCategory.map((r, i) => (
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
  lead: { color: colors.textOnDarkMuted, fontSize: 13, fontWeight: '700', marginBottom: 12, marginLeft: 2 },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F3B2A',
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.greenDark,
  },
  catName: { color: '#fff', fontSize: 17, fontWeight: '900' },
  catSub: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  catArrow: { color: colors.gold, fontSize: 26, fontWeight: '800', marginLeft: 10 },
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
