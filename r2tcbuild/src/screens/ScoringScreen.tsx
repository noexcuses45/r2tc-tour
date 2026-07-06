import React, { useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { scoreLabel, strokesReceived, playingHandicap, ambroseTeamHcp } from '../logic/scoring';
import { getEvent, pushContestResult, removeContestResult } from '../logic/liveEvents';
import { colors, radius } from '../theme';
import { teamsForRound } from '../logic/formats';
import { ContestResult, ContestType, Round, RoundPlayer } from '../types';

const CONTEST_LABELS: Record<ContestType, string> = {
  longestDrive: 'Longest Drive',
  closestToPin: 'Closest to the Pin',
};

interface Props {
  round: Round;
  onUpdate: (round: Round) => void;
}

export default function ScoringScreen({ round, onUpdate }: Props) {
  const [holeIdx, setHoleIdx] = useState(() => {
    const idx = round.holes.findIndex((_, i) =>
      round.players.some((p) => p.scores[i] === null),
    );
    return idx === -1 ? 0 : idx;
  });
  const [activePlayer, setActivePlayer] = useState(0);
  const [editingContest, setEditingContest] = useState<ContestType | null>(null);
  const [evContests, setEvContests] = useState<any>(null);

  useEffect(() => {
    if (!round.liveEventId) return;
    getEvent(round.liveEventId).then((ev) => {
      if (ev && ev.config && ev.config.contests) setEvContests(ev.config.contests);
    });
    (round.contestResults || []).forEach((cr) => {
      pushContestResult(round.liveEventId as string, cr.type, cr.holeNumber, cr.winner, cr.metres);
    });
  }, [round.liveEventId]);
  const [winnerName, setWinnerName] = useState('');
  const [metresText, setMetresText] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('11');

  const hole = round.holes[holeIdx];
  const holeNo = round.holeNumbers[holeIdx];
  const n = round.holes.length;

  const isScramble =
    round.primaryFormat === 'scramble_stroke' ||
    round.primaryFormat === 'tscramble_stroke' ||
    round.primaryFormat === 'scramble_match' ||
    round.primaryFormat === 'foursome_match' ||
    round.primaryFormat === 'greensome_match';
  const units: { key: string; label: string; handicaps: number[]; memberIds: string[] }[] =
    isScramble
      ? (() => {
          const byKey = new Map<string, RoundPlayer>();
          round.players.forEach((p) => { byKey.set(p.id, p); byKey.set(p.name, p); });
          return teamsForRound(round)
            .map((keys) => keys.map((k) => byKey.get(k)).filter((x): x is RoundPlayer => !!x))
            .filter((mem) => mem.length > 0)
            .map((mem) => ({
              key: mem.map((p) => p.id).join('+'),
              label: mem.map((p) => p.name.trim().split(' ').slice(-1)[0]).join(' & '),
              handicaps: mem.map((p) => p.handicap),
              memberIds: mem.map((p) => p.id),
            }));
        })()
      : round.players.map((p) => ({ key: p.id, label: p.name, handicaps: [p.handicap], memberIds: [p.id] }));

  const goHole = (delta: number) => {
    const next = Math.min(n - 1, Math.max(0, holeIdx + delta));
    setHoleIdx(next);
    setActivePlayer(0);
  };
  const goRef = useRef(goHole);
  goRef.current = goHole;

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 60) goRef.current(-1);
        else if (g.dx < -60) goRef.current(1);
      },
    }),
  ).current;

  const activeContests = evContests || round.contests || { longestDrive: [], closestToPin: [] };
  const contestsHere: ContestType[] = [];
  if ((activeContests.longestDrive || []).includes(holeNo)) {
    contestsHere.push('longestDrive');
  }
  if ((activeContests.closestToPin || []).includes(holeNo)) {
    contestsHere.push('closestToPin');
  }

  const contestEntries = (type: ContestType): ContestResult[] => {
    const list = (round.contestResults ?? []).filter(
      (r) => r.type === type && r.holeNumber === holeNo,
    );
    return list.sort((a, b) => {
      if (a.metres === null) return 1;
      if (b.metres === null) return -1;
      return type === 'longestDrive' ? b.metres - a.metres : a.metres - b.metres;
    });
  };

  const openContest = (type: ContestType) => {
    setWinnerName('');
    setMetresText('');
    setEditingContest(type);
  };

  const saveContest = () => {
    if (!editingContest) return;
    const name = winnerName.trim();
    if (!name) {
      setEditingContest(null);
      return;
    }
    const metres = parseFloat(metresText.replace(',', '.'));
    const result: ContestResult = {
      type: editingContest,
      holeNumber: holeNo,
      winner: name,
      metres: Number.isFinite(metres) ? metres : null,
    };
    const others = (round.contestResults ?? []).filter(
      (r) =>
        !(
          r.type === editingContest &&
          r.holeNumber === holeNo &&
          r.winner.toLowerCase() === name.toLowerCase()
        ),
    );
    onUpdate({ ...round, contestResults: [...others, result] });
    if (round.liveEventId) {
      pushContestResult(round.liveEventId, editingContest, holeNo, name, result.metres);
    }
    setWinnerName('');
    setMetresText('');
  };

  const removeContestEntry = (entry: ContestResult) => {
    const next = (round.contestResults ?? []).filter((r) => r !== entry);
    onUpdate({ ...round, contestResults: next });
    if (round.liveEventId) {
      removeContestResult(round.liveEventId, entry.type, entry.holeNumber, entry.winner);
    }
  };

  const setScore = (value: number | null) => {
    const unit = units[activePlayer];
    const ids = new Set(unit ? unit.memberIds : []);
    const players = round.players.map((p) =>
      ids.has(p.id)
        ? { ...p, scores: p.scores.map((sc, si) => (si === holeIdx ? value : sc)) }
        : p,
    );
    onUpdate({ ...round, players });
    if (value !== null) {
      if (activePlayer < units.length - 1) {
        setActivePlayer(activePlayer + 1);
      } else if (holeIdx < n - 1) {
        setActivePlayer(0);
        setHoleIdx(holeIdx + 1);
      }
    }
  };

  const openCustom = () => {
    const cur = round.players[activePlayer]?.scores[holeIdx];
    setCustomText(cur && cur >= 11 ? String(cur) : '11');
    setCustomOpen(true);
  };

  const saveCustom = () => {
    const v = parseInt(customText, 10);
    if (Number.isFinite(v) && v >= 1 && v <= 30) {
      setScore(v);
    }
    setCustomOpen(false);
  };

  const bump = (d: number) => {
    const v = Math.min(30, Math.max(1, (parseInt(customText, 10) || 11) + d));
    setCustomText(String(v));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.holeBar}>
        <TouchableOpacity
          onPress={() => goHole(-1)}
          disabled={holeIdx === 0}
          hitSlop={hit}
        >
          <Text style={[styles.holeArrow, holeIdx === 0 && styles.dim]}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.holeTitle}>
          HOLE {holeNo} | PAR {hole.par}
        </Text>
        <TouchableOpacity
          onPress={() => goHole(1)}
          disabled={holeIdx === n - 1}
          hitSlop={hit}
        >
          <Text style={[styles.holeArrow, holeIdx === n - 1 && styles.dim]}>
            ›
          </Text>
        </TouchableOpacity>
      </View>

      {contestsHere.map((type) => {
        const entries = contestEntries(type);
        const best = entries[0];
        return (
          <TouchableOpacity
            key={type}
            style={[styles.contestBanner, best && styles.contestBannerDone]}
            onPress={() => openContest(type)}
          >
            <Text style={styles.contestBannerIcon}>
              {type === 'longestDrive' ? '🏌️' : '🎯'}
            </Text>
            <Text style={styles.contestBannerText}>
              {best
                ? `${CONTEST_LABELS[type]}: ${best.winner}${
                    best.metres !== null ? ` · ${best.metres} m` : ''
                  } leads (tap to add)`
                : `${CONTEST_LABELS[type]} on this hole — tap to record results`}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} {...swipe.panHandlers}>
        <ScrollView style={styles.playerList}>
          {units.map((u, ui) => {
              const rep = round.players.find((pp) => pp.id === u.memberIds[0]);
              const score = rep ? rep.scores[holeIdx] : null;
              const phcp = isScramble
                ? ambroseTeamHcp(u.handicaps.map((h) => playingHandicap(h, n)))
                : playingHandicap(u.handicaps[0], n);
              const recv = strokesReceived(phcp, hole, round.holes);
              const isActive = ui === activePlayer;
              const under = score !== null && score < hole.par;
              const over = score !== null && score > hole.par;
              return (
                <TouchableOpacity
                  key={u.key}
                  style={[styles.playerRow, isActive && styles.playerRowActive]}
                  onPress={() => setActivePlayer(ui)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{u.label}</Text>
                    <Text style={styles.playerHcp}>
                      HCP {isScramble ? phcp : u.handicaps[0]}
                      {recv !== 0 ? ` · ${recv} stroke${Math.abs(recv) > 1 ? 's' : ''} here` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.scoreBubble,
                      score === null && styles.scoreBubbleEmpty,
                      under && styles.scoreBubbleUnder,
                      over && styles.scoreBubbleOver,
                    ]}
                  >
                    <Text style={[styles.scoreText, score === null && styles.scoreTextEmpty]}>
                      {score ?? '–'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.swipeHint}>‹ swipe to change holes ›</Text>
        </ScrollView>
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((nKey) => {
          const label = scoreLabel(nKey, hole.par);
          const isPar = nKey === hole.par;
          return (
            <TouchableOpacity
              key={nKey}
              style={[styles.key, isPar && styles.keyPar]}
              onPress={() => setScore(nKey)}
            >
              <Text style={styles.keyNum}>{nKey}</Text>
              {label ? <Text style={styles.keyLabel}>{label}</Text> : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.key, styles.keyDark]}
          onPress={() => setScore(null)}
        >
          <Text style={styles.keyClear}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, styles.keyDark]}
          onPress={() => setScore(10)}
        >
          <Text style={styles.keyNum}>10</Text>
        </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.key, styles.keyDark]}
                  onPress={() => { Alert.alert('Wipe hole?', 'No score for this hole - 0 stableford points.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Wipe', style: 'destructive', onPress: () => setScore(0) }]); }}
                >
                  <Text style={[styles.keyClear, { color: '#ff6b6b' }]}>Wipe</Text>
                </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, styles.keyDark]}
          onPress={openCustom}
        >
          <Text style={styles.keyNum}>11+</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Score · Hole {holeNo} · {round.players[activePlayer]?.name}
            </Text>
            <Text style={styles.modalSub}>Enter the number of strokes</Text>
            <View style={styles.stepRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bump(-1)}>
                <Text style={styles.stepBtnText}>–</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.stepInput}
                keyboardType="number-pad"
                value={customText}
                onChangeText={setCustomText}
                maxLength={2}
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.stepBtn} onPress={() => bump(1)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setCustomOpen(false)}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={saveCustom}>
                <Text style={styles.modalBtnText}>Save score</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingContest !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingContest(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingContest ? CONTEST_LABELS[editingContest] : ''} · Hole{' '}
              {holeNo}
            </Text>
            {editingContest && contestEntries(editingContest).length > 0 ? (
              <View style={styles.entryList}>
                {contestEntries(editingContest).map((e, i) => (
                  <View key={`${e.winner}-${i}`} style={styles.entryRow}>
                    <Text style={styles.entryRank}>{i + 1}.</Text>
                    <Text style={styles.entryName}>{e.winner}</Text>
                    <Text style={styles.entryMetres}>
                      {e.metres !== null ? `${e.metres} m` : '–'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeContestEntry(e)}
                      hitSlop={hit}
                    >
                      <Text style={styles.entryRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.modalSub}>Add a result from your group</Text>
            <View style={styles.modalChips}>
              {round.players.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.modalChip,
                    winnerName === p.name && styles.modalChipActive,
                  ]}
                  onPress={() => setWinnerName(p.name)}
                >
                  <Text
                    style={[
                      styles.modalChipText,
                      winnerName === p.name && styles.modalChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Or type a name"
              placeholderTextColor={colors.textMuted}
              value={winnerName}
              onChangeText={setWinnerName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={
                editingContest === 'longestDrive'
                  ? 'Drive distance (metres)'
                  : 'Distance to pin (metres)'
              }
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={metresText}
              onChangeText={setMetresText}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setEditingContest(null)}
              >
                <Text style={styles.modalBtnGhostText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={saveContest}>
                <Text style={styles.modalBtnText}>Add result</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const hit = { top: 12, bottom: 12, left: 16, right: 16 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDarker },
  holeBar: {
    paddingTop: 58,
    paddingBottom: 12,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holeArrow: { color: colors.textOnDark, fontSize: 30, fontWeight: '700' },
  dim: { opacity: 0.25 },
  holeTitle: {
    color: colors.textOnDark,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  playerList: { flex: 1, paddingHorizontal: 14 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  playerRowActive: { backgroundColor: 'rgba(43,168,74,0.25)' },
  playerName: { color: colors.textOnDark, fontSize: 16, fontWeight: '700' },
  playerHcp: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  scoreBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBubbleEmpty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  scoreBubbleUnder: { backgroundColor: colors.green },
  scoreBubbleOver: { backgroundColor: colors.card },
  scoreText: { fontSize: 18, fontWeight: '900', color: colors.text },
  scoreTextEmpty: { color: colors.textOnDarkMuted },
  swipeHint: {
    color: colors.textOnDarkMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    paddingBottom: 14,
    gap: 6,
    backgroundColor: colors.keypadDark,
  },
  key: {
    width: '32%',
    backgroundColor: colors.keypad,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 52,
  },
  keyPar: { backgroundColor: colors.green },
  keyDark: { backgroundColor: '#1B1E1C' },
  keyNum: { color: '#fff', fontSize: 19, fontWeight: '800' },
  keyLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 1 },
  keyClear: { color: '#fff', fontSize: 14, fontWeight: '700' },
  contestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(216,178,74,0.18)',
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  contestBannerDone: {
    backgroundColor: 'rgba(43,168,74,0.2)',
    borderColor: colors.green,
  },
  contestBannerIcon: { fontSize: 16, marginRight: 8 },
  contestBannerText: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  modalSub: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 30, fontWeight: '900', color: colors.greenDark },
  stepInput: {
    width: 90,
    height: 64,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '900',
    color: colors.text,
  },
  entryList: { marginTop: 10 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryRank: { width: 24, fontWeight: '800', color: colors.textMuted },
  entryName: { flex: 1, fontWeight: '700', color: colors.text },
  entryMetres: { fontWeight: '800', color: colors.greenDark, marginRight: 12 },
  entryRemove: { color: colors.red, fontSize: 16, fontWeight: '800' },
  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalChipActive: { borderColor: colors.green, backgroundColor: '#E7F5EB' },
  modalChipText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  modalChipTextActive: { color: colors.greenDark },
  modalInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    marginTop: 10,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: colors.cardAlt },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalBtnGhostText: { color: colors.text, fontWeight: '800', fontSize: 15 },
});
