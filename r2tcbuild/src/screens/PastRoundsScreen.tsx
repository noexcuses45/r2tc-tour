import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../theme';
import { Round } from '../types';

export default function PastRoundsScreen({ rounds, onView, onBack, isAdmin, onDelete }: { rounds: Round[]; onView: (r: Round) => void; onBack: () => void; isAdmin?: boolean; onDelete?: (r: Round) => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>PAST ROUNDS</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {rounds.length === 0 ? (
          <Text style={styles.empty}>No past rounds yet. Finish a round and it will show here.</Text>
        ) : (
          rounds.map((r) => (
            <TouchableOpacity key={r.id} style={styles.row} onPress={() => onView(r)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.detail}>{r.courseName} · {new Date(r.date).toLocaleDateString()}</Text>
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
