import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { fetchLongestDriveRecords, LongestDriveRecord } from '../logic/sheets';
import { colors } from '../theme';

interface Props {
  onBack: () => void;
}

const GRADE_COLORS: Record<string, string> = { A: '#f5c542', B: '#7fb2ff', C: '#8affc1' };

export default function CourseRecordsScreen({ onBack }: Props) {
  const [rows, setRows] = useState<LongestDriveRecord[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    fetchLongestDriveRecords()
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const list = rows || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.course.toLowerCase().includes(s) ||
        r.year.includes(s) ||
        r.grade.toLowerCase() === s,
    );
  }, [rows, q]);

  const top = rows && rows.length ? rows[0] : null;

  const renderItem = ({ item, index }: { item: LongestDriveRecord; index: number }) => {
    const rank = index + 1;
    const medal = rank === 1 ? '#f5c542' : rank === 2 ? '#cfd8dc' : rank === 3 ? '#d9a066' : null;
    const meta = [item.course, item.hole, item.year].filter(Boolean).join('   -   ');
    return (
      <View style={styles.row}>
        <View style={[styles.rankWrap, medal ? { backgroundColor: medal } : null]}>
          <Text style={[styles.rankNum, medal ? { color: '#0b3d25' } : null]}>{rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        </View>
        {item.grade ? (
          <View style={[styles.grade, { borderColor: GRADE_COLORS[item.grade] || '#9fb4a8' }]}>
            <Text style={[styles.gradeTxt, { color: GRADE_COLORS[item.grade] || '#9fb4a8' }]}>{item.grade}</Text>
          </View>
        ) : null}
        <View style={styles.distWrap}>
          <Text style={styles.dist}>{item.distance}</Text>
          <Text style={styles.distUnit}>m</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.back}>{'‹ Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>COURSE RECORDS</Text>
        <View style={{ width: 56 }} />
      </View>

      {rows === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => String(item.rank) + '-' + i}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <Text style={styles.section}>LONGEST DRIVE RECORDS</Text>
              {top ? (
                <View style={styles.hero}>
                  <Text style={styles.heroLabel}>ALL-TIME LONGEST DRIVE</Text>
                  <Text style={styles.heroDist}>
                    {top.distance}
                    <Text style={styles.heroUnit}> m</Text>
                  </Text>
                  <Text style={styles.heroName} numberOfLines={1}>{top.name}</Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {[top.course, top.hole, top.year].filter(Boolean).join('   -   ')}
                  </Text>
                </View>
              ) : null}
              <TextInput
                style={styles.search}
                placeholder="Search name, course or year..."
                placeholderTextColor="#6f8a7d"
                value={q}
                onChangeText={setQ}
                autoCapitalize="none"
              />
              <Text style={styles.count}>
                {filtered.length} record{filtered.length === 1 ? '' : 's'}
              </Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No records found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a2a1c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 },
  back: { color: '#fff', fontSize: 16, fontWeight: '700', width: 56 },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { color: '#9fb4a8', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 4, marginBottom: 10 },
  hero: { backgroundColor: '#0e3b28', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, alignItems: 'center' },
  heroLabel: { color: '#f5c542', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroDist: { color: '#fff', fontSize: 44, fontWeight: '900', marginTop: 2 },
  heroUnit: { fontSize: 18, fontWeight: '700', color: '#9fb4a8' },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  heroMeta: { color: '#9fb4a8', fontSize: 12, fontWeight: '600', marginTop: 3 },
  search: { backgroundColor: '#0e3b28', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 15 },
  count: { color: '#6f8a7d', fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 6, marginLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0e3b28', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  rankWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#12523a', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankNum: { color: '#cfe6d8', fontSize: 13, fontWeight: '800' },
  name: { color: '#fff', fontSize: 15, fontWeight: '800' },
  meta: { color: '#9fb4a8', fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  grade: { borderWidth: 1.5, borderRadius: 8, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  gradeTxt: { fontSize: 11, fontWeight: '900' },
  distWrap: { flexDirection: 'row', alignItems: 'baseline' },
  dist: { color: '#fff', fontSize: 20, fontWeight: '900' },
  distUnit: { color: '#9fb4a8', fontSize: 11, fontWeight: '700', marginLeft: 1 },
  empty: { color: '#9fb4a8', textAlign: 'center', marginTop: 30 },
});
