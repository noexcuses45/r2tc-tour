import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PlayerCard from '../components/PlayerCard';
import {
  bestBallStandings,
  matchesForRound,
  matchState,
  skinsState,
} from '../logic/formats';
import {
  formatToPar,
  holeResults,
  leaderboard,
  playingHandicap,
} from '../logic/scoring';
import { colors, radius } from '../theme';
import { scrambleStandings } from '../logic/formats';
import { ContestResult, ContestType, GameFormat, Round } from '../types';

type Tab = GameFormat | 'contests';

const CONTEST_SECTIONS: [ContestType, string, string][] = [
  ['closestToPin', 'Closest to the Pin', '🎯'],
  ['longestDrive', 'Longest Drive', '🏌️'],
];

interface Props {
  round: Round;
}

function playingHcpOf(p: { handicap: number }, round: Round): number {
  return playingHandicap(p.handicap, round.holes.length);
}

function lbShapeFor(gross, par) { if (gross == null) return { kind: 'none' }; const d = gross - par; if (d <= -2) return { kind: 'circle', bg: '#F2A100' }; if (d === -1) return { kind: 'circle', bg: '#E23B3B' }; if (d === 0) return { kind: 'none' }; if (d === 1) return { kind: 'square', bg: '#5C9BD5' }; return { kind: 'square', bg: '#26467A' }; }
function NineSection({ results, holes, nums, tab, from, to, label }: any) {
  const idx: number[] = [];
  for (let i = from; i < to; i++) idx.push(i);
  const sumPar = idx.reduce((a, i) => a + (holes[i] ? holes[i].par : 0), 0);
  const sumGross = idx.reduce((a, i) => a + ((results[i] && results[i].gross) || 0), 0);
  const sumSecond = idx.reduce((a, i) => a + ((results[i] && (tab === 'stableford' ? results[i].stableford : results[i].net)) || 0), 0);
  return (
    <View style={styles.lbSec}>
      <View style={styles.lbRow}>
        <Text style={[styles.lbLab, styles.lbHead]}>Hole</Text>
        {idx.map((i) => (<Text key={i} style={[styles.lbCell, styles.lbHead]}>{nums[i]}</Text>))}
        <Text style={[styles.lbTot, styles.lbHead]}>{label}</Text>
      </View>
      <View style={styles.lbRow}>
        <Text style={styles.lbLab}>Par</Text>
        {idx.map((i) => (<Text key={i} style={[styles.lbCell, styles.lbMuted]}>{holes[i] ? holes[i].par : ''}</Text>))}
        <Text style={[styles.lbTot, styles.lbMuted]}>{sumPar}</Text>
      </View>
      <View style={styles.lbRow}>
        <Text style={styles.lbLab}>Score</Text>
        {idx.map((i) => { const g = results[i] ? results[i].gross : null; const sh = lbShapeFor(g, holes[i] ? holes[i].par : 0); if (sh.kind === 'none') return (<Text key={i} style={[styles.lbCell, styles.lbBold]}>{g == null ? '–' : g}</Text>); return (<View key={i} style={styles.lbCell}><View style={[styles.lbShape, sh.kind === 'circle' ? styles.lbCircle : styles.lbSquare, { backgroundColor: sh.bg }]}><Text style={styles.lbShapeTxt}>{g}</Text></View></View>); })}
        <Text style={[styles.lbTot, styles.lbBold]}>{sumGross || '–'}</Text>
      </View>
      <View style={styles.lbRow}>
        <Text style={styles.lbLab}>{tab === 'stableford' ? 'Pts' : 'Net'}</Text>
        {idx.map((i) => (<Text key={i} style={[styles.lbCell, styles.lbMuted]}>{results[i] ? (tab === 'stableford' ? results[i].stableford : results[i].net) : '–'}</Text>))}
        <Text style={[styles.lbTot, styles.lbMuted]}>{sumSecond || '–'}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen({ round }: Props) {
  const [tab, setTab] = useState<Tab>(round.primaryFormat);
  const [expanded, setExpanded] = useState<string | null>(null);

  const hasContests =
    (round.contests?.longestDrive.length ?? 0) +
      (round.contests?.closestToPin.length ?? 0) >
    0;

  const listFormat = tab === 'stableford' ? 'stableford' : 'stroke';
  const standings = leaderboard(round.players, round.holes, listFormat);

  const specialTab: [Tab, string] | null =
    round.primaryFormat === 'matchplay' ? ['matchplay', 'Matches']
    : round.primaryFormat === 'skins' ? ['skins', 'Skins']
    : round.primaryFormat === 'bestball' ? ['bestball', 'Best Ball']
    : (round.primaryFormat === 'scramble_stroke' || round.primaryFormat === 'tscramble_stroke') ? ['scramble_stroke', 'Scramble']
    : null;

  const tabs: [Tab, string][] = [
    ...(specialTab ? [specialTab] : []),
    ['stroke', specialTab ? 'Stroke' : 'Stroke Play NET'],
    ['stableford', 'Stableford'],
    ...(hasContests ? ([['contests', 'Contests']] as [Tab, string][]) : []),
  ];

  const entriesFor = (type: ContestType, holeNo: number): ContestResult[] =>
    (round.contestResults ?? [])
      .filter((r) => r.type === type && r.holeNumber === holeNo)
      .sort((a, b) => {
        if (a.metres === null) return 1;
        if (b.metres === null) return -1;
        return type === 'longestDrive'
          ? b.metres - a.metres
          : a.metres - b.metres;
      });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.roundName}>{round.name}</Text>
        <Text style={styles.courseName}>{round.courseName}</Text>
      </View>
      <View style={styles.tabs}>
        {tabs.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'stroke' || tab === 'stableford' ? (
        <View style={styles.colHeader}>
          <Text style={[styles.colText, { width: 30 }]}>#</Text>
          <Text style={[styles.colText, { flex: 1 }]}>NAME</Text>
          <Text style={[styles.colText, styles.colRight]}>
            {tab === 'stableford' ? 'PTS' : 'NET'}
          </Text>
          <Text style={[styles.colText, styles.colRight]}>
            {tab === 'stableford' ? '' : 'TO PAR'}
          </Text>
          <Text style={[styles.colText, styles.colRight]}>THRU</Text>
        </View>
      ) : null}
      {tab === 'matchplay' ? (
        <ScrollView>
          {matchesForRound(round).map(([a, b], mi) => {
            const m = matchState(a, b, round.holes);
            return (
              <View key={`${a.id}-${b.id}`} style={styles.matchCard}>
                <Text style={styles.matchNo}>MATCH {mi + 1}</Text>
                <View style={styles.matchNames}>
                  <Text
                    style={[
                      styles.matchName,
                      m.diff > 0 && styles.matchNameUp,
                    ]}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                  <Text style={styles.matchVs}>vs</Text>
                  <Text
                    style={[
                      styles.matchName,
                      styles.matchNameRight,
                      m.diff < 0 && styles.matchNameUp,
                    ]}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                </View>
                <Text style={styles.matchSummary}>{m.summary}</Text>
                {m.strokesGiven > 0 ? (
                  <Text style={styles.matchStrokes}>
                    {(playingHcpOf(a, round) > playingHcpOf(b, round)
                      ? a.name.split(' ')[0]
                      : b.name.split(' ')[0]) +
                      ` gets ${m.strokesGiven} stroke${m.strokesGiven > 1 ? 's' : ''}`}
                  </Text>
                ) : null}
                <View style={styles.matchStrip}>
                  {m.marks.map((mark, i) => (
                    <View
                      key={i}
                      style={[
                        styles.matchDot,
                        mark === 'a' && styles.matchDotA,
                        mark === 'b' && styles.matchDotB,
                        mark === 'half' && styles.matchDotHalf,
                      ]}
                    >
                      <Text style={styles.matchDotText}>
                        {round.holeNumbers[i]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          <Text style={styles.legend}>
            Green = left player won the hole · Red = right player · Grey =
            halved
          </Text>
          <View style={{ height: 30 }} />
        </ScrollView>
      ) : tab === 'skins' ? (
        (() => {
          const s = skinsState(round);
          return (
            <ScrollView>
              {s.nextHole !== null ? (
                <View style={styles.skinsBanner}>
                  <Text style={styles.skinsBannerText}>
                    Hole {s.nextHole} is worth {s.pot} skin
                    {s.pot > 1 ? 's' : ''}
                    {s.pot > 1 ? ' (carry-over!)' : ''}
                  </Text>
                </View>
              ) : null}
              {s.unclaimed > 0 ? (
                <View style={styles.skinsBanner}>
                  <Text style={styles.skinsBannerText}>
                    {s.unclaimed} skin{s.unclaimed > 1 ? 's' : ''} unclaimed
                    after a tie on the last hole
                  </Text>
                </View>
              ) : null}
              {s.rows.map((r, i) => (
                <View key={r.player.id} style={styles.cardWrap}>
                  <View style={styles.row}>
                    <Text style={[styles.rank, { width: 30 }]}>{i + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{r.player.name}</Text>
                      <Text style={styles.hcp}>
                        {r.holesWon.length > 0
                          ? `Won holes ${r.holesWon.join(', ')}`
                          : 'No skins yet'}
                      </Text>
                    </View>
                    <Text style={styles.skinsCount}>
                      {r.skins} {r.skins === 1 ? 'SKIN' : 'SKINS'}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 30 }} />
            </ScrollView>
          );
        })()
      ) : tab === 'bestball' ? (
        <ScrollView>
          {bestBallStandings(round).map((t, i) => (
            <View key={t.ids.join('-')} style={styles.cardWrap}>
              <View style={styles.row}>
                <Text style={[styles.rank, { width: 30 }]}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.hcp}>
                    {t.stableford} pts · 85% allowance
                  </Text>
                </View>
                <Text style={[styles.value, styles.colRight]}>
                  {t.thru > 0 ? t.net : '–'}
                </Text>
                <Text style={[styles.toPar, styles.colRight]}>
                  {t.thru > 0 ? formatToPar(t.netToPar) : ''}
                </Text>
                <Text style={[styles.thru, styles.colRight]}>{t.thru}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.legend}>
            Team score per hole = best net ball of the team.
          </Text>
          <View style={{ height: 30 }} />
        </ScrollView>
      ) : tab === 'scramble_stroke' ? (
  <ScrollView>
    {scrambleStandings(round, (round.formatSettings || {}).scrambleMethod).map((t, i) => (
      <View key={t.ids.join('-')} style={styles.cardWrap}>
        <View style={styles.row}>
          <Text style={[styles.rank, { width: 30 }]}>{i + 1}.</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t.name}</Text>
            <Text style={styles.hcp}>Team HCP {t.teamHcp} · {t.stableford} pts</Text>
          </View>
          <Text style={[styles.value, styles.colRight]}>{t.thru > 0 ? t.net : '–'}</Text>
          <Text style={[styles.toPar, styles.colRight]}>{t.thru > 0 ? formatToPar(t.netToPar) : ''}</Text>
          <Text style={[styles.thru, styles.colRight]}>{t.thru}</Text>
        </View>
      </View>
    ))}
    <Text style={styles.legend}>Team score per hole = the team ball, off the Ambrose team handicap (combined ÷ 4).</Text>
    <View style={{ height: 30 }} />
  </ScrollView>
) : tab === 'contests' ? (
        <ScrollView>
          {CONTEST_SECTIONS.map(([type, label, icon]) => {
            const holes = round.contests?.[type] ?? [];
            if (holes.length === 0) return null;
            return (
              <View key={type}>
                <View style={styles.contestHeader}>
                  <Text style={styles.contestHeaderIcon}>{icon}</Text>
                  <Text style={styles.contestHeaderText}>{label}</Text>
                </View>
                {holes.map((holeNo) => {
                  const entries = entriesFor(type, holeNo);
                  return (
                    <View key={holeNo} style={styles.contestHole}>
                      <Text style={styles.contestHoleTitle}>Hole {holeNo}</Text>
                      {entries.length === 0 ? (
                        <Text style={styles.contestEmpty}>
                          No results yet — record them on the scoring screen
                          after the hole is played.
                        </Text>
                      ) : (
                        entries.map((e, i) => (
                          <View
                            key={`${e.winner}-${i}`}
                            style={[
                              styles.contestRow,
                              i === 0 && styles.contestRowLeader,
                            ]}
                          >
                            <Text style={styles.contestRank}>{i + 1}.</Text>
                            <Text
                              style={[
                                styles.contestName,
                                i === 0 && styles.contestNameLeader,
                              ]}
                            >
                              {e.winner}
                            </Text>
                            <Text style={styles.contestMetres}>
                              {e.metres !== null ? `${e.metres} m` : '–'}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      ) : (
        <ScrollView>
          {standings.map((s, i) => {
            const isOpen = expanded === s.player.id;
            const results = holeResults(s.player, round.holes);
            return (
              <View key={s.player.id} style={styles.cardWrap}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setExpanded(isOpen ? null : s.player.id)}
                >
                  <Text style={[styles.rank, { width: 30 }]}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.player.name}</Text>
                    <Text style={styles.hcp}>
                      HCP {s.player.handicap} · PHCP {s.playingHcp}
                    </Text>
                  </View>
                  <Text style={[styles.value, styles.colRight]}>
                    {tab === 'stableford' ? s.stableford : s.thru > 0 ? s.net : '–'}
                  </Text>
                  <Text style={[styles.toPar, styles.colRight]}>
                    {tab === 'stableford'
                      ? ''
                      : s.thru > 0
                        ? formatToPar(s.netToPar)
                        : ''}
                  </Text>
                  <Text style={[styles.thru, styles.colRight]}>{s.thru}</Text>
                </TouchableOpacity>
                {isOpen ? (
                  <PlayerCard results={results} holes={round.holes} nums={round.holeNumbers} mode={tab === 'stableford' ? 'stableford' : 'stroke'} />
                ) : null}
              </View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lbWrap: { backgroundColor: '#ffffff', borderRadius: 10, padding: 8, marginTop: 6 },
  lbSec: { marginTop: 6 },
  lbRow: { flexDirection: 'row', alignItems: 'center' },
  lbLab: { width: 34, fontSize: 10, color: '#5b6b62', fontWeight: '700' },
  lbCell: { flex: 1, height: 24, textAlign: 'center', fontSize: 12, color: '#11261b', alignItems: 'center', justifyContent: 'center' },
  lbTot: { width: 28, textAlign: 'center', fontSize: 12, color: '#11261b', fontWeight: '700' },
  lbHead: { backgroundColor: '#13452e', color: '#ffffff', fontWeight: '700' },
  lbMuted: { color: '#5b6b62' },
  lbBold: { fontWeight: '800' },
  lbShape: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  lbCircle: { borderRadius: 10 },
  lbSquare: { borderRadius: 3 },
  lbShapeTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  screen: { flex: 1, backgroundColor: colors.cardAlt },
  header: {
    backgroundColor: colors.bgDark,
    paddingTop: 58,
    paddingBottom: 12,
    alignItems: 'center',
  },
  roundName: { color: colors.textOnDark, fontSize: 16, fontWeight: '900' },
  courseName: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bgDark,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.green },
  tabText: { color: colors.textOnDarkMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  colHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1B1E1C',
  },
  colText: { color: '#9AA59E', fontSize: 11, fontWeight: '800' },
  colRight: { width: 52, textAlign: 'right' },
  cardWrap: {
    backgroundColor: colors.card,
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
  },
  rank: { fontSize: 15, fontWeight: '800', color: colors.text },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  hcp: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  value: { fontSize: 16, fontWeight: '900', color: colors.text },
  toPar: { fontSize: 15, fontWeight: '900', color: colors.greenDark },
  thru: { fontSize: 14, color: colors.textMuted },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dRow: { flexDirection: 'row' },
  dCell: {
    width: 34,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 3,
  },
  dHead: { fontWeight: '800', color: colors.greenDark },
  dBold: { fontWeight: '800', color: colors.text },
  dUnder: { color: colors.green },
  dOver: { color: colors.red },
  contestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 10,
    marginTop: 12,
    borderRadius: radius.md,
    padding: 13,
  },
  contestHeaderIcon: { fontSize: 18, marginRight: 10 },
  contestHeaderText: { fontSize: 16, fontWeight: '900', color: colors.text },
  contestHole: { paddingHorizontal: 22, paddingTop: 12 },
  contestHoleTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  contestEmpty: { fontSize: 12, color: colors.textMuted, paddingVertical: 6 },
  contestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  contestRowLeader: { backgroundColor: 'rgba(43,168,74,0.15)' },
  contestRank: { width: 26, fontWeight: '800', color: colors.textMuted },
  contestName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  contestNameLeader: { fontWeight: '900' },
  contestMetres: { fontWeight: '800', color: colors.greenDark },
  // ----- Match Play -----
  matchCard: {
    backgroundColor: colors.card,
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: radius.md,
    padding: 13,
  },
  matchNo: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  matchNames: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  matchName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  matchNameRight: { textAlign: 'right' },
  matchNameUp: { color: colors.greenDark },
  matchVs: {
    width: 34,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  matchSummary: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.greenDark,
    textAlign: 'center',
    marginTop: 6,
  },
  matchStrokes: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  matchStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 10,
    justifyContent: 'center',
  },
  matchDot: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchDotA: { backgroundColor: colors.green },
  matchDotB: { backgroundColor: colors.red },
  matchDotHalf: { backgroundColor: '#8A938D' },
  matchDotText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  legend: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 20,
  },
  // ----- Skins -----
  skinsBanner: {
    backgroundColor: colors.gold,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  skinsBannerText: { fontWeight: '900', fontSize: 13, color: '#3A2E00' },
  skinsCount: { fontSize: 14, fontWeight: '900', color: colors.greenDark },
});
