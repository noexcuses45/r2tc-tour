import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEFAULT_HOLES } from '../defaultCourse';
import {
  fetchCourseHoles,
  findNearbyCourses,
  NearbyCourse,
} from '../logic/courses';
import { FORMAT_HINTS, FORMAT_OPTIONS, FORMAT_LABELS } from '../logic/formats';
import FormatScreen from './FormatScreen';
import { playingHandicap, ambroseTeamHcp } from '../logic/scoring';
import { fetchCourseCard, fetchApiPars, fetchApiTees, fetchHandicapMap, ApiTee, searchCoursesByName } from '../logic/sheets';
import { fetchAllPlayers } from '../logic/supabase';
import { loadPlayers, makeId, savePlayers } from '../storage';
import { colors, radius } from '../theme';
import {
  GameFormat,
  HoleInfo,
  HoleSelection,
  Player,
  Round,
  RoundPlayer,
} from '../types';

interface Props {
  onCancel: () => void;
  onStart: (round: Round) => void;
  onCreate?: (round: Round) => void;
  liveEventId?: string | null;
  initialRound?: Round;
}

const HOLE_OPTIONS: { key: HoleSelection; label: string; sub: string }[] = [
  { key: 'full18', label: 'Full 18', sub: 'Play holes 1–18' },
  { key: 'front9', label: 'Front 9', sub: 'Play holes 1–9' },
  { key: 'back9', label: 'Back 9', sub: 'Play holes 10–18' },
];

export default function SetupScreen({ onCancel, onStart, onCreate, liveEventId, initialRound }: Props) {
  const [roundType, setRoundType] = useState<'r2tc' | 'social' | ''>('');
  const [courseName, setCourseName] = useState('');
  const [roundName, setRoundName] = useState('');
  const [holeSelection, setHoleSelection] = useState<HoleSelection>('full18');
  const [format, setFormat] = useState<GameFormat>('stroke');
  const [formatSettings, setFormatSettings] = useState<any>({ useHandicaps: true });
  const [showFormat, setShowFormat] = useState(false);
  const [holes18, setHoles18] = useState<HoleInfo[]>(
    DEFAULT_HOLES.map((h) => ({ ...h })),
  );
  const [roster, setRoster] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Player[][]>([[]]);
  const [tees, setTees] = useState<ApiTee[]>([]);
  const [selectedTee, setSelectedTee] = useState<ApiTee | null>(null);
  const editPreloadedRef = useRef(false);
  useEffect(() => {
    if (!initialRound || editPreloadedRef.current) return;
    editPreloadedRef.current = true;
    if (initialRound.date) { const _d = new Date(initialRound.date); if (!isNaN(_d.getTime())) { _d.setHours(0, 0, 0, 0); setRoundDate(_d.toISOString()); } }
    setCourseName(initialRound.courseName || '');
    setSelectedCourseId('edit');
    if (Array.isArray(initialRound.holes) && initialRound.holes.length) setHoles18(initialRound.holes as any);
    if (initialRound.holeSelection) setHoleSelection(initialRound.holeSelection as any);
    if (initialRound.primaryFormat) setFormat(initialRound.primaryFormat as any);
    const byId: any = {};
    (initialRound.players || []).forEach((p: any) => { byId[p.id] = p; });
    const gs = (initialRound.groups || []).map((ids: any) => (ids || []).map((id: any) => byId[id]).filter(Boolean));
    setGroups(gs.length ? gs : [[]]);
    setRoster((prev) => { const have = new Set(prev.map((p: any) => p.id)); const merged = prev.slice(); (initialRound.players || []).forEach((p: any) => { if (!have.has(p.id)) merged.push(p as any); }); return merged; });
  }, [initialRound]);
  const teeSlope = selectedTee && selectedTee.slope ? selectedTee.slope : null;
  const dailyOf = (p: any) => {
    const idx = typeof p.handicap === 'number' ? p.handicap : Number(p.handicap) || 0;
    return teeSlope ? Math.round((idx * teeSlope) / 113) : Math.round(idx);
  };
  const [pickedUp, setPickedUp] = useState<{ gi: number; si: number } | null>(null);
  const [groupStartHoles, setGroupStartHoles] = useState<number[]>([1]);
  const [groupTeeTimes, setGroupTeeTimes] = useState<string[]>(['']);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newHcp, setNewHcp] = useState('');
  const [ldHoles, setLdHoles] = useState<number[]>([]);
  const [c2pHoles, setC2pHoles] = useState<number[]>([]);
  const [nearby, setNearby] = useState<NearbyCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [searchingName, setSearchingName] = useState(false);
  const [roundDate, setRoundDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); });
  const shiftDate = (days: number) => setRoundDate((iso) => { const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString(); });
  const [showCal, setShowCal] = useState(false);
  const [calMonth, setCalMonth] = useState(roundDate);
  const openCal = () => { const d = new Date(roundDate); d.setDate(1); setCalMonth(d.toISOString()); setShowCal(true); };
  const shiftMonth = (n: number) => setCalMonth((iso) => { const d = new Date(iso); d.setDate(1); d.setMonth(d.getMonth() + n); return d.toISOString(); });
  const calCells = () => { const d = new Date(calMonth); const y = d.getFullYear(); const m = d.getMonth(); const first = new Date(y, m, 1).getDay(); const days = new Date(y, m + 1, 0).getDate(); const cells: (number | null)[] = []; for (let i = 0; i < first; i++) cells.push(null); for (let day = 1; day <= days; day++) cells.push(day); return cells; };
  const isSelDay = (day: number) => { const s = new Date(roundDate); const cc = new Date(calMonth); return s.getFullYear() === cc.getFullYear() && s.getMonth() === cc.getMonth() && s.getDate() === day; };
  const pickDay = (day: number) => { const d = new Date(calMonth); d.setDate(day); d.setHours(0, 0, 0, 0); setRoundDate(d.toISOString()); setShowCal(false); };
  const lastPickedRef = useRef('');
  useEffect(() => {
    const q = (courseName || '').trim();
    if (q.length < 3 || q === lastPickedRef.current) { setSearchResults([]); setSearchingName(false); return; }
    let on = true; setSearchingName(true);
    const tmr = setTimeout(() => {
      searchCoursesByName(q).then((rows) => { if (on) { setSearchResults(rows); setSearchingName(false); } }).catch(() => { if (on) setSearchingName(false); });
    }, 350);
    return () => { on = false; clearTimeout(tmr); };
  }, [courseName]);
  const [courseMsg, setCourseMsg] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [people, hmap] = await Promise.all([fetchAllPlayers(), fetchHandicapMap()]);
      const nid = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, '');
      const merged = people.map((pl) => {
        const key = nid(pl.golfId);
        const ga = key && hmap[key] != null ? hmap[key] : pl.handicap;
        return { id: pl.id, name: pl.name, handicap: ga, golfId: pl.golfId };
      });
      if (merged.length) setRoster(merged);
      else setRoster(await loadPlayers());
    })();
  }, []);

  const findCourses = async () => {
    setSearching(true);
    setCourseMsg('');
    setNearby([]);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setCourseMsg('Turn on Location / GPS on your phone, then try again.');
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setCourseMsg(
          perm.canAskAgain === false
            ? 'Location is blocked. Enable it in Settings → Expo Go → Location, then try again.'
            : 'Please allow location access to find courses near you.',
        );
        return;
      }
      let pos = await Location.getLastKnownPositionAsync();
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
      if (!pos) {
        setCourseMsg('Could not get your location — try again outdoors.');
        return;
      }
      const list = await findNearbyCourses(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      setNearby(list);
      if (list.length === 0) {
        setCourseMsg('No courses found nearby — type the course name instead.');
      } else {
        setCourseMsg('Tap your course to load its scorecard:');
      }
    } catch (e: any) {
      setCourseMsg('Location error: ' + (e && e.message ? e.message : String(e)));
    } finally {
      setSearching(false);
    }
  };

  const pickCourse = async (c: NearbyCourse) => {
    lastPickedRef.current = c.name;
    setSearchResults([]);
    setSelectedCourseId(c.id);
    setCourseName(c.name);
    setTees([]);
    setSelectedTee(null);
    fetchApiTees(c.name).then((ts) => { setTees(ts); setSelectedTee(ts[0] || null); });
    setCourseMsg('Loading scorecard…');
    try {
      const card = await fetchCourseCard(c.name);
      if (card) {
        setHoles18((prev) =>
          prev.map((h, i) => ({
            par: card.pars[i] != null ? (card.pars[i] as number) : h.par,
            strokeIndex: card.si[i] != null ? (card.si[i] as number) : h.strokeIndex,
          })),
        );
        setCourseMsg('Real scorecard loaded ✓ par & stroke index set');
        return;
      }
      const apiPars = await fetchApiPars(c.name);
      const { holes, found } = await fetchCourseHoles(c);
      if (apiPars) {
        setHoles18(
          holes.map((h, i) => ({
            ...h,
            par: apiPars[i] != null ? (apiPars[i] as number) : h.par,
          })),
        );
        setCourseMsg('Pars loaded from GolfCourseAPI ✓ — set stroke index below');
        return;
      }
      setHoles18(holes);
      setCourseMsg(
        found > 0
          ? `Scorecard loaded ✓ pars & stroke index set for ${found} holes`
          : 'Course selected — no scorecard data, check the pars below.',
      );
    } catch {
      setCourseMsg('Could not load the scorecard — set the pars below.');
    }
  };

  const cyclePar = (i: number) => {
    setHoles18((prev) =>
      prev.map((h, hi) =>
        hi === i ? { ...h, par: h.par === 3 ? 4 : h.par === 4 ? 5 : 3 } : h,
      ),
    );
  };

  const toggleContestHole = (
    holeNo: number,
    list: number[],
    set: (v: number[]) => void,
  ) => {
    set(
      list.includes(holeNo)
        ? list.filter((h) => h !== holeNo)
        : [...list, holeNo].sort((a, b) => a - b),
    );
  };

  const holeInPlay = (holeNo: number) =>
    holeSelection === 'front9'
      ? holeNo <= 9
      : holeSelection === 'back9'
        ? holeNo >= 10
        : true;

  const placedIds = new Set(groups.flat().map((p) => p.id));

  const assignPlayer = (p: Player) => {
    if (pickerSlot === null) return;
    setGroups((prev) =>
      prev.map((g, gi) =>
        gi === pickerSlot && g.length < 4 && !placedIds.has(p.id)
          ? [...g, p]
          : g,
      ),
    );
    setPickerSlot(null);
  };

  const removeFromGroup = (gi: number, si: number) => {
    const p = groups[gi][si];
    Alert.alert('Remove player', `Take ${p.name} out of Group ${gi + 1}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          setGroups((prev) =>
            prev.map((g, i) => (i === gi ? g.filter((_, j) => j !== si) : g)),
          ),
      },
    ]);
  };

  const removeGroup = (gi: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== gi));
    setGroupStartHoles((prev) => prev.filter((_, i) => i !== gi));
    setGroupTeeTimes((prev) => prev.filter((_, i) => i !== gi));
    setPickedUp(null);
  };

  const addGroup = () => {
    setGroups((prev) => [...prev, []]);
    setGroupStartHoles((prev) => [...prev, 1]);
    setGroupTeeTimes((prev) => [...prev, '']);
  };

  const tapFilled = (gi: number, si: number) => {
    if (!pickedUp) {
      setPickedUp({ gi, si });
      return;
    }
    if (pickedUp.gi === gi && pickedUp.si === si) {
      setPickedUp(null);
      return;
    }
    setGroups((prev) => {
      const next = prev.map((g) => [...g]);
      const a = next[pickedUp.gi] && next[pickedUp.gi][pickedUp.si];
      const b = next[gi] && next[gi][si];
      if (!a || !b) return prev;
      next[pickedUp.gi][pickedUp.si] = b;
      next[gi][si] = a;
      return next;
    });
    setPickedUp(null);
  };

  const tapEmpty = (gi: number) => {
    if (!pickedUp) {
      setPickerSlot(gi);
      return;
    }
    setGroups((prev) => {
      if (gi !== pickedUp.gi && prev[gi].length >= 4) return prev;
      const player = prev[pickedUp.gi] && prev[pickedUp.gi][pickedUp.si];
      if (!player) return prev;
      const next = prev.map((g, i) =>
        i === pickedUp.gi ? g.filter((_, j) => j !== pickedUp.si) : g,
      );
      next[gi] = [...next[gi], player];
      return next;
    });
    setPickedUp(null);
  };

  const changeStartHole = (gi: number, delta: number) => {
    setGroupStartHoles((prev) => {
      const next = [...prev];
      let v = (next[gi] ?? 1) + delta;
      if (v < 1) v = 18;
      if (v > 18) v = 1;
      next[gi] = v;
      return next;
    });
  };

  const setTeeTime = (gi: number, text: string) => {
    setGroupTeeTimes((prev) => {
      const next = [...prev];
      next[gi] = text;
      return next;
    });
  };

  const addPlayer = async () => {
    const name = newName.trim();
    if (!name) return;
    const hcp = Math.min(60, Math.max(-10, parseFloat(newHcp) || 0));
    const player: Player = { id: makeId(), name, handicap: hcp };
    const next = [...roster, player];
    setRoster(next);
    setNewName('');
    setNewHcp('');
    if (pickerSlot !== null) {
      setGroups((prev) =>
        prev.map((g, gi) =>
          gi === pickerSlot && g.length < 4 ? [...g, player] : g,
        ),
      );
      setPickerSlot(null);
    }
    await savePlayers(next);
  };

  const removeFromRoster = async (id: string) => {
    const next = roster.filter((p) => p.id !== id);
    setRoster(next);
    setGroups((prev) => prev.map((g) => g.filter((p) => p.id !== id)));
    await savePlayers(next);
  };

  const start = (asCreate?: boolean) => {
    if (!roundType) { Alert.alert('Choose a round type', 'Tap R2TC Competition or Non Tour Competition at the top first.'); return; }
    const flat = groups.flat();
    if (flat.length === 0) {
      Alert.alert('Add players', 'Add at least one player to a group.');
      return;
    }
    const filledGroups = groups.filter((g) => g.length > 0);
    if (format === 'matchplay') {
      if (filledGroups.some((g) => g.length % 2 !== 0)) {
        Alert.alert(
          'Match Play needs pairs',
          'Each group needs an even number of players — matches are made ' +
            'inside each group (1 vs 2, 3 vs 4).',
        );
        return;
      }
    }
    if (format === 'bestball') {
      if (filledGroups.some((g) => g.length !== 2 && g.length !== 4)) {
        Alert.alert(
          '2v2 Best Ball needs teams of 2',
          'Use groups of 4 (players 1 & 2 vs 3 & 4) or groups of 2 ' +
            '(one team per group).',
        );
        return;
      }
    }
    if (format === 'skins' && flat.length < 2) {
      Alert.alert('Skins needs 2+ players', 'Add at least two players.');
      return;
    }
    // Pairings for Match Play / Best Ball: consecutive pairs in each group
    const teams: string[][] = [];
    if (['matchplay', 'bestball', 'bb_stroke', 'bb_stableford', 'bb_match', 'scramble_stroke', 'scramble_match', 'foursome_match', 'greensome_match'].indexOf(format) >= 0) {
      for (const g of filledGroups) {
        for (let i = 0; i + 1 < g.length; i += 2) {
          teams.push([g[i].name, g[i + 1].name]);
        }
      }
    } else if (['tbb_stroke', 'tbb_stableford', 'tscramble_stroke'].indexOf(format) >= 0) {
      for (const g of filledGroups) {
        if (g.length) teams.push(g.map((p) => p.name));
      }
    }
    const allHoles: HoleInfo[] = holes18.map((h) => ({ ...h }));
    let holes = allHoles;
    let holeNumbers = allHoles.map((_, i) => i + 1);
    if (holeSelection === 'front9') {
      holes = allHoles.slice(0, 9);
      holeNumbers = holeNumbers.slice(0, 9);
    } else if (holeSelection === 'back9') {
      holes = allHoles.slice(9);
      holeNumbers = holeNumbers.slice(9);
    }
    const players: RoundPlayer[] = flat
      .map((p) => ({
        id: p.id,
        name: p.name,
        handicap: dailyOf(p),
        scores: holes.map(() => null),
      }));
    const course = courseName.trim() || 'R2TC Course';
    const startHolesOut: number[] = [];
    const teeTimesOut: (string | null)[] = [];
    groups.forEach((g, gi) => {
      if (g.length > 0) {
        startHolesOut.push(groupStartHoles[gi] ?? 1);
        teeTimesOut.push((groupTeeTimes[gi] || '').trim() || null);
      }
    });
    const round: Round = {
      id: makeId(),
      name:
        roundName.trim() ||
        `${course} · ${new Date().toLocaleDateString()}`,
      courseName: course,
      date: roundDate,
      holeSelection,
      holes,
      holeNumbers,
      primaryFormat: format,
      formatSettings,
      players,
      groups: groups
        .filter((g) => g.length > 0)
        .map((g) => g.map((p) => p.id)),
      groupStartHoles: startHolesOut,
      groupTeeTimes: teeTimesOut,
      teams: teams.length > 0 ? teams : undefined,
      contests: {
        longestDrive: ldHoles.filter(holeInPlay),
        closestToPin: c2pHoles.filter(holeInPlay),
      },
      contestResults: [],
      liveEventId: liveEventId || undefined,
      status: 'active',
        roundType,
    };
    if (asCreate && onCreate) { onCreate(round); } else { onStart(round); }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel} hitSlop={hit}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>GAME SETUP</Text>
        <View style={{ width: 50 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={{ flexDirection: 'row', marginBottom: 14 }}>
            <TouchableOpacity onPress={() => setRoundType('r2tc')} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center', marginRight: 6, borderColor: roundType === 'r2tc' ? '#2BA84A' : '#CBD5D0', backgroundColor: roundType === 'r2tc' ? '#2BA84A' : 'transparent' }}>
              <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>R2TC Competition</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRoundType('social')} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, alignItems: 'center', marginLeft: 6, borderColor: roundType === 'social' ? '#2BA84A' : '#CBD5D0', backgroundColor: roundType === 'social' ? '#2BA84A' : 'transparent' }}>
              <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>Non Tour Competition</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.section}>COURSE</Text>
          <TouchableOpacity
            style={styles.findBtn}
            onPress={findCourses}
            disabled={searching}
          >
            <Text style={styles.findBtnText}>
              {searching ? 'Searching nearby…' : '📍 Find courses near me'}
            </Text>
          </TouchableOpacity>
          {courseMsg ? <Text style={styles.courseMsg}>{courseMsg}</Text> : null}
          {tees.length > 0 ? (
            <View style={styles.teePickRow}>
              <Text style={styles.teePickLbl}>Tee</Text>
              {tees.map((t, ti) => (
                <TouchableOpacity key={t.name + ti} style={[styles.teeChip, selectedTee && selectedTee.name === t.name ? styles.teeChipOn : null]} onPress={() => setSelectedTee(t)}>
                  <Text style={[styles.teeChipTxt, selectedTee && selectedTee.name === t.name ? styles.teeChipTxtOn : null]}>{t.name}{t.slope ? ' · ' + t.slope : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {selectedCourseId ? (
            <TouchableOpacity onPress={() => setSelectedCourseId(null)}>
              <Text style={styles.changeCourse}>↺ Change course</Text>
            </TouchableOpacity>
          ) : null}
          {(selectedCourseId
            ? nearby.filter((c) => c.id === selectedCourseId)
            : nearby
          ).map((c) => {
            const isSel = selectedCourseId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.option, isSel && styles.optionActive]}
                onPress={() => pickCourse(c)}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      isSel && styles.optionLabelActive,
                    ]}
                  >
                    {c.name}
                  </Text>
                  <Text style={styles.optionSub}>
                    {c.distanceKm.toFixed(1)} km away
                  </Text>
                </View>
                {isSel ? <Text style={styles.tick}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
          <TextInput
            style={styles.input}
            placeholder="Or type the course name"
            placeholderTextColor={colors.textMuted}
            value={courseName}
            onChangeText={setCourseName}
          />
          {searchingName || searchResults.length > 0 ? (
            <View style={styles.searchResults}>
              {searchingName ? <Text style={styles.searchHint}>Searching courses…</Text> : null}
              {searchResults.map((r) => (
                <TouchableOpacity key={r.id} style={styles.searchItem} onPress={() => pickCourse(r as any)}>
                  <Text style={styles.searchItemTxt}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Round name (optional, e.g. Ivanhoe Open R1)"
            placeholderTextColor={colors.textMuted}
            value={roundName}
            onChangeText={setRoundName}
          />
          <Text style={styles.dateLbl}>Round date</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => shiftDate(-1)}><Text style={styles.dateBtnTxt}>‹</Text></TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} onPress={openCal}><Text style={styles.dateVal}>{new Date(roundDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => shiftDate(1)}><Text style={styles.dateBtnTxt}>›</Text></TouchableOpacity>
          </View>
          <Modal visible={showCal} transparent animationType="fade" onRequestClose={() => setShowCal(false)}>
            <TouchableOpacity style={styles.calBackdrop} activeOpacity={1} onPress={() => setShowCal(false)}>
              <View style={styles.calCard}>
                <View style={styles.calHead}>
                  <TouchableOpacity style={styles.calNav} onPress={() => shiftMonth(-1)}><Text style={styles.calNavTxt}>‹</Text></TouchableOpacity>
                  <Text style={styles.calTitle}>{new Date(calMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
                  <TouchableOpacity style={styles.calNav} onPress={() => shiftMonth(1)}><Text style={styles.calNavTxt}>›</Text></TouchableOpacity>
                </View>
                <View style={styles.calWeekRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, wi) => (<Text key={wi} style={styles.calWeekTxt}>{w}</Text>))}
                </View>
                <View style={styles.calGrid}>
                  {calCells().map((cell, ci) => (cell == null ? (<View key={ci} style={styles.calCell} />) : (
                    <TouchableOpacity key={ci} style={[styles.calCell, isSelDay(cell) ? styles.calCellSel : null]} onPress={() => pickDay(cell)}>
                      <Text style={[styles.calDayTxt, isSelDay(cell) ? styles.calDayTxtSel : null]}>{cell}</Text>
                    </TouchableOpacity>
                  )))}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          <Text style={styles.section}>HOW MANY HOLES?</Text>
          {HOLE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.option,
                holeSelection === opt.key && styles.optionActive,
              ]}
              onPress={() => setHoleSelection(opt.key)}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.optionLabel,
                    holeSelection === opt.key && styles.optionLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
              {holeSelection === opt.key ? (
                <Text style={styles.tick}>✓</Text>
              ) : null}
            </TouchableOpacity>
          ))}

          <Text style={styles.section}>HOLE PARS (tap to change)</Text>
          <View style={styles.parGrid}>
            {holes18.map((h, i) => {
              const dimmed =
                (holeSelection === 'front9' && i >= 9) ||
                (holeSelection === 'back9' && i < 9);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.parCell, dimmed && styles.parCellDim]}
                  onPress={() => cyclePar(i)}
                  disabled={dimmed}
                >
                  <Text style={styles.parHole}>{i + 1}</Text>
                  <Text style={styles.parValue}>{h.par}</Text>
                  <Text style={styles.parSi}>SI {h.strokeIndex}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>GAME FORMAT</Text>
          <TouchableOpacity style={styles.fmtSelect} onPress={() => setShowFormat(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fmtSelLbl}>Match type</Text>
              <Text style={styles.fmtSelVal}>{FORMAT_LABELS[format]}</Text>
            </View>
            <Text style={styles.fmtSelChev}>›</Text>
          </TouchableOpacity>
          {showFormat ? (
            <FormatScreen
              format={format}
              settings={formatSettings}
              onClose={() => setShowFormat(false)}
              onApply={(f, s) => { setFormat(f); setFormatSettings(s); setShowFormat(false); }}
            />
          ) : null}
          <Text style={styles.hint}>{FORMAT_HINTS[format]}</Text>

          <Text style={styles.section}>CONTESTS</Text>
          <Text style={styles.contestHint}>
            Tap the holes for each contest. After your group plays that hole,
            the app will ask who won and how many metres.
          </Text>
          {(
            [
              ['Longest Drive', ldHoles, setLdHoles],
              ['Closest to the Pin', c2pHoles, setC2pHoles],
            ] as [string, number[], (v: number[]) => void][]
          ).map(([label, list, set]) => (
            <View key={label} style={styles.contestCard}>
              <Text style={styles.contestTitle}>{label}</Text>
              <View style={styles.contestGrid}>
                {Array.from({ length: 18 }, (_, i) => i + 1).map((holeNo) => {
                  const active = list.includes(holeNo);
                  const dimmed = !holeInPlay(holeNo);
                  return (
                    <TouchableOpacity
                      key={holeNo}
                      style={[
                        styles.contestChip,
                        active && styles.contestChipActive,
                        dimmed && styles.parCellDim,
                      ]}
                      disabled={dimmed}
                      onPress={() => toggleContestHole(holeNo, list, set)}
                    >
                      <Text
                        style={[
                          styles.contestChipText,
                          active && styles.contestChipTextActive,
                        ]}
                      >
                        {holeNo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <Text style={styles.section}>PLAYER GROUPS</Text>
          {groups.map((g, gi) => (
            <View key={gi} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>Group {gi + 1}</Text>
                {groups.length > 1 && g.length === 0 ? (
                  <TouchableOpacity
                    onPress={() => removeGroup(gi)}
                    hitSlop={hit}
                  >
                    <Text style={styles.groupRemove}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.teeRow}>
                <View style={styles.teeCol}>
                  <Text style={styles.teeLabel}>Start hole</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => changeStartHole(gi, -1)}
                      hitSlop={hit}
                    >
                      <Text style={styles.stepBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{groupStartHoles[gi] ?? 1}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => changeStartHole(gi, 1)}
                      hitSlop={hit}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.teeCol}>
                  <Text style={styles.teeLabel}>Tee time</Text>
                  <TextInput
                    style={styles.teeInput}
                    placeholder="e.g. 7:30"
                    placeholderTextColor={colors.textMuted}
                    value={groupTeeTimes[gi] ?? ''}
                    onChangeText={(txt) => setTeeTime(gi, txt)}
                  />
                </View>
              </View>
              {['scramble_stroke', 'scramble_match', 'foursome_match', 'greensome_match', 'bb_stroke', 'bb_stableford', 'bb_match'].indexOf(format) >= 0 ? (
                <View style={styles.teamHcpWrap}>
                  {[[0, 1], [2, 3]].map((pr, ti) => {
                    const a = g[pr[0]];
                    const b = g[pr[1]];
                    if (!a || !b) return null;
                    const hc = holeSelection === 'full18' ? 18 : 9;
                    const pa = playingHandicap(dailyOf(a), hc);
                    const pb = playingHandicap(dailyOf(b), hc);
                    const low = Math.min(pa, pb);
                    const high = Math.max(pa, pb);
                    const th =
                      format === 'scramble_stroke' || format === 'scramble_match'
                        ? ambroseTeamHcp([pa, pb], formatSettings.scrambleMethod)
                        : format === 'foursome_match'
                        ? Math.round(0.5 * (pa + pb))
                        : format === 'greensome_match'
                        ? Math.round(0.6 * low + 0.4 * high)
                        : null;
                    return (
                      <View key={ti} style={styles.teamHcpRow}>
                        <Text style={styles.teamHcpName} numberOfLines={1}>{'Team ' + (ti + 1) + ': ' + a.name + ' & ' + b.name}</Text>
                        <Text style={styles.teamHcpVal}>{th != null ? 'Team HCP ' + th : 'Better Ball'}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {['tbb_stroke', 'tbb_stableford', 'tscramble_stroke'].indexOf(format) >= 0 && g.length > 0 ? (
                <View style={styles.teamHcpWrap}>
                  <View style={styles.teamHcpRow}>
                    <Text style={styles.teamHcpName} numberOfLines={1}>{'Team: ' + g.map((p) => p.name).join(', ')}</Text>
                    <Text style={styles.teamHcpVal}>{format === 'tscramble_stroke' ? ('Team HCP ' + ambroseTeamHcp(g.map((p) => playingHandicap(dailyOf(p), holeSelection === 'full18' ? 18 : 9)), formatSettings.scrambleMethod)) : ('Best ' + (formatSettings.bestN || 2) + ' ball')}</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.slotGrid}>
                {Array.from({ length: 4 }, (_, si) => {
                  const p = g[si];
                  return p ? (
                    <TouchableOpacity
                      key={si}
                      style={[
                        styles.slotFilled,
                        pickedUp && pickedUp.gi === gi && pickedUp.si === si
                          ? styles.slotPicked
                          : null,
                      ]}
                      onPress={() => tapFilled(gi, si)}
                      onLongPress={() => removeFromGroup(gi, si)}
                    >
                      <Text style={styles.slotName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.slotSub}>
                        PHCP:{' '}
                        {playingHandicap(
                          dailyOf(p),
                          holeSelection === 'full18' ? 18 : 9,
                        )}
                      </Text>
                      <Text style={styles.slotSub}>HCP: {p.handicap}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={si}
                      style={[styles.slotEmpty, pickedUp ? styles.slotDrop : null]}
                      onPress={() => tapEmpty(gi)}
                    >
                      <Text style={styles.slotAdd}>
                        {pickedUp ? 'Drop here' : '+ Add Player'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addGroupBtn}
            onPress={addGroup}
          >
            <Text style={styles.addGroupText}>+ Add Group</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Tap a player to pick them up, then tap another spot to move them
            (tap two players to swap). Press and hold a player to remove them.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={pickerSlot !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerSlot(null)}
      >
        <View style={styles.pickerWrap}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>
              Add Player
              {pickerSlot !== null ? ` · Group ${pickerSlot + 1}` : ''}
            </Text>
            <Text style={styles.pickerSub}>TOUR PLAYERS</Text>
            <ScrollView style={styles.pickerList}>
              {roster.filter((p) => !placedIds.has(p.id)).length === 0 ? (
                <Text style={styles.pickerEmpty}>
                  Everyone saved is already in a group — add a new player
                  below.
                </Text>
              ) : null}
              {roster
                .filter((p) => !placedIds.has(p.id))
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.option}
                    onPress={() => assignPlayer(p)}
                    onLongPress={() =>
                      Alert.alert(
                        'Remove player',
                        `Remove ${p.name} from the tour list?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => removeFromRoster(p.id),
                          },
                        ],
                      )
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{p.name}</Text>
                      <Text style={styles.optionSub}>GA {p.handicap}{teeSlope ? '  ·  Daily ' + dailyOf(p) : ''}</Text>
                    </View>
                    <Text style={styles.tick}>+</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, styles.addName]}
                placeholder="New player name"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.input, styles.addHcp]}
                placeholder="HCP"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={newHcp}
                onChangeText={setNewHcp}
              />
              <TouchableOpacity style={styles.addBtn} onPress={addPlayer}>
                <Text style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setPickerSlot(null)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.bottomBar}>
        {!initialRound && onCreate ? (<TouchableOpacity style={styles.createBtn} onPress={() => start(true)}><Text style={styles.createBtnText}>Create round</Text></TouchableOpacity>) : null}
        <TouchableOpacity style={styles.startBtn} onPress={() => start(false)}>
          <Text style={styles.startBtnText}>{initialRound ? 'Save changes »' : 'Start Round »'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  calBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  calCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, width: '92%', maxWidth: 360 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNav: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#e7f3ec', alignItems: 'center', justifyContent: 'center' },
  calNavTxt: { color: colors.green, fontWeight: '800', fontSize: 22 },
  calTitle: { color: '#143a22', fontWeight: '800', fontSize: 17 },
  calWeekRow: { flexDirection: 'row' },
  calWeekTxt: { width: '14.285%', textAlign: 'center', color: '#7c8a82', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellSel: { backgroundColor: colors.green, borderRadius: 10 },
  calDayTxt: { color: '#143a22', fontSize: 15 },
  calDayTxtSel: { color: '#fff', fontWeight: '800' },
  dateLbl: { color: '#7c8a82', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6ece8', paddingHorizontal: 8, paddingVertical: 6 },
  dateBtn: { width: 44, height: 38, borderRadius: 8, backgroundColor: '#e7f3ec', alignItems: 'center', justifyContent: 'center' },
  dateBtnTxt: { color: colors.green, fontWeight: '800', fontSize: 20 },
  dateVal: { flex: 1, textAlign: 'center', color: '#143a22', fontWeight: '800', fontSize: 15 },
  searchResults: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e1e8e4', marginTop: 6, overflow: 'hidden' },
  searchHint: { color: '#7c8a82', fontSize: 12, padding: 10 },
  searchItem: { paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f0' },
  searchItemTxt: { color: '#143a22', fontSize: 14, fontWeight: '600' },
  teamHcpWrap: { marginBottom: 8, backgroundColor: '#eef6f1', borderRadius: 8, padding: 8 },
  teamHcpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  teamHcpName: { color: '#143a22', fontWeight: '700', fontSize: 12, flex: 1, marginRight: 8 },
  teamHcpVal: { color: colors.green, fontWeight: '800', fontSize: 13 },
  fmtSelect: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#e6ece8' },
  fmtSelLbl: { color: '#7c8a82', fontSize: 12, fontWeight: '600' },
  fmtSelVal: { color: '#143a22', fontSize: 16, fontWeight: '800', marginTop: 2 },
  fmtSelChev: { color: '#b8c2bc', fontSize: 24, fontWeight: '300' },
  teePickRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  teePickLbl: { color: colors.textMuted, fontSize: 12, marginRight: 4, fontWeight: '700' },
  teeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  teeChipOn: { backgroundColor: colors.green, borderColor: colors.green },
  teeChipTxt: { color: colors.text, fontSize: 12, fontWeight: '600' },
  teeChipTxtOn: { color: '#fff' },
  changeCourse: { color: colors.green, fontWeight: '800', fontSize: 13, marginBottom: 8, marginLeft: 2 },
  slotPicked: { borderColor: colors.gold, borderWidth: 2 },
  slotDrop: { borderColor: colors.green },
  teeRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 10, paddingTop: 10 },
  teeCol: { flex: 1 },
  teeLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, borderRadius: radius.md, alignSelf: 'flex-start' },
  stepBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  stepBtnText: { fontSize: 20, color: colors.greenDark, fontWeight: '800' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
  teeInput: { backgroundColor: colors.cardAlt, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 15 },
  screen: { flex: 1, backgroundColor: colors.bgDark },
  topBar: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: { color: colors.textOnDarkMuted, fontSize: 15, width: 50 },
  topTitle: {
    color: colors.textOnDark,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontSize: 15,
  },
  scroll: { padding: 16, paddingBottom: 30 },
  section: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 8,
  },
  findBtn: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  findBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  courseMsg: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 8,
  },
  option: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 13,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionActive: { borderColor: colors.green },
  optionLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  optionLabelActive: { color: colors.greenDark },
  optionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tick: { color: colors.green, fontSize: 18, fontWeight: '900' },
  parGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  parCell: {
    width: '15.2%',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: 7,
  },
  parCellDim: { opacity: 0.35 },
  parHole: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  parValue: { fontSize: 17, fontWeight: '900', color: colors.greenDark },
  parSi: { fontSize: 9, color: colors.textMuted },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formatBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatBtnActive: { borderColor: colors.green },
  formatText: { fontWeight: '800', color: colors.textMuted, fontSize: 14 },
  formatTextActive: { color: colors.greenDark },
  hint: {
    color: colors.textOnDarkMuted,
    fontSize: 12,
    marginTop: 8,
  },
  contestHint: {
    color: colors.textOnDarkMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  contestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  contestTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  contestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  contestChip: {
    width: 40,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  contestChipActive: {
    backgroundColor: colors.green,
    borderColor: colors.greenDark,
  },
  contestChipText: { fontWeight: '800', color: colors.text, fontSize: 14 },
  contestChipTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', gap: 8 },
  addName: { flex: 1 },
  addHcp: { width: 70 },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: -2 },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: 10,
    overflow: 'hidden',
  },
  groupHeader: {
    backgroundColor: colors.green,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  groupRemove: { color: '#fff', fontWeight: '700', fontSize: 12 },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
  },
  slotFilled: {
    width: '48%',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 2,
    borderColor: colors.green,
  },
  slotName: { fontWeight: '800', color: colors.text, fontSize: 14 },
  slotSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  slotEmpty: {
    width: '48%',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.textMuted,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
  },
  slotAdd: { color: colors.greenDark, fontWeight: '800', fontSize: 13 },
  addGroupBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addGroupText: { color: colors.greenDark, fontWeight: '900', fontSize: 15 },
  pickerWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: colors.cardAlt,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 16,
    maxHeight: '85%',
  },
  pickerTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  pickerSub: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 10,
    marginBottom: 6,
  },
  pickerList: { maxHeight: 300 },
  pickerEmpty: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  pickerClose: {
    backgroundColor: colors.bgDark,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  pickerCloseText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bottomBar: { padding: 16, paddingBottom: 28 },
  startBtn: {
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  createBtn: { backgroundColor: '#0e3b28', borderWidth: 1.5, borderColor: colors.green, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
