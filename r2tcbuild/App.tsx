import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { registerForPush } from './src/logic/liveEvents';
import { markGroupFinished, fetchMyFinishedRounds, fetchAllFinishedRounds, buildFinishedRoundFromEvent, deleteLiveEvent, fetchMessages } from './src/logic/liveEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ScorecardScreen from './src/screens/ScorecardScreen';
import ScoringScreen from './src/screens/ScoringScreen';
import SetupScreen from './src/screens/SetupScreen';
import GpsScreen from './src/screens/GpsScreen';
import FixturesScreen from './src/screens/FixturesScreen';
import UpcomingRoundsScreen from './src/screens/UpcomingRoundsScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import LiveScreen from './src/screens/LiveScreen';
import LiveLeaderboard from './src/screens/LiveLeaderboard';
import ChatScreen from './src/screens/ChatScreen';
import PastRoundsScreen from './src/screens/PastRoundsScreen';
import TourHistoryScreen from './src/screens/TourHistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AccountScreen from './src/screens/AccountScreen';
import AuthGateScreen from './src/screens/AuthGateScreen';
import CourseRecordsScreen from './src/screens/CourseRecordsScreen';
import { ADMIN_EMAILS } from './src/config';
import {
  loadActiveRound,
  loadRounds,
  saveActiveRound,
  saveRounds,
} from './src/storage';
import { getSession, getProfile, pushRound, deleteRemoteRound } from './src/logic/supabase';
import { pushLiveScores, createLiveEvent, buildRoundFromEvent, buildFullRoundFromEvent, findMyGroupIndex, getEvent, updateEventConfig } from './src/logic/liveEvents';
import { colors } from './src/theme';
import { Round } from './src/types';

type Screen =
  | 'home'
  | 'setup'
  | 'round'
  | 'history'
  | 'fixtures'
  | 'marketplace'
  | 'messages'
  | 'live'
  | 'pastrounds'
  | 'tourhistory'
  | 'profile'
  | 'reviews'
  | 'upcoming'
  | 'gallery'
  | 'records'
  | 'eventsinfo';
type RoundTab = 'score' | 'gps' | 'leaderboard' | 'scorecard' | 'chat' | 'settings';

function AppMain() {
  const [screen, setScreen] = useState<Screen>('home');
  const [dmTarget, setDmTarget] = useState<{ email: string; name: string; itemTitle?: string; itemImage?: string | null } | null>(null);
  const resolveMyGroupIndex = async (ev: any) => {
    try {
      const s = await getSession();
      if (!s) return 0;
      const prof: any = await getProfile(s);
      const groups = (ev && ev.config && ev.config.groups) || [];
      const myId = prof && prof.id;
      const myName = prof ? ((prof.first_name || '') + ' ' + (prof.surname || '')).trim().toLowerCase() : '';
      const gi = groups.findIndex((g: any[]) => (g || []).some((p: any) => (myId && p.id === myId) || (myName && String(p.name || '').trim().toLowerCase() === myName)));
      return gi >= 0 ? gi : 0;
    } catch { return 0; }
  };
  const refreshActiveRoundFromCloud = async () => {
    try {
      const eid = activeRound && activeRound.liveEventId;
      if (!eid) return;
      const ev: any = await getEvent(eid);
      if (!ev) return;
      const gi = await resolveMyGroupIndex(ev);
      const scoped: any = buildRoundFromEvent(ev, gi);
      const oldById: any = {};
      ((activeRound && activeRound.players) || []).forEach((p: any) => { oldById[p.id] = p.scores; });
      scoped.players = (scoped.players || []).map((p: any) => (oldById[p.id] ? { ...p, scores: oldById[p.id] } : p));
      const merged: any = { ...scoped, liveEventId: ev.id, creatorEmail: (activeRound as any).creatorEmail, createdHere: (activeRound as any).createdHere };
      setActiveRound(merged);
      saveActiveRound(merged);
    } catch (e) {}
  };
  const [roundTab, setRoundTab] = useState<RoundTab>('score');
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [endPrompted, setEndPrompted] = useState(false);
  const [editFullRound, setEditFullRound] = useState<Round | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [spectateIsSocial, setSpectateIsSocial] = useState(false);
  const [pastScope, setPastScope] = useState<'all' | 'r2tc'>('all');
  const [chatUnread, setChatUnread] = useState(false);
  const chatSeenRef = useRef<number>(0);
  useEffect(() => {
    const evId: any = activeRound && (activeRound as any).liveEventId;
    if (!evId) { setChatUnread(false); return; }
    let alive = true;
    const check = async () => {
      try {
        const msgs: any = await fetchMessages(evId);
        if (!alive || !msgs || !msgs.length) return;
        const latest = Math.max.apply(null, msgs.map((m: any) => new Date(m.created_at).getTime() || 0));
        if (roundTab === 'chat') { chatSeenRef.current = latest; setChatUnread(false); }
        else if (chatSeenRef.current === 0) { chatSeenRef.current = latest; }
        else if (latest > chatSeenRef.current) { setChatUnread(true); }
      } catch (e) {}
    };
    check();
    const id = setInterval(check, 8000);
    return () => { alive = false; clearInterval(id); };
  }, [activeRound, roundTab]);
  const onDeleteRound = (r: any) => { Alert.alert('Delete event', 'Permanently delete "' + (r.name || 'this event') + '" and its scores? This cannot be undone.', [ { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { if (r.liveEventId) await deleteLiveEvent(r.liveEventId); setRounds((prev: any) => { const _n = (prev || []).filter((x: any) => x.id !== r.id); saveRounds(_n); return _n; }); try { await deleteRemoteRound(r); } catch (e8) {}; } catch (e) {} } } ]); };
  const [historyRound, setHistoryRound] = useState<Round | null>(null);
  const [historyFrom, setHistoryFrom] = useState<Screen>('pastrounds');
  const [historyTab, setHistoryTab] = useState<'leaderboard' | 'scorecard' | 'settings'>(
    'leaderboard',
  );
  const [loaded, setLoaded] = useState(false);
  const [meEmail, setMeEmail] = useState('');
  const [spectateRound, setSpectateRound] = useState<any>(null);
  const [spectateTab, setSpectateTab] = useState<'leaderboard' | 'chat' | 'settings'>('leaderboard');
  const [endedEvents, setEndedEvents] = useState<string[]>([]);
  const [meName, setMeName] = useState('');

  useEffect(() => {
    getSession().then((s: any) => { const em = s && s.email ? s.email : ''; setMeEmail(em); if (em) registerForPush(em); });
    getProfile().then((p: any) => { const nm = p ? ((p.first_name || '') + ' ' + (p.surname || '')).trim() : ''; setMeName(nm); if (nm) syncFinishedRounds(nm); });
  }, [])

  useEffect(() => {
    if (!meEmail) { setEndedEvents([]); return; }
    AsyncStorage.getItem('r2tc.endedEvents.' + meEmail.toLowerCase()).then((v: any) => { try { setEndedEvents(JSON.parse(v || '[]')); } catch (e) { setEndedEvents([]); } });
  }, [meEmail]);

  useEffect(() => {
    const sync = async () => {
      try { const s: any = await getSession(); const em = s && s.email ? String(s.email) : ''; setMeEmail((prev) => (prev === em ? prev : em)); } catch (e) {}
    };
    sync();
    const id = setInterval(sync, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const [active, history] = await Promise.all([
        loadActiveRound(),
        loadRounds(),
      ]);
      setActiveRound(active);
      setRounds(history);
      setLoaded(true);
    })();
  }, []);

  const updateRound = (round: Round) => {
    setActiveRound(round);
    saveActiveRound(round); // fire-and-forget persistence
    if (round.liveEventId) pushLiveScores(round);
  };

  const startRound = async (round: Round, goLive: boolean = true) => {
    let r: any = { ...round, createdHere: !round.liveEventId };
    if (!r.liveEventId) {
      try {
        const s = await getSession();
        if (s) {
          const ev = await createLiveEvent(r.name, r.courseName, {
            holes: r.holes,
            holeNumbers: r.holeNumbers,
            date: r.date,
            format: r.primaryFormat,
            formatSettings: r.formatSettings || {},
            teams: r.teams || [],
            created_by_email: s && (s as any).email ? (s as any).email : null,
          roundType: r.roundType || 'r2tc',
            contests: r.contests,
            groups: (r.groups || []).map((ids) =>
              ids.map((id) => {
                const p = r.players.find((pp) => pp.id === id);
                return { id, name: p ? p.name : id, handicap: p ? p.handicap : 0 };
              }),
            ),
          });
          if (ev) {
            const gi = await resolveMyGroupIndex(ev);
            const scoped = buildRoundFromEvent(ev, gi >= 0 ? gi : 0);
            r = { ...scoped, liveEventId: ev.id, creatorEmail: (s as any).email || undefined, createdHere: true };
          }
        }
      } catch (e) {}
    }
    if (!goLive) { setScreen('upcoming'); return; }
    setActiveRound(r);
    saveActiveRound(r);
    if (r.liveEventId) pushLiveScores(r);
    setRoundTab('score');
    setScreen('round');
  };

  const uploadRound = async (finished: Round) => {
    try {
      const session = await getSession();
      if (!session) {
        Alert.alert(
          'Saved on this phone',
          'Sign in on the home screen to upload rounds to the tour leaderboards.',
        );
        return;
      }
      await pushRound(finished);
      Alert.alert('Round uploaded', 'Tour leaderboards have been updated.');
    } catch (e: any) {
      Alert.alert(
        'Upload failed',
        `${e.message ?? e} The round is still saved on this phone.`,
      );
    }
  };

  const applySetupEdit = async (round: Round) => {
    const eventId = activeRound && activeRound.liveEventId;
    if (!eventId) { setRoundTab('score'); return; }
    const newGroups = (round.groups || []).map((ids) =>
      ids.map((id) => { const p = round.players.find((pp) => pp.id === id); return { id, name: p ? p.name : id, handicap: p ? p.handicap : 0 }; }),
    );
    try {
      await updateEventConfig(eventId, { groups: newGroups, holes: round.holes, holeNumbers: round.holeNumbers, format: round.primaryFormat });
      const ev: any = await getEvent(eventId);
      if (ev) {
        const gi = await resolveMyGroupIndex(ev);
        const scoped = buildRoundFromEvent(ev, gi >= 0 ? gi : 0);
        const oldById: any = {};
        ((activeRound && activeRound.players) || []).forEach((p: any) => { oldById[p.id] = p.scores; });
        const players = scoped.players.map((p: any) => (oldById[p.id] ? { ...p, scores: oldById[p.id] } : p));
        const merged: any = { ...scoped, players, liveEventId: eventId, creatorEmail: (activeRound as any).creatorEmail, createdHere: (activeRound as any).createdHere };
        setActiveRound(merged); saveActiveRound(merged); pushLiveScores(merged);
      }
    } catch (e) {}
    setEditFullRound(null);
    setRoundTab('score');
  };

  const [allRounds, setAllRounds] = useState<any[]>([]);
  const syncFinishedRounds = async (nm?: string) => {
    fetchAllFinishedRounds().then((a: any) => setAllRounds(a)).catch(() => {});
    const name = nm || meName;
    if (!name) return;
    try {
      const fin = await fetchMyFinishedRounds(name);
      if (!fin.length) return;
      setRounds((prev: any) => {
        // Refresh contest results on rounds we already have (older syncs
        // cached them before contests came across), then add new ones.
        const byEid: any = {};
        fin.forEach((r: any) => { if (r.liveEventId) byEid[r.liveEventId] = r; });
        let changed = false;
        const merged = (prev || []).map((r: any) => {
          const f = r.liveEventId ? byEid[r.liveEventId] : null;
          if (f) {
            const differs =
              f.name !== r.name ||
              (f.players || []).length !== (r.players || []).length ||
              (f.contestResults || []).length !== (r.contestResults || []).length;
            if (differs) { changed = true; return f; }
          }
          return r;
        });
        const haveIds = new Set(merged.filter((r: any) => r.liveEventId).map((r: any) => r.liveEventId));
        const add = fin.filter((r: any) => r.liveEventId && !haveIds.has(r.liveEventId));
        if (!add.length && !changed) return prev;
        const next = [...add, ...merged];
        saveRounds(next);
        return next;
      });
    } catch (e) {}
  };

  const endGame = () => {
    if (!activeRound) return;
    Alert.alert('Match finished', 'Everyone in your group has played all their holes. End game and save it to history?', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'End game',
        style: 'destructive',
        onPress: () => {
          const ar: any = activeRound;
          if (ar.liveEventId) {
            uploadRound({ ...ar, status: 'finished' });
            (async () => {
              try {
                const ev = await getEvent(ar.liveEventId);
                const gi = (typeof ar.liveGroupNo === 'number' && ar.liveGroupNo > 0) ? (ar.liveGroupNo - 1) : (ev ? await resolveMyGroupIndex(ev) : 0);
                await markGroupFinished(ar.liveEventId, gi);
              } catch (e) {}
              try {
                const next = endedEvents.indexOf(ar.liveEventId) === -1 ? [...endedEvents, ar.liveEventId] : endedEvents;
                setEndedEvents(next);
                AsyncStorage.setItem('r2tc.endedEvents.' + (meEmail || '').toLowerCase(), JSON.stringify(next));
              } catch (e) {}
              setTimeout(() => { syncFinishedRounds(); }, 1500);
            })();
            setActiveRound(null);
            saveActiveRound(null);
            setScreen('home');
          } else {
            const finished: Round = { ...activeRound, status: 'finished' };
            const nextRounds = [finished, ...rounds];
            setRounds(nextRounds);
            saveRounds(nextRounds);
            setActiveRound(null);
            saveActiveRound(null);
            setScreen('home');
            uploadRound(finished);
          }
        },
      },
    ]);
  };

  const roundDone = (r: any) => {
    if (!r || !Array.isArray(r.players) || r.players.length === 0) return false;
    const need = Array.isArray(r.holeNumbers)
      ? r.holeNumbers.length
      : Array.isArray(r.holes)
      ? r.holes.length
      : 18;
    return r.players.every(
      (p: any) =>
        Array.isArray(p.scores) &&
        p.scores.slice(0, need).filter((s: any) => s != null).length >= need,
    );
  };
  useEffect(() => {
    if (!activeRound) {
      if (endPrompted) setEndPrompted(false);
      return;
    }
    if (!endPrompted && roundDone(activeRound)) {
      setEndPrompted(true);
      endGame();
    }
  }, [activeRound, endPrompted]);

  if (!loaded) {
    return (
      <View style={[styles.app, styles.center]}>
        <Text style={styles.loading}>R2TC TOUR</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  const adminList = ADMIN_EMAILS.map((e) => e.toLowerCase());
  const isCreator =
    !!activeRound &&
    ((!!activeRound.creatorEmail &&
        !!meEmail &&
        activeRound.creatorEmail.toLowerCase() === meEmail.toLowerCase()) ||
      adminList.includes((meEmail || '').toLowerCase()));

  const allScoresIn = !!activeRound && Array.isArray((activeRound as any).players) && (activeRound as any).players.length > 0 && (activeRound as any).players.every((p: any) => Array.isArray(p.scores) && p.scores.length > 0 && p.scores.every((s: any) => s !== null && s !== undefined && s !== ''));
  const spectateCanEdit = !!spectateRound && ((!!spectateRound.creatorEmail && !!meEmail && String(spectateRound.creatorEmail).toLowerCase() === meEmail.toLowerCase()) || adminList.includes((meEmail || '').toLowerCase()));
  const historyCanEdit = !!historyRound && !!(historyRound as any).liveEventId && ((!!(historyRound as any).creatorEmail && !!meEmail && String((historyRound as any).creatorEmail).toLowerCase() === meEmail.toLowerCase()) || adminList.includes((meEmail || '').toLowerCase()));

  let body: React.ReactNode;
  if (screen === 'setup') {
    body = (
      <SetupScreen onCancel={() => setScreen('home')} onStart={startRound} onCreate={(r) => startRound(r, false)} />
    );
  } else if (screen === 'fixtures') {
    body = <FixturesScreen onBack={() => setScreen('home')} />;
  } else if (screen === 'marketplace') {
    body = <MarketplaceScreen
        onBack={() => setScreen('home')}
        meEmail={meEmail}
        onMessageSeller={(email, name, title, image) => { setDmTarget({ email, name, itemTitle: title, itemImage: image }); setScreen('messages'); }}
        onOpenInbox={() => { setDmTarget(null); setScreen('messages'); }}
      />;
  } else if (screen === 'messages') {
    body = (
      <MessagesScreen
        onBack={() => setScreen('home')}
        meEmail={meEmail}
        initialThread={dmTarget}
        onClearInitial={() => setDmTarget(null)}
      />
    );
  } else if (screen === 'upcoming') {
    body = <UpcomingRoundsScreen onBack={() => setScreen('home')} isAdmin={!!meEmail && ADMIN_EMAILS.map((e: string) => e.toLowerCase()).includes(meEmail.toLowerCase())} />;
  } else if (screen === 'gallery') {
    body = <GalleryScreen onBack={() => setScreen('home')} />;
  } else if (screen === 'live') {
    body = (
      <LiveScreen
        onBack={() => setScreen('home')}
        onScoreGroup={(round) => startRound(round)}
      />
    );
  } else if (screen === 'profile') {
    body = <ProfileScreen onBack={() => setScreen('home')} />;
  } else if (screen === 'reviews') {
    body = (
      <ProfileScreen
        onBack={() => setScreen('home')}
        url="https://www.r2tctour.com/golf-course-reviews"
        title="COURSE REVIEWS"
      />
    );
  } else if (screen === 'records') {
    body = <CourseRecordsScreen onBack={() => setScreen('home')} />;
  } else if (screen === 'eventsinfo') {
    body = (
      <ProfileScreen
        onBack={() => setScreen('home')}
        url="https://www.r2tctour.com/events"
        title="EVENTS & TRIPS"
      />
    );
  } else if (screen === 'account') {
    body = (
      <AccountScreen
        onBack={() => setScreen('home')}
        onPrivacy={() => setScreen('privacy')}
        onTerms={() => setScreen('terms')}
      />
    );
  } else if (screen === 'privacy') {
    body = (
      <ProfileScreen
        onBack={() => setScreen('account')}
        url="https://www.r2tctour.com/privacy"
        title="PRIVACY POLICY"
      />
    );
  } else if (screen === 'terms') {
    body = (
      <ProfileScreen
        onBack={() => setScreen('account')}
        url="https://www.r2tctour.com/terms"
        title="TERMS OF USE"
      />
    );
  } else if (screen === 'pastrounds') {
    body = (
      <PastRoundsScreen
        rounds={pastScope === 'r2tc' ? allRounds.filter((r: any) => ((r.roundType || 'r2tc') !== 'social')) : rounds}
          isAdmin={!!meEmail && ADMIN_EMAILS.map((e: string) => e.toLowerCase()).includes(meEmail.toLowerCase())}
          onDelete={onDeleteRound}
        onBack={() => setScreen('home')}
        onView={(r) => { setHistoryFrom('pastrounds');
          setHistoryRound(r);
          setHistoryTab('leaderboard');
          setScreen('history');
        }}
      />
    );
  } else if (screen === 'tourhistory') {
    body = <TourHistoryScreen onBack={() => setScreen('home')} />;
  } else if (screen === 'history' && historyRound) {
    body = (
      <View style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => setScreen(historyFrom)} style={styles.backFab} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backFabText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {historyTab === 'scorecard' ? (
            <ScorecardScreen round={historyRound} />
          ) : historyTab === 'settings' && historyCanEdit ? (
            <SettingsScreen round={historyRound as any} onClose={async () => { try { const ev = await getEvent((historyRound as any).liveEventId); if (ev) { const fr = await buildFinishedRoundFromEvent(ev); setHistoryRound(fr as any); } } catch (e) {} setHistoryTab('leaderboard'); }} />
          ) : (
            <LeaderboardScreen round={historyRound} isAdmin={ADMIN_EMAILS.map((e) => e.toLowerCase()).includes((meEmail || '').toLowerCase())} onRefresh={async () => { try { const ev = await getEvent((historyRound as any).liveEventId); if (ev) { const fr: any = await buildFinishedRoundFromEvent(ev); setHistoryRound(fr as any); setRounds((prev: any) => { const next = (prev || []).map((x: any) => (x.liveEventId && x.liveEventId === fr.liveEventId ? { ...fr, roundType: x.roundType || fr.roundType } : x)); saveRounds(next); return next; }); } } catch (e) {} }} />
          )}
        </View>
        <View style={styles.tabBar}>
          <TabButton
            label="Leaderboard"
            active={historyTab === 'leaderboard'}
            onPress={() => setHistoryTab('leaderboard')}
          />
          <TabButton
            label="Cards"
            active={historyTab === 'scorecard'}
            onPress={() => setHistoryTab('scorecard')}
          />
          {historyCanEdit ? (
            <TabButton
              label="Settings"
              active={historyTab === 'settings'}
              onPress={() => setHistoryTab('settings')}
            />
          ) : null}
          <TabButton
            label="Home"
            active={false}
            onPress={() => setScreen('home')}
          />
        </View>
      </View>
    );
  } else if (screen === 'spectate' && spectateRound) {
    body = (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: '#0b3d2e' }}>
          <TouchableOpacity onPress={() => { setScreen('home'); setSpectateRound(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', width: 60 }}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' }} numberOfLines={1}>{spectateRound.name} · LIVE</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1 }}>
          {!spectateIsSocial && spectateTab === 'chat' ? (
            <ChatScreen round={spectateRound} />
          ) : !spectateIsSocial && spectateTab === 'settings' && spectateCanEdit ? (
            <SettingsScreen round={spectateRound} onClose={async () => { try { const ev = await getEvent(spectateRound.liveEventId); if (ev) setSpectateRound(buildFullRoundFromEvent(ev)); } catch (e) {} setSpectateTab('leaderboard'); }} />
          ) : (
            <LiveLeaderboard round={spectateRound} />
          )}
        </View>
        <View style={styles.tabBar}>
          <TabButton label="Home" active={false} onPress={() => { setScreen('home'); setSpectateRound(null); }} />
          <TabButton label="Leaderboard" active={spectateTab === 'leaderboard'} onPress={() => setSpectateTab('leaderboard')} />
          {!spectateIsSocial && <TabButton label="Chat" active={spectateTab === 'chat'} onPress={() => setSpectateTab('chat')} />}
          {!spectateIsSocial && spectateCanEdit ? (
            <TabButton label="Settings" active={spectateTab === 'settings'} onPress={() => setSpectateTab('settings')} />
          ) : null}
        </View>
      </View>
    );
  } else if (screen === 'round' && activeRound) {
    body = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {roundTab === 'score' ? (
            <ScoringScreen round={activeRound} onUpdate={updateRound} />
          ) : roundTab === 'gps' ? (
            <GpsScreen round={activeRound} onBack={() => setRoundTab('score')} />
          ) : roundTab === 'chat' ? (
            <ChatScreen round={activeRound} />
          ) : roundTab === 'settings' ? (
            <SettingsScreen round={activeRound} onClose={async () => { await refreshActiveRoundFromCloud(); setRoundTab('score'); }} />
          ) : activeRound.liveEventId ? (
            <LiveLeaderboard round={activeRound} />
          ) : (
            <LeaderboardScreen round={activeRound} />
          )}
        </View>
        {roundTab === 'leaderboard' && allScoresIn ? (
          <TouchableOpacity style={styles.endBtn} onPress={endGame}>
            <Text style={styles.endBtnText}>🏁 End game & save to history</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.tabBar}>
          <TabButton
            label="Home"
            active={false}
            onPress={() => setScreen('home')}
          />
          <TabButton
            label="Score"
            active={roundTab === 'score'}
            onPress={() => { setRoundTab('score'); refreshActiveRoundFromCloud(); }}
          />
          <TabButton
            label="GPS"
            active={roundTab === 'gps'}
            onPress={() => setRoundTab('gps')}
          />
          <TabButton
            label="Leaderboard"
            active={roundTab === 'leaderboard'}
            onPress={() => setRoundTab('leaderboard')}
          />
          {activeRound.liveEventId ? (
            <TabButton
              label="Chat"
              active={roundTab === 'chat'}
              onPress={() => setRoundTab('chat')}
              badge={chatUnread}
            />
          ) : null}
          {isCreator ? (
            <TabButton
              label="Settings"
              active={roundTab === 'settings'}
              onPress={() => setRoundTab('settings')}
            />
          ) : null}
        </View>
      </View>
    );
  } else {
    body = (
      <HomeScreen
        activeRound={activeRound}
        meEmail={meEmail}
        recentRounds={rounds}
        onStartRound={() => setScreen('setup')}
        onDeleteRound={() => {
          setActiveRound(null);
          saveActiveRound(null);
        }}
        onResumeRound={() => {
          getSession().then((s: any) => setMeEmail(s && s.email ? String(s.email) : ''));
          setRoundTab('score');
          setScreen('round');
        }}
        onViewRound={(r) => { setHistoryFrom('home');
          setHistoryRound(r);
          setHistoryTab('leaderboard');
          setScreen('history');
        }}
        onOpenFixtures={() => setScreen('fixtures')}
        onOpenUpcoming={() => setScreen('upcoming')}
        onOpenGallery={() => setScreen('gallery')}
        onOpenMarketplace={() => setScreen('marketplace')}
          onOpenAccount={() => setScreen('account')}
        onOpenLive={() => setScreen('live')}
        onOpenPastRounds={(scope?: any) => { setPastScope(scope === 'r2tc' ? 'r2tc' : 'all'); setScreen('pastrounds'); }}
        onOpenHistory={() => setScreen('tourhistory')}
        onOpenProfile={() => setScreen('profile')}
            onOpenRound={(eid: string) => { const r = allRounds.find((x: any) => x && x.id === eid); if (r) { setHistoryFrom('home'); setHistoryRound(r); setHistoryTab('scorecard'); setScreen('history'); } }}
        onOpenMessages={() => { setDmTarget(null); setScreen('messages'); }}
        onOpenReviews={() => setScreen('reviews')}
        onOpenRecords={() => setScreen('records')}
        onOpenEvents={() => setScreen('eventsinfo')}
        onOpenEvent={(round) => { getSession().then((s: any) => setMeEmail(s && s.email ? String(s.email) : '')); startRound(round); }}
        onWatchEvent={(ev) => { getSession().then((s: any) => setMeEmail(s && s.email ? String(s.email) : '')); setSpectateRound(buildFullRoundFromEvent(ev)); setSpectateIsSocial(!!((ev as any) && (ev as any).config && (ev as any).config.roundType === 'social')); setScreen('spectate'); }}
        endedEvents={endedEvents}
      />
    );
  }

  return (
    <View style={styles.app}>
      {body}
      <StatusBar style="light" />
    </View>
  );
}

const TAB_ICONS: any = { Home: '🏠', Score: '✏️', GPS: '📍', Leaderboard: '🏆', Chat: '💬', Settings: '⚙️', Cards: '🗒️' };
function TabButton({
  label,
  active,
  onPress,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{TAB_ICONS[label] || '•'}</Text>
      <Text
        style={[styles.tabLabel, active && styles.tabLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
      {active ? <View style={styles.tabDot} /> : null}
      {badge ? <View style={styles.tabBadge} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bgDark },
  center: { alignItems: 'center', justifyContent: 'center' },
  loading: {
    color: colors.textOnDark,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#11150F',
    paddingBottom: 60,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  endBtn: { marginHorizontal: 14, marginBottom: 8, backgroundColor: '#1E5631', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  endBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  tabBtn: { flex: 1, alignItems: 'center', paddingHorizontal: 2, paddingVertical: 4 },
  tabIcon: { fontSize: 24, marginBottom: 3 },
  tabIconActive: {},
  tabLabel: { color: '#8FA096', fontSize: 12, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  tabLabelActive: { color: colors.green },
  tabBadge: { position: 'absolute', top: 2, right: '30%', width: 9, height: 9, borderRadius: 5, backgroundColor: '#E5484D' },
  backFab: { position: 'absolute', top: 46, left: 10, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  backFabText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.green,
    marginTop: 3,
  },
});


const BOOT_IMG = require('./assets/boot.jpg');

export default function App() {
  const [bootVisible, setBootVisible] = useState(true);
  // Auth gate: locked out until signed in; stays signed in until sign-out.
  const [authState, setAuthState] = useState<'checking' | 'out' | 'in'>('checking');
  useEffect(() => {
    const t = setTimeout(() => setBootVisible(false), 2500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let alive = true;
    const check = () => {
      getSession()
        .then((s: any) => { if (alive) setAuthState(s && s.email ? 'in' : 'out'); })
        .catch(() => { if (alive) setAuthState('out'); });
    };
    check();
    const id = setInterval(check, 2500);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      {authState === 'in' ? (
        <AppMain />
      ) : (
        <AuthGateScreen
          bootImage={BOOT_IMG}
          checking={authState === 'checking'}
          onSignedIn={() => setAuthState('in')}
        />
      )}
      {bootVisible ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0b3d1f', zIndex: 999 }}>
          <Image source={BOOT_IMG} style={{ flex: 1, width: '100%', height: '100%' }} resizeMode="contain" />
        </View>
      ) : null}
    </View>
  );
}
