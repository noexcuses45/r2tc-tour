import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../theme';
import { Round } from '../types';

export default function PastRoundsScreen({ rounds, onView, onBack, isAdmin, onDelete }: { rounds: Round[]; onView: (r: Round) => void; onBack: () => void; isAdmin?: boolean; onDelete?: (r: Round) => void }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const filtered = query
    ? rounds.filter((r: any) => (((r.name || '') + ' ' + (r.courseName || '') + ' ' + (r.date || '')).toLowerCase().indexOf(query) !== -1))
    : rounds;
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>PAST ROUNDS</Text>
        <View style={{ width: 56 }} />
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder='Search rounds...' placeholderTextColor={colors.textMuted} autoCorrect={false} style={styles.search} />
      <ScrollView contentContainerStyle={styles.body}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{query ? 'No rounds match your search.' : 'No past rounds yet. Finish a round and it will show here.'}</Text>
        ) : (
          [...filtered].sort((a, b) => (String(a.date || '') < String(b.date || '') ? 1 : String(a.date || '') > String(b.date || '') ? -1 : 0)).map((r) => (
            <TouchableOpacity key={r.id} style={styles.row} onPress={() => onView(r)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.detail}>{r.courseName} · {(() => { const _p = String(r.date || '').slice(0, 10).split('-'); return _p.length === 3 ? Number(_p[2]) + '/' + Number(_p[1]) + '/' + _p[0] : String(r.date || ''); })()}</Text>
              </View>
              {isAdmin && onDelete ? (<TouchableOpacity onPress={() => onDelete(r)} hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }} style={{ paddingHorizontal: 6 }}><Text style={{ fontSize: 20 }}>🗑️</Text></TouchableOpacity>) : null}
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  search: { backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginBottom: 8, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16 },
  back: { color: colors.green, fontWeight: '800', fontSize: 15, width: 70 },
  title: { color: colors.textOnDark, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  body: { paddingHorizontal: 16 },
  empty: { color: colors.textOnDarkMuted, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 8 },
  name: { color: colors.text, fontWeight: '800', fontSize: 15 },
  detail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chev: { color: colors.textMuted, fontSize: 22, marginLeft: 8 },
});
