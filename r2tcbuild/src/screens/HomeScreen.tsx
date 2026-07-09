import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReportMenu from '../components/ReportMenu';
import { Alert as RNAlert, Linking as RNLinking } from 'react-native';
import * as ExpoUpdates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { deleteMyAccount as doDeleteAccount, signOut as doSignOut } from '../logic/supabase';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';
import { SEASON, TOUR_NAME, ADMIN_EMAILS } from '../config';
import { fetchTourLeaderboards, fetchPlayerLongestDriveRecord } from '../logic/sheets';
import {
  getProfile,
  getSession,
  saveProfileExtras,
  Profile,
  Session,
  signInWithPassword,
  signOut,
  signUp,
  updateEmail,
  updatePassword,
  requestPasswordReset,
  resetPasswordWithCode,
  fetchAllPlayers,
} from '../logic/supabase';
import { fetchHandicapForGolfId, fetchHandicapByName, cleanLeaderName } from '../logic/sheets';
import { holeResults } from '../logic/scoring';
import {
  listOpenEvents,
  fetchFinishedEvents,
  LiveEvent,
  findMyGroupIndex,
  buildRoundFromEvent,
  finishLiveEvent,
  deleteLiveEvent,
  fetchPosts,
  createPost,
  FeedPost,
  fetchPlayerContestRecords,
  uploadMedia,
  deletePost,
  fetchReactions,
  setReaction,
  removeReaction,
} from '../logic/liveEvents';
import * as ImagePicker from 'expo-image-picker';
import PlayerProfileModal from './PlayerProfileModal';
import { fetchMyMessages } from '../logic/liveEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode } from 'expo-av';
import { colors, radius } from '../theme';
import Svg, { Defs, Rect, Circle, LinearGradient as SvgLG, RadialGradient as SvgRG, Stop } from 'react-native-svg';
import { Round, TourLeaderboardRow, TourLeaderboards } from '../types';

const LOGO_URL = 'https://static.wixstatic.com/media/f56536_a054d2de22284c2586b610a7ef78b3bc~mv2.png/v1/fill/w_200,h_200,al_c,q_85,enc_auto/logo.png';
const HEADER_IMG = 'https://static.wixstatic.com/media/f56536_c4b4af2a981548cb98fefe41cf0f48a6~mv2.png/v1/fill/w_1200,h_680,al_c,q_80,enc_auto/header.png';
const HERO_IMG = 'https://static.wixstatic.com/media/f56536_43aa6393e8da463cb63013115ee5b624~mv2.png';

interface Props {
  activeRound: Round | null;
  recentRounds: Round[];
  onStartRound: () => void;
  onResumeRound: () => void;
  onDeleteRound: () => void;
  onViewRound: (round: Round) => void;
  onOpenFixtures: () => void;
  onOpenMarketplace: () => void;
  onOpenLive: () => void;
  onOpenEvent: (round: Round) => void;
  onWatchEvent: (ev: LiveEvent) => void;
  endedEvents: string[];
  onOpenPastRounds: () => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  onOpenRound?: (eventId: string) => void;
  onOpenMessages: () => void;
  onOpenReviews: () => void;
  onOpenRecords: () => void;
  onOpenEvents: () => void;
  onOpenUpcoming: () => void;
  onOpenGallery: () => void;
  meEmail: string;
}

function LeaderboardCard({
  title,
  rows,
  emptyText,
  onOpen,
  meName,
}: {
  title: string;
  rows: TourLeaderboardRow[];
  emptyText: string;
  onOpen?: () => void;
  meName?: string;
}) {
  const mine =
    meName && rows.length
      ? rows.find(
          (r) => cleanLeaderName(r.name) === cleanLeaderName(meName),
        )
      : null;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onOpen}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardLink}>Full leaderboard ›</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : mine ? (
        <View style={[styles.row, styles.rowMe]}>
          <Text style={styles.rank}>{mine.rank}</Text>
          <View style={styles.rowMain}>
            <Text style={styles.rowName} numberOfLines={1}>
              {mine.name}
            </Text>
            {mine.detail ? (
              <Text style={styles.rowDetail} numberOfLines={1}>
                {mine.detail}
              </Text>
            ) : null}
          </View>
          <Text style={styles.rowValue}>{mine.value}</Text>
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {meName
            ? "You're not on this leaderboard yet — tap to view all"
            : 'Tap to view the full leaderboard'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const REACTIONS: any[] = [['like','👍'],['heart','❤️'],['smile','😄'],['sad','😢'],['angry','😠'],['shocked','😮']];
function ReactionBar({ post, reactions, myEmail, onReact }: any) {
  const mine = (reactions || []).find((r: any) => r.post_id === post.id && String(r.email || '').toLowerCase() === myEmail);
  const counts: any = {};
  (reactions || []).forEach((r: any) => { if (r.post_id === post.id) counts[r.type] = (counts[r.type] || 0) + 1; });
  return (
    <View style={styles.reactBar}>
      {REACTIONS.map((rx: any) => {
        const key = rx[0]; const emo = rx[1];
        const active = !!(mine && mine.type === key);
        const c = counts[key] || 0;
        return (
          <TouchableOpacity key={key} style={[styles.reactBtn, active ? styles.reactBtnOn : null]} onPress={() => onReact(post, key)} activeOpacity={0.7}>
            <Text style={styles.reactEmo}>{emo}</Text>
            {c > 0 ? <Text style={[styles.reactCount, active ? styles.reactCountOn : null]}>{c}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function HomeScreen({
  activeRound,
  recentRounds,
  onStartRound,
  onResumeRound,
  onDeleteRound,
  onViewRound,
  onOpenFixtures,
  onOpenMarketplace,
  onOpenLive,
  onOpenEvent,
  onWatchEvent,
  endedEvents,
  onOpenPastRounds,
  onOpenHistory,
  onOpenProfile,
  onOpenRound,
  onOpenMessages,
  onOpenReviews,
  onOpenRecords,
  onOpenEvents,
  onOpenUpcoming,
  onOpenGallery,
  meEmail,
}: Props) {
  const [boards, setBoards] = useState<TourLeaderboards | null>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [viewPlayer, setViewPlayer] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [passwordText, setPasswordText] = useState('');
  const [firstNameText, setFirstNameText] = useState('');
  const [surnameText, setSurnameText] = useState('');
  const [handicapText, setHandicapText] = useState('');
  const [golfIdText, setGolfIdText] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gaHcp, setGaHcp] = useState<number | null>(null);
  useEffect(() => {
    const gid = profile && (profile as any).golf_id;
    const nm = profile ? (((profile as any).first_name || '') + ' ' + ((profile as any).surname || '')).trim() : '';
    const byName = () => { if (nm) { fetchHandicapByName(nm).then((h2) => setGaHcp(typeof h2 === 'number' ? h2 : null)); } else { setGaHcp(null); } };
    if (gid) { fetchHandicapForGolfId(gid).then((h) => { if (typeof h === 'number') setGaHcp(h); else byName(); }); } else { byName(); }
  }, [profile]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const refreshReactions = () => fetchReactions().then((rs: any) => setReactions(rs || []));
  const onReact = async (post: any, type: string) => {
    const em = String((session && (session as any).email) || meEmail || '').toLowerCase();
    if (!em) return;
    const mine = (reactions || []).find((r: any) => r.post_id === post.id && String(r.email || '').toLowerCase() === em);
    if (mine && mine.type === type) { await removeReaction(post.id, em); } else { await setReaction(post.id, em, type); }
    refreshReactions();
  };
  const [notifVisible, setNotifVisible] = useState(false);
  const [notifSeen, setNotifSeen] = useState(0);
  const [notifCleared, setNotifCleared] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  useEffect(() => {
    if (!meEmail) return;
    const loadUnread = () => fetchMyMessages(meEmail).then((ms) => {
      const meLc = String(meEmail).toLowerCase();
      setDmUnread((ms || []).filter((m) => String(m.to_email || '').toLowerCase() === meLc && !m.read).length);
    });
    loadUnread();
    const ti = setInterval(loadUnread, 8000);
    return () => clearInterval(ti);
  }, [meEmail]);
  useEffect(() => { AsyncStorage.getItem('r2tc.notifSeen').then((v) => { if (v) setNotifSeen(Number(v) || 0); }); AsyncStorage.getItem('r2tc.notifCleared').then((v) => { if (v) setNotifCleared(Number(v) || 0); }); }, []);
  const openNotifs = () => { setNotifVisible(true); const now = Date.now(); setNotifSeen(now); AsyncStorage.setItem('r2tc.notifSeen', String(now)); };
  const clearNotifs = () => { const now = Date.now(); setNotifCleared(now); setNotifSeen(now); AsyncStorage.setItem('r2tc.notifCleared', String(now)); AsyncStorage.setItem('r2tc.notifSeen', String(now)); };
  const [postText, setPostText] = useState('');
  const feedScrollRef = useRef<any>(null);
  const composerInputRef = useRef<any>(null);
  const [media, setMedia] = useState<{ uri: string; type: string; contentType: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [openBoard, setOpenBoard] = useState<{
    title: string;
    rows: TourLeaderboardRow[];
  } | null>(null);
  const [myPageVisible, setMyPageVisible] = useState(false);
  const [myGolfId, setMyGolfId] = useState('');
  const [glSaving, setGlSaving] = useState(false);
  const [glMsg, setGlMsg] = useState('');
  const [myGaHcp, setMyGaHcp] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [myEmail, setMyEmail] = useState('');
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myNewPass, setMyNewPass] = useState('');
  const [myBio, setMyBio] = useState('');
  const openSettings = () => {
    const gid = (profile && (profile as any).golf_id) || '';
    setMyGolfId(gid);
    setMyEmail((session && session.email) || '');
    setMyDisplayName((profile && (profile as any).name) || '');
    setMyBio((profile && (profile as any).bio) || '');
    setMyNewPass('');
    setMyGaHcp(null); setGlMsg('');
    if (gid) fetchHandicapForGolfId(gid).then(setMyGaHcp);
    setSettingsVisible(true);
  };
  const saveBio = async () => {
    setGlSaving(true); setGlMsg('');
    try {
      const s = await getSession();
      if (!s) { setGlMsg('Please sign in first.'); setGlSaving(false); return; }
      await saveProfileExtras(s, { bio: myBio.trim() } as any);
      const p = await getProfile();
      setProfile(p);
      setGlMsg('Bio updated.');
    } catch (e) { setGlMsg('Could not update bio.'); }
    setGlSaving(false);
  };
  const saveName = async () => {
    setGlSaving(true); setGlMsg('');
    try {
      const s = await getSession();
      if (!s) { setGlMsg('Please sign in first.'); setGlSaving(false); return; }
      await saveProfileExtras(s, { name: myDisplayName.trim() } as any);
      const p = await getProfile();
      setProfile(p);
      setGlMsg('Name updated.');
    } catch (e) { setGlMsg('Could not update name.'); }
    setGlSaving(false);
  };
  const savePassword = async () => {
    if (myNewPass.length < 6) { setGlMsg('Password must be at least 6 characters.'); return; }
    setGlSaving(true); setGlMsg('');
    try {
      const s = await getSession();
      if (!s) { setGlMsg('Please sign in first.'); setGlSaving(false); return; }
      await updatePassword(s, myNewPass);
      setMyNewPass('');
      setGlMsg('Password updated.');
    } catch (e) { setGlMsg('Could not update password.'); }
    setGlSaving(false);
  };
  const saveEmail = async () => {
    setGlSaving(true); setGlMsg('');
    try {
      const s = await getSession();
      if (!s) { setGlMsg('Please sign in first.'); setGlSaving(false); return; }
      await updateEmail(s, myEmail.trim());
      setGlMsg('Confirmation link sent to ' + myEmail.trim() + '. Check your inbox to confirm.');
    } catch (e) { setGlMsg('Could not update email — please try again.'); }
    setGlSaving(false);
  };
  const saveGolfId = async () => {
    setGlSaving(true); setGlMsg('');
    try {
      const s = await getSession();
      if (!s) { setGlMsg('Please sign in first.'); setGlSaving(false); return; }
      await saveProfileExtras(s, { golf_id: myGolfId.trim() });
      const p = await getProfile();
      setProfile(p);
      const h = await fetchHandicapForGolfId(myGolfId.trim());
      setMyGaHcp(h);
      setGlMsg(h != null ? ('Saved \u2713  GA handicap: ' + h) : 'Saved. No GA handicap found yet for that number (may be pending).');
    } catch (e) {
      setGlMsg('Could not save — please try again.');
    }
    setGlSaving(false);
  };
  const [myPhoto, setMyPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchTourLeaderboards();
      setBoards(data);
    } catch (e) {
      setBoards({ tourPoints: [], longestDrive: [], closestToPin: [], isSample: true } as any);
    }
  }, []);

  useEffect(() => {
    load();
    fetchAllPlayers().then(setAllPlayers);
    Promise.all([listOpenEvents(), fetchFinishedEvents()]).then(([o, f]) => setLiveEvents([...(o || []), ...(f || [])]));
    fetchPosts().then((ps) => setPosts((ps || []).filter((p) => !(p as any).featured)));
    refreshReactions();
    getSession().then((s) => {
      setSession(s);
      if (s) {
        getProfile().then(setProfile);
        if (s.email)
          AsyncStorage.getItem('avatar:' + s.email).then((v) => {
            if (v) setMyPhoto(v);
          });
      }
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resetAuthForm = () => {
    setPasswordText('');
    setFirstNameText('');
    setSurnameText('');
    setHandicapText('');
    setAuthMsg('');
  };

  const forgotPassword = async () => {
    if (!emailText.trim()) { setAuthMsg('Enter your email above first, then tap Forgot password.'); return; }
    setAuthBusy(true); setAuthMsg('');
    try {
      await requestPasswordReset(emailText);
      setResetSent(true);
      setAuthMsg('We emailed a 6-digit code. Enter it below with a new password.');
    } catch (e) {
      setAuthMsg('Could not send reset email. Check the address and try again.');
    }
    setAuthBusy(false);
  };
  const doReset = async () => {
    if (resetCode.trim().length < 4) { setAuthMsg('Enter the code from your email.'); return; }
    if (resetNewPass.length < 6) { setAuthMsg('New password must be at least 6 characters.'); return; }
    setAuthBusy(true); setAuthMsg('');
    try {
      const s = await resetPasswordWithCode(emailText, resetCode, resetNewPass);
      setSession(s);
      setProfile(await getProfile());
      setResetSent(false); setResetCode(''); setResetNewPass(''); setPasswordText('');
      setAuthVisible(false);
    } catch (e: any) {
      setAuthMsg((e && e.message) || 'Could not reset password. Check the code and try again.');
    }
    setAuthBusy(false);
  };
  const submitAuth = async () => {
    setAuthBusy(true);
    setAuthMsg('');
    try {
      if (authMode === 'register') {
        if (!firstNameText.trim() || !surnameText.trim()) {
          throw new Error('Please enter your first name and surname.');
        }
        if (passwordText.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const hcp = parseFloat(handicapText);
        const { session: s, needsConfirm } = await signUp(
          emailText,
          passwordText,
          firstNameText,
          surnameText,
          isNaN(hcp) ? 0 : hcp,
          golfIdText,
        );
        if (needsConfirm || !s) {
          setAuthMsg('Account created! Check your email to confirm, then sign in.');
          setAuthMode('login');
          setPasswordText('');
          return;
        }
        setSession(s);
        setProfile(await getProfile());
        setAuthVisible(false);
        resetAuthForm();
      } else {
        const s = await signInWithPassword(emailText, passwordText);
        setSession(s);
        setProfile(await getProfile());
        setAuthVisible(false);
        resetAuthForm();
      }
    } catch (e: any) {
      setAuthMsg(e.message ?? 'Something went wrong.');
    } finally {
      setAuthBusy(false);
    }
  };

  const onAccountPress = () => {
    if (!session) {
      setAuthMode('login');
      setAuthVisible(true);
      return;
    }
    const name =
      profile && (profile.first_name || profile.surname)
        ? `${profile.first_name} ${profile.surname}`.trim()
        : session.email;
    const detail =
      profile && typeof profile.handicap === 'number'
        ? `Handicap ${profile.handicap}  ·  ${session.email}`
        : session.email;
    Alert.alert(name, detail, [
      { text: 'Close', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setSession(null);
          setProfile(null);
        },
      },
    ]);
  };

  const meName =
    profile && (profile.first_name || profile.surname)
      ? `${profile.first_name} ${profile.surname}`.replace(/\s+/g, ' ').trim()
      : '';

  const initials =
    profile && (profile.first_name || profile.surname)
      ? `${(profile.first_name || ' ')[0]}${(profile.surname || ' ')[0]}`
          .trim()
          .toUpperCase()
      : '';

  const myPosts = posts.filter(
    (p) =>
      meName &&
      p.author.replace(/\s+/g, ' ').trim().toLowerCase() ===
        meName.toLowerCase(),
  );

  const [contestRecs, setContestRecs] = useState<{ ld: any; ctp: any }>({ ld: null, ctp: null });
  useEffect(() => { let alive = true; if (meName) { Promise.all([fetchPlayerContestRecords(meName), fetchPlayerLongestDriveRecord(meName).catch(() => null)]).then(([bb, sheetLd]: any[]) => { if (!alive) return; const base = bb || { ld: null, ctp: null }; let ld = base.ld; if (sheetLd && (!ld || sheetLd.metres > ld.metres)) { ld = { metres: sheetLd.metres, course: sheetLd.course, hole: sheetLd.hole, event: sheetLd.course, year: sheetLd.year }; } setContestRecs({ ld, ctp: base.ctp }); }).catch(() => { if (alive) setContestRecs({ ld: null, ctp: null }); }); } return () => { alive = false; }; }, [meName]);
  const myRoundTotals = (recentRounds || [])
    .filter((r) => r.status === 'finished')
    .map((r) => {
      const me = r.players.find(
        (p) =>
          p.name.replace(/\s+/g, ' ').trim().toLowerCase() ===
          meName.toLowerCase(),
      );
      if (!me) return null;
      const entered = me.scores.some((s) => typeof s === 'number');
      if (!entered) return null;
      const R2TC_TEAM_FMTS = ['scramble_stroke','tscramble_stroke','bb_stroke','bb_stableford','bb_match','tbb_stroke','tbb_stableford','scramble_match','foursome_match','greensome_match','bestball'];
      if (R2TC_TEAM_FMTS.indexOf((r as any).primaryFormat) !== -1) return null;
      const _needHoles = Array.isArray((r as any).holeNumbers) ? (r as any).holeNumbers.length : (Array.isArray((r as any).holes) ? (r as any).holes.length : 18);
      if (me.scores.filter((s) => typeof s === 'number').length < _needHoles) return null;
      const _exRec = ((r as any).excludeFromRecords || []).map((n: string) => String(n).toLowerCase());
      if (_exRec.indexOf(meName.toLowerCase()) !== -1) return null;
      const total = me.scores.reduce(
        (a, s) => a + (typeof s === 'number' ? s : 0),
        0,
      );
      let stbTotal = 0;
      try { stbTotal = holeResults(me as any, ((r as any).holes || []) as any).reduce((a: number, h: any) => a + (h.stableford || 0), 0); } catch (e2) {}
      return { date: r.date, total, stableford: stbTotal, round: r, holes: _needHoles };
    })
    .filter((x): x is { date: string; total: number; stableford: number; round: any; holes: number } => x !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const lastScore = myRoundTotals.length ? myRoundTotals[0].total : null;
  const my18 = (myRoundTotals as any[]).filter((x: any) => x.holes === 18);
  const avgScore = my18.length ? Math.round(my18.reduce((a: any, r: any) => a + r.total, 0) / my18.length) : null;
  const scoringAvgDec = my18.length ? (my18.reduce((a: any, r: any) => a + r.total, 0) / my18.length).toFixed(1) : null;
  const bestRound = my18.length ? Math.min(...my18.map((r: any) => r.total)) : null;
  const bestStableford = my18.length ? Math.max(...my18.map((r: any) => r.stableford)) : null;
  const bestStrokeRoundObj: any = my18.length ? (my18.reduce((bb: any, x: any) => (x.total < bb.total ? x : bb)) as any).round : null;
  const bestStablefordRoundObj: any = my18.length ? (my18.reduce((bb: any, x: any) => (x.stableford > bb.stableford ? x : bb)) as any).round : null;
  const roundsPlayed = myRoundTotals.length;
  const tourFriends = allPlayers.length;
  const myRankRow = (boards?.tourPoints ?? []).find(
    (r) =>
      cleanLeaderName(r.name) === cleanLeaderName(meName),
  );
  const tourRank = myRankRow ? myRankRow.rank : null;

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access to set your profile picture.',
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const url = await uploadMedia(res.assets[0].uri, 'image/jpeg');
    if (!url) {
      Alert.alert(
        'Upload failed',
        'Could not upload the photo — check the storage setup.',
      );
      return;
    }
    setMyPhoto(url);
    if (session?.email) AsyncStorage.setItem('avatar:' + session.email, url);
  };

  const isAdmin =
    !!session &&
    ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(
      (session.email || '').toLowerCase(),
    );
  // Today's rounds: every event dated today (scheduled ahead or created on
  // the day) - upcoming, in play or finished. Players in a group can open
  // and score; everyone else watches. Drops off the list at midnight.
  const isTodayEvent = (ev: LiveEvent) => {
    const dd = (ev.config && ev.config.date) || ev.created_at;
    if (!dd) return false;
    const d = new Date(dd);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };
  const todaysEvents = liveEvents
    .filter(isTodayEvent)
    .sort((a, b) => String((a.config && a.config.date) || a.created_at || '').localeCompare(String((b.config && b.config.date) || b.created_at || '')));

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a photo or video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.6,
    });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === 'video';
      if (isVideo && a.fileSize && a.fileSize > 49 * 1024 * 1024) { Alert.alert('Video too large', 'Videos must be under 50 MB to post on the tour feed. Try a shorter clip or record at a lower resolution.'); return; }
    setMedia({
      uri: a.uri,
      type: isVideo ? 'video' : 'image',
      contentType: isVideo ? 'video/mp4' : 'image/jpeg',
    });
  };

  const [composeOpen, setComposeOpen] = useState(false);
  const submitPost = async () => {
    const t = postText.trim();
    if (!t && !media) return;
    if (!meName) {
      Alert.alert('Sign in first', 'Sign in to post to the tour feed.');
      return;
    }
    setPosting(true);
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (media) {
      mediaUrl = await uploadMedia(media.uri, media.contentType);
      if (!mediaUrl) {
        setPosting(false);
        Alert.alert('Upload failed', media && media.type === 'video' ? 'Could not upload the video - it must be under 50 MB. Try a shorter clip.' : 'Could not upload the media - check the storage setup.');
        return;
      }
      mediaType = media.type;
    }
    const res = await createPost(meName, t, mediaUrl, mediaType);
    setPosting(false);
    if (res.ok) {
      setPostText('');
      setMedia(null);
      fetchPosts().then((ps) => setPosts((ps || []).filter((p) => !(p as any).featured)));
    refreshReactions();
    } else {
      Alert.alert('Could not post', res.error || 'Status ' + res.status);
    }
  };

  const removePost = (p: FeedPost) => {
    Alert.alert('Delete post', 'Delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deletePost(p.id);
          if (res.ok) { fetchPosts().then((ps) => setPosts((ps || []).filter((p) => !(p as any).featured))); refreshReactions(); }
          else Alert.alert('Could not delete', 'Status ' + res.status);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={feedScrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textOnDark}
          />
        }
      >
        <View style={styles.header}>
          <Image source={{ uri: HEADER_IMG }} style={styles.headerPhoto} resizeMode="cover" />
          <View style={styles.headerTint} />
          
          
          <View style={styles.headerRow}>
            <View style={styles.leftCol}>
            <View style={styles.brand}>
              <View style={styles.logoWrap}>
                <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.brandText}>
                <Text style={styles.tourName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{TOUR_NAME}</Text>
                <Text style={styles.tagline}>2014 – {SEASON} SEASON</Text>
              </View>
            </View>
            <View style={styles.iconCluster}>
              <TouchableOpacity style={styles.bellBtn} onPress={openNotifs}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
                {posts.some((p) => new Date(p.created_at).getTime() > notifSeen) ? <View style={styles.bellDot} /> : null}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bellBtn, { marginLeft: 6 }]} onPress={onOpenMessages}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
                {dmUnread > 0 ? <View style={styles.bellDot} /> : null}
              </TouchableOpacity>
            </View>
            </View>
            <View style={{ flex: 1 }} />
            {session ? (
              <TouchableOpacity
                style={styles.profileChip}
                onPress={() => { const gid = (profile && (profile as any).golf_id) || ''; setMyGolfId(gid); setMyGaHcp(null); if (gid) fetchHandicapForGolfId(gid).then(setMyGaHcp); setMyPageVisible(true); }}
              >
                <View style={styles.avatar}>
                  {myPhoto ? (
                    <Image source={{ uri: myPhoto }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>{initials || '⛳'}</Text>
                  )}
                </View>
                <View style={styles.profileMeta}>
                  <Text style={styles.profileName} numberOfLines={1}>{(profile && profile.first_name) || 'Player'}</Text>
                  <Text style={styles.profileHcp}>GA Handicap {gaHcp != null ? gaHcp : (profile && typeof profile.handicap === 'number' ? profile.handicap : '—')}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>Golf Link {(profile && (profile as any).golf_id) ? (profile as any).golf_id : '—'}</Text>
                  <Text style={styles.viewProfile}>View Profile ›</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.accountPill} onPress={onAccountPress}>
                <Text style={styles.accountPillText}>Sign up / sign in</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Modal visible={notifVisible} animationType="slide" transparent onRequestClose={() => setNotifVisible(false)}>
          <View style={styles.notifBackdrop}>
            <View style={styles.notifSheet}>
              <View style={styles.notifTop}>
                <Text style={styles.notifTitle}>Notifications</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={clearNotifs} style={{ marginRight: 18 }}><Text style={styles.notifClose}>Clear all</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setNotifVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={[styles.notifClose, { fontSize: 22 }]}>✕</Text></TouchableOpacity>
                </View>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {posts.filter((p) => new Date(p.created_at).getTime() > notifCleared).length === 0 ? (
                  <Text style={styles.notifEmpty}>No notifications yet. Tour activity shows up here.</Text>
                ) : (
                  posts.filter((p) => new Date(p.created_at).getTime() > notifCleared).slice(0, 30).map((p) => (
                    <View key={p.id} style={styles.notifRow}>
                      <Text style={styles.notifAuthor}>{p.author}</Text>
                      <Text style={styles.notifText} numberOfLines={2}>{p.text}</Text>
                      <Text style={styles.notifTime}>{(p.created_at || '').slice(0, 16).replace('T', ' ')}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.hero}>
          <Image source={{ uri: HERO_IMG }} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.heroScrim} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Ready to play?</Text>
            <Text style={styles.heroSub}>Join the {SEASON} season and compete across the tour.</Text>
            <TouchableOpacity style={styles.heroBtn} onPress={onStartRound}>
              <Text style={styles.heroBtnText}>⛳  Start a round</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenUpcoming}>
            <Text style={styles.linkEmoji}>🎯</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Upcoming Rounds</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => onOpenPastRounds('r2tc')}>
            <Text style={styles.linkEmoji}>📋</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Past Rounds</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenFixtures}>
            <Text style={styles.linkEmoji}>🗓️</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Fixtures</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenHistory}>
            <Text style={styles.linkEmoji}>🏆</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Tour History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenGallery}>
            <Text style={styles.linkEmoji}>🖼️</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Photos & Videos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenMarketplace}>
            <Text style={styles.linkEmoji}>🛒</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Marketplace</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenProfile}>
            <Text style={styles.linkEmoji}>👤</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Player Profiles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenReviews}>
            <Text style={styles.linkEmoji}>⭐</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Course Reviews</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenRecords}>
            <Text style={styles.linkEmoji}>🏅</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Course Records</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={onOpenEvents}>
            <Text style={styles.linkEmoji}>✈️</Text>
            <Text style={styles.linkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Events & Trips</Text>
          </TouchableOpacity>
        </View>

        {todaysEvents.length > 0 ? (
          <View style={styles.ongoingWrap}>
            <Text style={styles.ongoingHeading}>TODAY'S ROUNDS</Text>
            {todaysEvents.map((ev) => {
              const cfg = ev.config || {};
              const count = (cfg.groups || []).reduce(
                (a, g) => a + g.length,
                0,
              );
              const mine = findMyGroupIndex(ev, meName, profile ? profile.id : undefined);
              return (
                <View key={ev.id} style={styles.ongoingCard}>
                  <Text style={styles.ongoingTag}>
                    {ev.status === 'finished' ? 'FINAL' : (cfg.format ? String(cfg.format) : 'game').toUpperCase()}
                  </Text>
                  <Text style={styles.ongoingName}>{ev.name}</Text>
                  {ev.course_name ? (
                    <Text style={styles.ongoingSub}>{ev.course_name}</Text>
                  ) : null}
                  <Text style={styles.ongoingSub}>👥 {count} players</Text>
                  {cfg.date ? (
                    <Text style={styles.ongoingSub}>📅 {new Date(cfg.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{new Date(cfg.date).getTime() > Date.now() ? '  · Upcoming' : ''}</Text>
                  ) : null}
                  <View style={styles.ongoingBtns}>
                    <TouchableOpacity
                      style={styles.ongoingOpen}
                      onPress={() => {
                        if (ev.status === 'finished' || (!isAdmin && mine < 0)) { onWatchEvent(ev); return; }
                        const fin = (ev.config && ev.config.finishedGroups) || [];
                        const myGroupEnded = mine >= 0 && fin.indexOf(mine) !== -1;
                        if (myGroupEnded) { onWatchEvent(ev); return; }
                        if (activeRound && activeRound.liveEventId === ev.id) { onResumeRound(); return; }
                        onOpenEvent(buildRoundFromEvent(ev, mine >= 0 ? mine : 0));
                      }}
                    >
                      <Text style={styles.ongoingOpenText}>{ev.status === 'finished' ? 'Final results' : (isAdmin || mine >= 0) ? 'Open' : 'Watch live'}</Text>
                    </TouchableOpacity>
                    {(isAdmin || (cfg.created_by_email && meEmail && cfg.created_by_email.toLowerCase() === meEmail.toLowerCase())) ? (
                      <TouchableOpacity
                        style={styles.ongoingClose}
                        onPress={() =>
                          Alert.alert('Delete event', `Delete "${ev.name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () =>
                                deleteLiveEvent(ev.id).then((res) => {
                                  if (res.ok && res.deleted > 0) {
                                    Promise.all([listOpenEvents(), fetchFinishedEvents()]).then(([o, f]) => setLiveEvents([...(o || []), ...(f || [])]));
                                  } else {
                                    Alert.alert(
                                      'Could not delete',
                                      res.error ||
                                        'Status ' +
                                          res.status +
                                          ', ' +
                                          res.deleted +
                                          ' removed — delete permission may not be set.',
                                    );
                                  }
                                }),
                            },
                          ])
                        }
                      >
                        <Text style={styles.ongoingCloseText}>🗑</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {boards?.isSample ? (
          <View style={styles.sampleBanner}>
            <Text style={styles.sampleBannerText}>
              Showing sample data — finish and upload a round to go live
            </Text>
          </View>
        ) : null}

        <LeaderboardCard
          title={`${SEASON} TOUR POINTS`}
          rows={boards?.tourPoints ?? []}
          emptyText="Loading leaderboard…"
          meName={meName}
          onOpen={() =>
            setOpenBoard({
              title: `${SEASON} TOUR POINTS`,
              rows: boards?.tourPoints ?? [],
            })
          }
        />
        <LeaderboardCard
          title={`${SEASON} LONGEST DRIVE`}
          rows={boards?.longestDrive ?? []}
          emptyText="Loading leaderboard…"
          meName={meName}
          onOpen={() =>
            setOpenBoard({
              title: `${SEASON} LONGEST DRIVE`,
              rows: boards?.longestDrive ?? [],
            })
          }
        />
        <LeaderboardCard
          title={`${SEASON} CLOSEST TO THE PIN`}
          rows={boards?.closestToPin ?? []}
          emptyText="Loading leaderboard…"
          meName={meName}
          onOpen={() =>
            setOpenBoard({
              title: `${SEASON} CLOSEST TO THE PIN`,
              rows: boards?.closestToPin ?? [],
            })
          }
        />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>TOUR FEED</Text>
          </View>
          <View style={styles.feedCompose}>
            <TouchableOpacity style={styles.feedInput} activeOpacity={0.7} onPress={() => setComposeOpen(true)}>
              <Text numberOfLines={1} style={{ color: postText ? colors.text : colors.textMuted, fontSize: 14 }}>{postText ? postText : "Share something with the tour..."}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedMediaBtn} onPress={pickMedia}>
              <Text style={styles.feedMediaIcon}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.feedPostBtn}
              onPress={submitPost}
              disabled={posting}
            >
              <Text style={styles.feedPostText}>{posting ? '…' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
          <Modal visible={composeOpen} animationType="slide" onRequestClose={() => setComposeOpen(false)}>
            <View style={{ flex: 1, backgroundColor: "#FFFFFF", paddingTop: 48 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#ECECEC" }}>
                <TouchableOpacity onPress={() => setComposeOpen(false)}><Text style={{ color: "#6B7280", fontSize: 16 }}>Cancel</Text></TouchableOpacity>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <TouchableOpacity onPress={pickMedia}><Text style={{ color: "#2563EB", fontSize: 15, fontWeight: "600" }}>Photo</Text></TouchableOpacity>
                  <TouchableOpacity disabled={posting || !postText.trim()} onPress={async () => { await submitPost(); setComposeOpen(false); }} style={{ backgroundColor: "#22C55E", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8, opacity: (posting || !postText.trim()) ? 0.5 : 1 }}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>{posting ? "Posting" : "Post"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput style={{ flex: 1, color: "#111827", fontSize: 17, paddingHorizontal: 16, paddingTop: 14, textAlignVertical: "top" }} placeholder="Share something with the tour..." placeholderTextColor="#9CA3AF" value={postText} onChangeText={setPostText} multiline autoFocus />
            </View>
          </Modal>
          {media ? (
            <View style={styles.mediaPreview}>
              {media.type === 'image' ? (
                <Image source={{ uri: media.uri }} style={styles.previewImg} />
              ) : (
                <Text style={styles.previewVid}>📹 Video attached</Text>
              )}
              <TouchableOpacity onPress={() => setMedia(null)}>
                <Text style={styles.removeMedia}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {posts.length === 0 ? (
            <Text style={styles.emptyText}>No posts yet — be the first!</Text>
          ) : (
            posts.map((p) => (
              <View key={p.id} style={styles.feedItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.feedAuthor}>{p.author}</Text><ReportMenu contentType="feed_post" contentId={String(p.id)} authorName={p.author} /></View>
                {p.text ? <Text style={styles.feedBody}>{p.text}</Text> : null}
                {p.media_url ? (
                  p.media_type === 'video' ? (
                    <Video
                      source={{ uri: p.media_url }}
                      style={styles.feedMedia}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                    />
                  ) : (
                    <Image
                      source={{ uri: p.media_url }}
                      style={styles.feedMedia}
                      resizeMode="cover"
                    />
                  )
                ) : null}
                <ReactionBar post={p} reactions={reactions} myEmail={String((session && (session as any).email) || meEmail || '').toLowerCase()} onReact={onReact} />
                <View style={styles.feedFooter}>
                  <Text style={styles.feedTime}>
                    {new Date(p.created_at).toLocaleString()}
                  </Text>
                  {isAdmin || (meName && p.author.toLowerCase() === meName.toLowerCase()) ? (
                    <TouchableOpacity
                      onPress={() => removePost(p)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.feedDelete}>🗑</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {null}

        <Text style={styles.footer}>r2tctour.com</Text>
      </ScrollView>

      <Modal
        visible={authVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAuthVisible(false)}
      >
        <View style={styles.authWrap}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>
              {authMode === 'register' ? 'Join the R2TC Tour' : 'Sign in to R2TC Tour'}
            </Text>

            <View style={styles.authTabs}>
              <TouchableOpacity
                style={[styles.authTab, authMode === 'login' && styles.authTabActive]}
                onPress={() => {
                  setAuthMode('login');
                  setAuthMsg('');
                }}
              >
                <Text
                  style={[
                    styles.authTabText,
                    authMode === 'login' && styles.authTabTextActive,
                  ]}
                >
                  Sign in
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authTab, authMode === 'register' && styles.authTabActive]}
                onPress={() => {
                  setAuthMode('register');
                  setAuthMsg('');
                }}
              >
                <Text
                  style={[
                    styles.authTabText,
                    authMode === 'register' && styles.authTabTextActive,
                  ]}
                >
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === 'register' ? (
              <>
                <TextInput
                  style={styles.authInput}
                  placeholder="First name"
                  placeholderTextColor={colors.textMuted}
                  value={firstNameText}
                  onChangeText={setFirstNameText}
                />
                <TextInput
                  style={styles.authInput}
                  placeholder="Surname"
                  placeholderTextColor={colors.textMuted}
                  value={surnameText}
                  onChangeText={setSurnameText}
                />
                <TextInput
                  style={styles.authInput}
                  placeholder="Handicap (e.g. 12.4)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={handicapText}
                  onChangeText={setHandicapText}
                />
                <TextInput
                  style={styles.authInput}
                  placeholder="Golf Link number (optional)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={golfIdText}
                  onChangeText={setGolfIdText}
                />
              </>
            ) : null}

            <TextInput
              style={styles.authInput}
              placeholder="you@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={emailText}
              onChangeText={(t) => setEmailText(t.replace(/\s+/g, '').toLowerCase())}
            />
            <TextInput
              style={styles.authInput}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={passwordText}
              onChangeText={setPasswordText}
            />
            {authMode === 'login' ? (
              <TouchableOpacity onPress={forgotPassword} disabled={authBusy} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                <Text style={{ color: colors.green, fontSize: 13, fontWeight: '700' }}>Forgot password?</Text>
              </TouchableOpacity>
            ) : null}
            {authMode === 'login' && resetSent ? (
              <View>
                <TextInput style={styles.authInput} placeholder="6-digit code from email" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={resetCode} onChangeText={setResetCode} />
                <TextInput style={styles.authInput} placeholder="New password" placeholderTextColor={colors.textMuted} secureTextEntry value={resetNewPass} onChangeText={setResetNewPass} />
                <TouchableOpacity onPress={doReset} disabled={authBusy} style={[styles.glSave, { marginTop: 4 }]}><Text style={styles.glSaveTxt}>Reset password & sign in</Text></TouchableOpacity>
              </View>
            ) : null}

            {authMsg ? <Text style={styles.authMsg}>{authMsg}</Text> : null}

            <View style={styles.authBtns}>
              <TouchableOpacity
                style={[styles.authBtn, styles.authBtnGhost]}
                onPress={() => {
                  setAuthVisible(false);
                  setAuthMsg('');
                }}
              >
                <Text style={styles.authBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authBtn}
                disabled={authBusy}
                onPress={submitAuth}
              >
                <Text style={styles.authBtnText}>
                  {authBusy
                    ? 'Working…'
                    : authMode === 'register'
                      ? 'Create account'
                      : 'Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={openBoard !== null}
        animationType="slide"
        onRequestClose={() => setOpenBoard(null)}
      >
        <View style={styles.fullWrap}>
          <View style={styles.fullHeader}>
            <Text style={styles.fullTitle} numberOfLines={1}>
              {openBoard ? openBoard.title : ''}
            </Text>
            <TouchableOpacity onPress={() => setOpenBoard(null)}>
              <Text style={styles.fullClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.fullScroll}>
            {(openBoard ? openBoard.rows : []).map((r) => {
              const mine =
                !!meName &&
                cleanLeaderName(r.name) === cleanLeaderName(meName);
              return (
                <View
                  key={`${r.rank}-${r.name}`}
                  style={[styles.row, mine ? styles.rowMe : null]}
                >
                  <Text style={styles.rank}>{r.rank}</Text>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {r.detail ? (
                      <Text style={styles.rowDetail} numberOfLines={1}>
                        {r.detail}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.rowValue}>{r.value}</Text>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={myPageVisible}
        animationType="slide"
        onRequestClose={() => setMyPageVisible(false)}
      >
        <View style={styles.pScreen}>
          <ScrollView contentContainerStyle={styles.pScrollBody}>
            <View style={styles.pHeader}>
              <View style={styles.pTopBar}>
                <TouchableOpacity onPress={() => setMyPageVisible(false)}>
                  <Text style={styles.pTopBack}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.pTopTitle}>Profile</Text>
                <TouchableOpacity style={styles.pGear} onPress={openSettings}><View style={{ alignItems: 'center', justifyContent: 'center' }}><View style={styles.kebabDot} /><View style={styles.kebabDot} /><View style={styles.kebabDot} /></View></TouchableOpacity>
                
              </View>

              <View style={styles.pIdRow}>
                <TouchableOpacity onPress={changeAvatar} style={styles.pAvatar}>
                  {myPhoto ? (
                    <Image
                      source={{ uri: myPhoto }}
                      style={styles.pAvatarImg}
                    />
                  ) : (
                    <Text style={styles.pAvatarText}>{initials || '⛳'}</Text>
                  )}
                  <View style={styles.pCam}>
                    <Text style={styles.pCamIcon}>📷</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.pIdText}>
                  <View style={styles.pNameRow}>
                    <Text style={styles.pName} numberOfLines={1}>
                      {meName || 'Player'}
                    </Text>
                    <Text style={styles.pVerified}>✓</Text>
                  </View>
                  {session?.email ? (
                    <Text style={styles.pEmail}>{session.email}</Text>
                  ) : null}
                  <Text style={styles.pMeta}>📍 R2TC Tour Member</Text>
                </View>
              </View>

              <Text style={styles.pBio}>{profile && (profile as any).bio ? (profile as any).bio : 'Passionate about the game. Always chasing lower scores and good company.'}</Text>

              <Modal visible={settingsVisible} animationType="slide" transparent onRequestClose={() => setSettingsVisible(false)}>
                <View style={styles.setBackdrop}>
                  <View style={styles.setSheet}>
                    <View style={styles.setTop}>
                      <Text style={styles.setTitle}>Settings</Text>
                      <TouchableOpacity onPress={() => setSettingsVisible(false)}><Text style={styles.setClose}>Done</Text></TouchableOpacity>
                    </View>
                    <Text style={styles.glLabel}>DISPLAY NAME</Text>
                    <TextInput style={styles.glInput} placeholder="Your name" placeholderTextColor={colors.textMuted} value={myDisplayName} onChangeText={setMyDisplayName} />
                    <TouchableOpacity style={styles.glSave} onPress={saveName} disabled={glSaving}><Text style={styles.glSaveTxt}>Save name</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.glSave, styles.glSaveAlt]} onPress={() => { changeAvatar(); }} disabled={glSaving}><Text style={[styles.glSaveTxt, styles.glSaveAltTxt]}>📷  Change profile photo</Text></TouchableOpacity>
                    <Text style={[styles.glLabel, styles.glLabelGap]}>BIO</Text>
                    <TextInput style={[styles.glInput, { height: 70, textAlignVertical: 'top' }]} placeholder="Tell members about yourself" placeholderTextColor={colors.textMuted} multiline value={myBio} onChangeText={setMyBio} />
                    <TouchableOpacity style={styles.glSave} onPress={saveBio} disabled={glSaving}><Text style={styles.glSaveTxt}>Save bio</Text></TouchableOpacity>
                    <Text style={[styles.glLabel, styles.glLabelGap]}>GOLF LINK NUMBER</Text>
                    <TextInput style={styles.glInput} placeholder="e.g. 3417800006" placeholderTextColor={colors.textMuted} autoCapitalize="characters" value={myGolfId} onChangeText={setMyGolfId} />
                    <TouchableOpacity style={styles.glSave} onPress={saveGolfId} disabled={glSaving}><Text style={styles.glSaveTxt}>{glSaving ? 'Saving…' : 'Save Golf Link & refresh handicap'}</Text></TouchableOpacity>
                    {myGaHcp != null ? <Text style={styles.glMsg}>Current GA handicap: {myGaHcp}</Text> : null}
                    <Text style={[styles.glLabel, styles.glLabelGap]}>EMAIL</Text>
                    <TextInput style={styles.glInput} placeholder="you@email.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={myEmail} onChangeText={(t) => setMyEmail(t.replace(/\s+/g, '').toLowerCase())} />
                    <TouchableOpacity style={[styles.glSave, styles.glSaveAlt]} onPress={saveEmail} disabled={glSaving}><Text style={[styles.glSaveTxt, styles.glSaveAltTxt]}>Update email</Text></TouchableOpacity>
                    <Text style={[styles.glLabel, styles.glLabelGap]}>NEW PASSWORD</Text>
                    <TextInput style={styles.glInput} placeholder="At least 6 characters" placeholderTextColor={colors.textMuted} secureTextEntry value={myNewPass} onChangeText={setMyNewPass} />
                    <TouchableOpacity style={styles.glSave} onPress={savePassword} disabled={glSaving}><Text style={styles.glSaveTxt}>Update password</Text></TouchableOpacity>
                    {glMsg ? <Text style={styles.glMsg}>{glMsg}</Text> : null}
                <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' }}>
                  <TouchableOpacity onPress={() => RNLinking.openURL('https://unxfoxfzfvqjtakcfwhs.supabase.co/functions/v1/policies/privacy')} style={{ paddingVertical: 12 }}><Text style={{ color: '#fff', fontSize: 15 }}>Privacy Policy</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => RNLinking.openURL('https://unxfoxfzfvqjtakcfwhs.supabase.co/functions/v1/policies/terms')} style={{ paddingVertical: 12 }}><Text style={{ color: '#fff', fontSize: 15 }}>Terms of Use</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => RNAlert.alert('Sign out', 'Are you sure you want to sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { await doSignOut(); try { await ExpoUpdates.reloadAsync(); } catch (e) {} } }])} style={{ paddingVertical: 12 }}><Text style={{ color: '#fff', fontSize: 15 }}>Sign Out</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => RNAlert.alert('Delete account', 'This permanently deletes your account and personal data and cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await doDeleteAccount(); try { await ExpoUpdates.reloadAsync(); } catch (e) {} } catch (e) { RNAlert.alert('Error', 'Could not delete your account.'); } } }])} style={{ paddingVertical: 12 }}><Text style={{ color: '#C0392B', fontSize: 15, fontWeight: '800' }}>Delete Account</Text></TouchableOpacity>
                </View>
                  </View>
                </View>
              </Modal>
              <View style={styles.pStatRow}>
                <View style={styles.pStat}>
                  <Text style={styles.pStatVal}>{gaHcp != null ? gaHcp : (myGaHcp != null ? myGaHcp : (typeof profile?.handicap === 'number' ? profile.handicap : '—'))}</Text>
                  <Text style={styles.pStatLbl}>Handicap</Text>
                </View>
                <View style={styles.pStat}>
                  <Text style={styles.pStatVal}>{scoringAvgDec ?? '—'}</Text>
                  <Text style={styles.pStatLbl}>Scoring Avg</Text>
                </View>
                <TouchableOpacity style={styles.pStat} activeOpacity={0.7} onPress={() => { if (bestStrokeRoundObj) onViewRound(bestStrokeRoundObj); }}>
                  <Text style={styles.pStatVal}>{bestRound ?? '—'}</Text>
                  <Text style={styles.pStatLbl}>Best Stroke</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pStat} activeOpacity={0.7} onPress={() => { if (bestStablefordRoundObj) onViewRound(bestStablefordRoundObj); }}>
                  <Text style={styles.pStatVal}>{bestStableford !== null ? bestStableford : '\u2014'}</Text>
                  <Text style={styles.pStatLbl}>Best Stableford</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pStat} activeOpacity={0.7} onPress={onOpenPastRounds}>
                  <Text style={styles.pStatVal}>{roundsPlayed || '—'}</Text>
                  <Text style={styles.pStatLbl}>Rounds</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pFriends}>
              <Text style={styles.pFriendsText}>
                👥 You're automatically connected with all your tour members —
                every R2TC member is your friend.
              </Text>
            </View>

            <View style={styles.pMetrics}>
              <TouchableOpacity style={styles.pMetric} activeOpacity={0.7} onPress={() => setFriendsOpen(true)}>
                <Text style={styles.pMetricVal}>{tourFriends || '—'}</Text>
                <Text style={styles.pMetricLbl}>Tour Friends</Text>
              </TouchableOpacity>
              <View style={styles.pMetric}>
                <Text style={styles.pMetricVal}>{myPosts.length}</Text>
                <Text style={styles.pMetricLbl}>Posts</Text>
              </View>
              <TouchableOpacity style={styles.pMetric} activeOpacity={0.7} onPress={onOpenPastRounds}>
                <Text style={styles.pMetricVal}>{roundsPlayed || '—'}</Text>
                <Text style={styles.pMetricLbl}>Rounds</Text>
              </TouchableOpacity>
              <View style={styles.pMetric}>
                <Text style={styles.pMetricVal}>
                  {tourRank ? '#' + tourRank : '—'}
                </Text>
                <Text style={styles.pMetricLbl}>Tour Rank</Text>
              </View>
            </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingHorizontal: 4 }}>
                <View style={{ flex: 1, backgroundColor: '#0e3b28', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏌️</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{contestRecs.ld ? Math.round(contestRecs.ld.metres) + ' m' : '—'}</Text>
                  <Text style={{ color: '#9fb4a8', fontSize: 11, fontWeight: '700', marginTop: 3 }}>Longest Drive Ever</Text>
                    {contestRecs.ld ? <Text style={{ color: '#6f8a7d', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>{(contestRecs.ld.course || contestRecs.ld.event || '') + (contestRecs.ld.hole ? ' - Hole ' + contestRecs.ld.hole : '')}</Text> : null}
                </View>
                <View style={{ flex: 1, backgroundColor: '#0e3b28', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🎯</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{contestRecs.ctp ? contestRecs.ctp.metres + ' m' : '—'}</Text>
                  <Text style={{ color: '#9fb4a8', fontSize: 11, fontWeight: '700', marginTop: 3 }}>Closest to Pin</Text>
                    {contestRecs.ctp ? <Text style={{ color: '#6f8a7d', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>{(contestRecs.ctp.course || contestRecs.ctp.event || '') + (contestRecs.ctp.hole ? ' - Hole ' + contestRecs.ctp.hole : '')}</Text> : null}
                </View>
              </View>
              {myRoundTotals.length >= 2 ? (
                <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>FORM · LAST {Math.min(myRoundTotals.length, 10)} ROUNDS (STABLEFORD)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 74 }}>
                    {myRoundTotals.slice(0, 10).reverse().map((r: { date: string; total: number; stableford: number; round?: any }, i: number, arr: { stableford: number }[]) => {
                      const vals = arr.map((x) => Number(x.stableford) || 0);
                      const mx = Math.max.apply(null, vals.concat([1]));
                      const v = Number(r.stableford) || 0;
                      const h = Math.max(6, Math.round((v / mx) * 54));
                      const best = v === mx && v > 0;
                      return (
                        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <Text style={{ color: best ? '#31c46b' : colors.textMuted, fontSize: 10, fontWeight: best ? '800' : '600', marginBottom: 2 }}>{v}</Text>
                          <View style={{ width: 16, height: h, borderRadius: 5, backgroundColor: best ? '#31c46b' : '#3b82f6', opacity: best ? 1 : 0.85 }} />
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}


            <Modal visible={friendsOpen} animationType="slide" transparent onRequestClose={() => setFriendsOpen(false)}>
              <View style={styles.fmOverlay}>
                <View style={styles.fmCard}>
                  <View style={styles.fmHeader}>
                    <Text style={styles.fmTitle}>Tour Friends ({allPlayers.length})</Text>
                    <TouchableOpacity onPress={() => setFriendsOpen(false)}><Text style={styles.fmClose}>✕</Text></TouchableOpacity>
                  </View>
                  <ScrollView>
                    {allPlayers.length === 0 ? (
                      <Text style={styles.fmEmpty}>No members yet.</Text>
                    ) : (
                      allPlayers.map((p) => (
                        <TouchableOpacity key={p.id || p.email || p.name} style={styles.fmRow} activeOpacity={0.7} onPress={() => { setFriendsOpen(false); setViewPlayer(p.name); }}>
                          {p.avatar_url ? (
                            <Image source={{ uri: p.avatar_url }} style={styles.fmAvatar} />
                          ) : (
                            <View style={[styles.fmAvatar, styles.fmAvatarFallback]}><Text style={styles.fmAvatarTxt}>{(p.name || '?').slice(0, 1).toUpperCase()}</Text></View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fmName}>{p.name || 'Unknown'}</Text>
                            {p.golfId ? <Text style={styles.fmSub}>Golf Link {p.golfId}</Text> : null}
                          </View>
                          <Text style={styles.fmChevron}>›</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              </View>
            </Modal>
            {viewPlayer && (
              <PlayerProfileModal name={viewPlayer} onClose={() => setViewPlayer(null)} onOpenRound={onOpenRound} />
            )}

            

            <TouchableOpacity
              style={styles.pMiniCard}
              onPress={() => {
                setMyPageVisible(false);
                onOpenFixtures();
              }}
            >
              <Text style={styles.pMiniTitle}>📅 Upcoming Round</Text>
              <Text style={styles.pMiniBody}>
                See the next R2TC fixture and who's playing.
              </Text>
              <Text style={styles.pLink}>See details ›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pMiniCard}
              onPress={() => {
                setMyPageVisible(false);
                onOpenMarketplace();
              }}
            >
              <Text style={styles.pMiniTitle}>🛒 Marketplace</Text>
              <Text style={styles.pMiniBody}>
                Browse golf gear from tour members. Buy, sell, trade.
              </Text>
              <Text style={styles.pLink}>Go to Marketplace ›</Text>
            </TouchableOpacity>

            <View style={styles.pComposer}>
              <View style={styles.pComposerAvatar}>
                {myPhoto ? (
                  <Image
                    source={{ uri: myPhoto }}
                    style={styles.pComposerAvatarImg}
                  />
                ) : (
                  <Text style={styles.pComposerAvatarText}>
                    {initials || '⛳'}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.pComposerInput, { color: colors.text, textAlignVertical: 'top' }]}
                  placeholder="What's happening on the tour?"
                  placeholderTextColor={colors.textMuted}
                  value={postText}
                  onChangeText={setPostText}
                  multiline
                />
                {media ? (
                  <View style={styles.mediaPreview}>
                    {media.type === 'image' ? (
                      <Image source={{ uri: media.uri }} style={styles.previewImg} />
                    ) : (
                      <Text style={styles.previewVid}>\uD83D\uDCF9 Video attached</Text>
                    )}
                    <TouchableOpacity onPress={() => setMedia(null)}>
                      <Text style={styles.removeMedia}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {(postText.trim() || media) ? (
                  <TouchableOpacity style={[styles.pComposerBtn, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={submitPost} disabled={posting}>
                    <Text style={styles.pComposerBtnText}>{posting ? '\u2026' : '\uD83D\uDCE3 Post'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <View style={styles.pComposerActions}>
              <TouchableOpacity
                style={styles.pComposerBtn}
                onPress={pickMedia}
              >
                <Text style={styles.pComposerBtnText}>📷 Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pComposerBtn}
                onPress={() => {
                  setMyPageVisible(false);
                  onStartRound();
                }}
              >
                <Text style={styles.pComposerBtnText}>🟢 Score</Text>
              </TouchableOpacity>
              <View style={styles.pComposerBtn}>
                <Text style={styles.pComposerBtnText}>📍 Check in</Text>
              </View>
            </View>

            <Text style={styles.pFeedHeading}>Feed</Text>
            {myPosts.length === 0 ? (
              <View style={styles.pPost}>
                <Text style={styles.pPostEmpty}>
                  You haven't posted yet — tap “Photo” above or use the Tour Feed
                  on the home screen.
                </Text>
              </View>
            ) : (
              myPosts.map((p) => (
                <View key={p.id} style={styles.pPost}>
                  <View style={styles.pPostHead}>
                    <View style={styles.pPostAvatar}>
                      {myPhoto ? (
                        <Image
                          source={{ uri: myPhoto }}
                          style={styles.pPostAvatarImg}
                        />
                      ) : (
                        <Text style={styles.pPostAvatarText}>
                          {initials || '⛳'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.pPostHeadText}>
                      <Text style={styles.pPostAuthor}>{p.author}</Text>
                      <Text style={styles.pPostTime}>
                        {new Date(p.created_at).toLocaleString()}
                        {p.media_url ? '  ·  Photo' : '  ·  Update'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removePost(p)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.pPostMore}>⋯</Text>
                    </TouchableOpacity>
                  </View>
                  {p.text ? (
                    <Text style={styles.pPostBody}>{p.text}</Text>
                  ) : null}
                  {p.media_url ? (
                    p.media_type === 'video' ? (
                      <Video
                        source={{ uri: p.media_url }}
                        style={styles.pPostMedia}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                      />
                    ) : (
                      <Image
                        source={{ uri: p.media_url }}
                        style={styles.pPostMedia}
                        resizeMode="cover"
                      />
                    )
                  ) : null}
                </View>
              ))
            )}

            <TouchableOpacity
              style={{ backgroundColor: '#1E2B25', borderWidth: 1, borderColor: '#33433B', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 12 }}
              onPress={async () => {
                const gid = (profile && (profile as any).golf_id) || '';
                if (gid) { setMyGaHcp(null); fetchHandicapForGolfId(gid).then(setMyGaHcp).catch(function(){}); }
                try { await onRefresh(); } catch (e) {}
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{refreshing ? 'Refreshing…' : 'Refresh data'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={async () => {
                await signOut();
                setSession(null);
                setProfile(null);
                setMyPhoto(null);
                setMyPageVisible(false);
              }}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  kebabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff', marginVertical: 1.5 },
  fmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  fmCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30, maxHeight: '80%' },
  fmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fmTitle: { fontSize: 18, fontWeight: '800', color: '#0b2540' },
  fmClose: { fontSize: 20, color: '#64748b', paddingHorizontal: 6 },
  fmEmpty: { textAlign: 'center', color: '#64748b', paddingVertical: 30 },
  fmRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  fmAvatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12, backgroundColor: '#dbeafe' },
  fmAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  fmAvatarTxt: { fontSize: 20, fontWeight: '800', color: '#1d4ed8' },
  fmName: { fontSize: 16, fontWeight: '700', color: '#0b2540' },
  fmSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  fmChevron: { fontSize: 26, color: '#cbd5e1', paddingLeft: 8 },
  reactBar: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 2 },
  reactBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 6, marginBottom: 4 },
  reactBtnOn: { backgroundColor: 'rgba(43,168,74,0.25)', borderWidth: 1, borderColor: '#2BA84A' },
  reactEmo: { fontSize: 16 },
  reactCount: { color: '#A9C0B4', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  reactCountOn: { color: '#ffffff' },
  headerBg: { ...StyleSheet.absoluteFillObject, width: '150%', height: '100%' },
  headerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,28,16,0.62)' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  leftCol: { flexDirection: 'column', alignItems: 'flex-start', alignSelf: 'stretch', justifyContent: 'space-between' },
  iconCluster: { flexDirection: 'row', alignItems: 'center', marginLeft: 2, marginBottom: 2 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bellIcon: { fontSize: 36 },
  bellDot: { position: 'absolute', top: 4, right: 4, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.red || '#e23b3b' },
  profileMeta: { marginLeft: 8, maxWidth: 132 },
  viewProfile: { color: '#ffffff', fontSize: 11, fontWeight: '700', marginTop: 2 },
  notifBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
  notifSheet: { backgroundColor: colors.bgDark, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 18 },
  notifTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  notifTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  notifClose: { color: colors.green, fontSize: 15, fontWeight: '700' },
  notifEmpty: { color: colors.textMuted, fontSize: 13, paddingVertical: 16 },
  notifRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  notifAuthor: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  notifText: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  notifTime: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  hero: { borderRadius: radius.lg || 18, overflow: 'hidden', marginBottom: 12, minHeight: 140 },
  heroImg: { ...StyleSheet.absoluteFillObject, width: '150%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,28,16,0.45)' },
  heroContent: { padding: 14, minHeight: 140, justifyContent: 'flex-end' },
  heroTextCol: { flex: 1, paddingRight: 8 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginBottom: 14 },
  heroBtn: { backgroundColor: colors.green, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 24 },
  heroBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ballWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ballLogo: { position: 'absolute', width: 44, height: 44 },
  pGear: { paddingHorizontal: 8 },
  pGearTxt: { fontSize: 20, color: colors.text },
  setBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  setSheet: { backgroundColor: colors.bgDark, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 34 },
  setTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  setTitle: { color: colors.textOnDark, fontSize: 18, fontWeight: '800' },
  setClose: { color: colors.green, fontSize: 15, fontWeight: '700' },
  glLabelGap: { marginTop: 18 },
  glSaveAlt: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  glSaveAltTxt: { color: colors.text },
  glCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  glLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.3 },
  glInput: { backgroundColor: colors.bgDark, color: colors.textOnDark, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  glSave: { backgroundColor: colors.green, borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  glSaveTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  glMsg: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 8 },
  resumeRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 10 },
  resumeDelete: { backgroundColor: '#7A1F1F', borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  resumeDeleteText: { fontSize: 20 },
  ongoingWrap: { marginBottom: 12 },
  ongoingHeading: { color: colors.textOnDark, fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginLeft: 2 },
  ongoingCard: { backgroundColor: '#0F3B2A', borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.greenDark },
  ongoingTag: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  ongoingName: { color: '#fff', fontSize: 18, fontWeight: '900' },
  ongoingSub: { color: colors.textOnDarkMuted, fontSize: 13, marginTop: 2 },
  ongoingBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  ongoingOpen: { flex: 1, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  ongoingOpenText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  ongoingClose: { paddingHorizontal: 12, paddingVertical: 8 },
  ongoingCloseText: { fontSize: 20 },
  liveNow: { backgroundColor: '#7A1F1F', borderRadius: radius.md, padding: 14, marginBottom: 12 },
  liveNowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  liveNowDot: { color: '#FFD2D2', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  liveNowGo: { color: '#fff', fontWeight: '800', fontSize: 12 },
  liveNowText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 50, height: 50 },
  rowMe: { backgroundColor: '#FBF3D6' },
  viewAll: { paddingVertical: 11, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  viewAllText: { color: colors.greenDark, fontWeight: '800', fontSize: 13 },
  fullWrap: { flex: 1, backgroundColor: colors.bgDark, paddingTop: 52 },
  fullHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  fullTitle: { color: colors.textOnDark, fontWeight: '900', fontSize: 16, flex: 1, paddingRight: 12 },
  fullClose: { color: colors.gold, fontWeight: '800', fontSize: 15 },
  fullScroll: { backgroundColor: colors.card },
  authTabs: { flexDirection: 'row', marginBottom: 12, borderRadius: radius.pill, backgroundColor: colors.cardAlt, padding: 4 },
  authTab: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  authTabActive: { backgroundColor: colors.green },
  authTabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  authTabTextActive: { color: colors.textOnDark },
  screen: { flex: 1, backgroundColor: colors.bgDark },
  scroll: { padding: 16, paddingTop: 22, paddingBottom: 40 },
  header: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg || 18,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.green,
  },
  headerPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(4,26,16,0.42)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandText: { flexShrink: 1 },
  tourName: {
    color: colors.textOnDark,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagline: { color: colors.gold, marginTop: 2, fontSize: 11, fontWeight: '600' },
  profileChip: { alignItems: 'center', marginLeft: 10, maxWidth: 96 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  avatarText: { color: colors.green, fontWeight: '900', fontSize: 16 },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  profileName: { color: colors.textOnDark, fontSize: 12, fontWeight: '800', maxWidth: 92 },
  profileHcp: { color: colors.gold, fontSize: 11, fontWeight: '700', marginTop: 1 },
  accountPill: {
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  accountPillText: {
    color: colors.textOnDark,
    fontSize: 12,
    fontWeight: '700',
  },
  myWrap: { flex: 1, backgroundColor: colors.bgDark, paddingTop: 50 },
  myTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  myBack: { color: colors.green, fontWeight: '800', fontSize: 15, width: 60 },
  myTopTitle: {
    color: colors.textOnDark,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
  },
  myScroll: { padding: 16 },
  myHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  myHeadText: { flexShrink: 1, paddingRight: 12 },
  myName: { color: colors.textOnDark, fontSize: 22, fontWeight: '900' },
  myEmail: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 2 },
  changePhotoBtn: { marginTop: 8 },
  changePhotoText: { color: colors.green, fontWeight: '800', fontSize: 13 },
  myAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  myAvatarImg: { width: 84, height: 84 },
  myAvatarText: { color: '#fff', fontWeight: '900', fontSize: 30 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  myBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  myActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  myActionEmoji: { fontSize: 16 },
  myActionText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  signOutBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
  },
  signOutText: { color: colors.red, fontWeight: '800', fontSize: 14 },
  pScreen: { flex: 1, backgroundColor: '#EDF1F5' },
  pScrollBody: { paddingBottom: 40 },
  pHeader: {
    backgroundColor: colors.bgDark,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  pTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pTopBack: { color: '#fff', fontSize: 28, fontWeight: '900', width: 30 },
  pTopTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  pAvatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pAvatarMiniImg: { width: 30, height: 30 },
  pAvatarMiniText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  pIdRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  pAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pAvatarImg: { width: 78, height: 78, borderRadius: 39 },
  pAvatarText: { color: '#fff', fontWeight: '900', fontSize: 30 },
  pCam: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1B1B1B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDark,
  },
  pCamIcon: { fontSize: 11 },
  pIdText: { flex: 1 },
  pNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pName: { color: '#fff', fontSize: 22, fontWeight: '900', flexShrink: 1 },
  pVerified: {
    color: '#fff',
    backgroundColor: '#3BA1FF',
    fontSize: 11,
    fontWeight: '900',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    overflow: 'hidden',
    lineHeight: 18,
  },
  pEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  pMeta: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 4 },
  pBio: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  pStatRow: { flexDirection: 'row', gap: 8 },
  pStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pStatVal: { color: '#fff', fontSize: 15, fontWeight: '900' },
  pStatLbl: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  pFriends: {
    backgroundColor: '#0F3B2A',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
  },
  pFriendsText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  pMetrics: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pMetric: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pMetricVal: { color: '#16241D', fontSize: 18, fontWeight: '900' },
  pMetricLbl: { color: '#6B7280', fontSize: 10, fontWeight: '700', marginTop: 3 },
  pMiniCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pMiniTitle: { color: '#16241D', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  pMiniBody: { color: '#6B7280', fontSize: 12, lineHeight: 17 },
  pLink: { color: colors.green, fontWeight: '800', fontSize: 12, marginTop: 8 },
  pComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  pComposerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pComposerAvatarImg: { width: 36, height: 36 },
  pComposerAvatarText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  pComposerInput: {
    flex: 1,
    backgroundColor: '#EDF1F5',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pComposerHint: { color: '#6B7280', fontSize: 13 },
  pComposerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  pComposerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  pComposerBtnText: { color: '#374151', fontWeight: '700', fontSize: 12 },
  pFeedHeading: {
    color: '#16241D',
    fontSize: 16,
    fontWeight: '900',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  pPost: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pPostEmpty: { color: '#6B7280', fontSize: 13, lineHeight: 18 },
  pPostHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  pPostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pPostAvatarImg: { width: 36, height: 36 },
  pPostAvatarText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  pPostHeadText: { flex: 1 },
  pPostAuthor: { color: '#16241D', fontSize: 14, fontWeight: '800' },
  pPostTime: { color: '#9CA3AF', fontSize: 11, marginTop: 1 },
  pPostMore: { color: '#9CA3AF', fontSize: 18, fontWeight: '900' },
  pPostBody: { color: '#16241D', fontSize: 14, lineHeight: 19 },
  pPostMedia: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: '#EDF1F5',
  },
  startBtn: {
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  linkRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  linkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
    gap: 8,
  },
  linkEmoji: { fontSize: 15 },
  linkText: { color: '#143a22', fontWeight: '800', fontSize: 13, flex: 1 },
  resumeBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  resumeBtnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sampleBanner: {
    backgroundColor: 'rgba(216,178,74,0.15)',
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 14,
  },
  sampleBannerText: { color: colors.gold, fontSize: 12, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: { marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLink: { color: colors.greenDark, fontWeight: '800', fontSize: 12 },
  feedCompose: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  feedInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: colors.cardAlt, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14 },
  feedPostBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  feedPostText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  feedMediaBtn: { backgroundColor: colors.cardAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  feedMediaIcon: { fontSize: 18 },
  mediaPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  previewImg: { width: 56, height: 56, borderRadius: 8 },
  previewVid: { color: colors.textMuted, fontSize: 13 },
  removeMedia: { color: colors.red, fontWeight: '700', fontSize: 13 },
  feedMedia: { width: '100%', height: 220, borderRadius: radius.md, marginTop: 8, backgroundColor: colors.cardAlt },
  feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  feedDelete: { fontSize: 15 },
  feedItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: 10 },
  feedAuthor: { fontWeight: '800', color: colors.text, fontSize: 14 },
  feedBody: { color: colors.text, fontSize: 14, marginTop: 2, lineHeight: 19 },
  feedTime: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.greenDark,
  },
  emptyText: { color: colors.textMuted, fontSize: 13, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rank: {
    width: 26,
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
  },
  rowMain: { flex: 1, paddingRight: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowDetail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowValue: { fontSize: 15, fontWeight: '800', color: colors.greenDark },
  rowChevron: { fontSize: 22, color: colors.textMuted },
  footer: {
    textAlign: 'center',
    color: colors.textOnDarkMuted,
    fontSize: 12,
    marginTop: 6,
  },
  authWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  authCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
  },
  authTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  authSub: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  authInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginTop: 10,
  },
  authMsg: {
    fontSize: 12,
    color: colors.greenDark,
    fontWeight: '700',
    marginTop: 8,
  },
  authBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  authBtn: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authBtnGhost: { backgroundColor: colors.cardAlt },
  authBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  authBtnGhostText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  authResend: {
    textAlign: 'center',
    color: colors.greenDark,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 12,
  },
});
