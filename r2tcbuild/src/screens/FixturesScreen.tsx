import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SEASON } from '../config';
import { fetchFixtures } from '../logic/sheets';
import { colors, radius } from '../theme';
import { Fixture } from '../types';

interface Props {
  onBack: () => void;
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

export default function FixturesScreen({ onBack }: Props) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchFixtures();
    setFixtures(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={hit}>
          <Text style={styles.back}>‹ Home</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{SEASON} FIXTURES</Text>
        <View style={{ width: 54 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>Loading fixtures…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textOnDark}
            />
          }
        >
          {fixtures.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emoji}>🗓️</Text>
              <Text style={styles.cardTitle}>No fixtures to show yet</Text>
              <Text style={styles.cardText}>
                Pull down to refresh. Fixtures are managed in the tour
                spreadsheet and update here automatically.
              </Text>
            </View>
          ) : (
            fixtures.map((f, i) => {
              const cancelled = /cancel/i.test(f.venue);
              const meta = [f.teeTime, f.format, f.cost]
                .filter(Boolean)
                .join('   ·   ');
              return (
                <View
                  key={`${f.round}-${i}`}
                  style={[styles.fx, cancelled ? styles.fxCancel : null]}
                >
                  <View style={styles.fxLeft}>
                    <Text style={styles.fxRound}>{f.round}</Text>
                    {f.date ? <Text style={styles.fxDate}>{f.date}</Text> : null}
                  </View>
                  <View style={styles.fxMain}>
                    <Text
                      style={[styles.fxVenue, cancelled ? styles.fxVenueCancel : null]}
                      numberOfLines={2}
                    >
                      {f.venue}
                    </Text>
                    {meta ? <Text style={styles.fxMeta}>{meta}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
          <Text style={styles.foot}>r2tctour.com</Text>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: {
    paddingTop: 58,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: colors.textOnDarkMuted, fontSize: 15, fontWeight: '700' },
  title: {
    color: colors.textOnDark,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textOnDarkMuted, marginTop: 10, fontSize: 14 },
  body: { padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 22,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 10 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  fx: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  fxCancel: { opacity: 0.6 },
  fxLeft: {
    width: 96,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  fxRound: { fontSize: 15, fontWeight: '900', color: colors.greenDark },
  fxDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fxMain: { flex: 1, paddingLeft: 14 },
  fxVenue: { fontSize: 15, fontWeight: '800', color: colors.text },
  fxVenueCancel: { textDecorationLine: 'line-through', color: colors.red },
  fxMeta: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  foot: {
    color: colors.textOnDarkMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
});
