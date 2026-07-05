import React, { useEffect, useRef, useState } from 'react';
import ReportMenu from '../components/ReportMenu';
import { fetchMyBlocks } from '../logic/supabase';
import {
  Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScrollView as GifScroll } from 'react-native';
import { colors, radius } from '../theme';
import {
  fetchMyMessages, sendDm, markThreadRead, dmThreadKey, DmMessage, uploadMedia,
  fetchDmReactions, setDmReaction, removeDmReaction,
  fetchMyThreads, createGroupThread, renameThread, setThreadMembers, sendGroupDm,
  deleteThread, unsendDm,
} from '../logic/liveEvents';
import { fetchAllPlayers, getSession } from '../logic/supabase';

interface Other { email: string; name: string; group?: boolean; key?: string; members?: { email: string; name: string }[]; }
interface Props {
  onBack: () => void;
  meEmail: string;
  initialThread?: { email: string; name: string; itemTitle?: string; itemImage?: string | null } | null;
  onClearInitial?: () => void;
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };
const DM_REACTIONS: any[] = [['like','👍'],['heart','❤️'],['smile','😄'],['sad','😢'],['angry','😠'],['shocked','😮']];

export default function MessagesScreen({ onBack, meEmail, initialThread, onClearInitial }: Props) {
  const [me, setMe] = useState(String(meEmail || '').toLowerCase());
  const [msgs, setMsgs] = useState<DmMessage[]>([]);
  const [myName, setMyName] = useState('');
  const [view, setView] = useState<'inbox' | 'thread'>('inbox');
  const [other, setOther] = useState<Other | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [pendingImg, setPendingImg] = useState<string | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const listRef = useRef<FlatList<any> | null>(null);

  const [viewerImg, setViewerImg] = useState<string | null>(null);
  const [reactions, setReactions] = useState<any[]>([]);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [inboxQuery, setInboxQuery] = useState('');
  const [threads, setThreads] = useState<any[]>([]);
  const [blockedKeys, setBlockedKeys] = useState<string[]>([]);
  useEffect(() => {
    fetchMyBlocks()
      .then((rows) => {
        const keys: string[] = [];
        (rows || []).forEach((r) => {
          if (r.blocked_email) keys.push(String(r.blocked_email).trim().toLowerCase());
          if (r.blocked_name) keys.push(String(r.blocked_name).trim().toLowerCase());
        });
        setBlockedKeys(keys);
      })
      .catch(() => {});
  }, []);
  const isBlockedKey = (email?: any, name?: any) =>
    (String(email || '').trim() !== '' && blockedKeys.indexOf(String(email).trim().toLowerCase()) >= 0) ||
    (String(name || '').trim() !== '' && blockedKeys.indexOf(String(name).trim().toLowerCase()) >= 0);

  const [picked, setPicked] = useState<any[]>([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addPicked, setAddPicked] = useState<any[]>([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const load = () => { if (!me) return; fetchMyMessages(me).then((x) => setMsgs(x || [])); fetchDmReactions().then((rs) => setReactions(rs || [])); fetchMyThreads(me).then((t) => setThreads(t || [])); };
  const pickReaction = async (type: string) => { const mid = reactionFor; setReactionFor(null); if (!mid || !me) return; const mineR = reactions.find((r) => r.message_id === mid && String(r.email || '').toLowerCase() === me); if (mineR && mineR.type === type) { await removeDmReaction(mid, me); } else { await setDmReaction(mid, me, type); } fetchDmReactions().then((rs) => setReactions(rs || [])); };

  useEffect(() => {
    getSession().then((s: any) => { if (s && s.email) setMe(String(s.email).toLowerCase()); });
    fetchAllPlayers().then((ps: any[]) => { setRoster(ps || []); });
  }, []);

  useEffect(() => {
    if (!me) return;
    const mine = roster.find((p) => String(p.email || '').toLowerCase() === me);
    if (mine && mine.name) setMyName(mine.name);
    load();
    const t = setInterval(load, 7000);
    return () => clearInterval(t);
  }, [me, roster]);

  useEffect(() => {
    if (initialThread && initialThread.email) {
      openThread({ email: String(initialThread.email).toLowerCase(), name: initialThread.name || 'Seller' });
      if (initialThread.itemTitle) {
        setPendingItem(initialThread.itemTitle);
        setDraft('Hi, is "' + initialThread.itemTitle + '" still available?');
        if (initialThread.itemImage) setPendingImg(initialThread.itemImage);
      }
      if (onClearInitial) onClearInitial();
    }
  }, [initialThread]);

  const openThread = (o: Other) => {
    setOther(o);
    setView('thread');
    setSearchOpen(false); setThreadSearch('');
    if (!(o as any).group) markThreadRead(me, o.email).then(load); else load();
  };

  const og: any = other || {};
  const activeThreadKey = other ? (og.group ? og.key : dmThreadKey(me, other.email)) : '';
  const threadMsgsAll = other
    ? msgs.filter((m) => (m.thread_key || dmThreadKey(m.from_email, m.to_email)) === activeThreadKey).filter((m: any) => !isBlockedKey(m.from_email, m.from_name))
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    : [];
  const threadMsgs = threadSearch.trim()
    ? threadMsgsAll.filter((m) => String(m.text || '').toLowerCase().indexOf(threadSearch.trim().toLowerCase()) !== -1)
    : threadMsgsAll;
  const threadMedia = threadMsgsAll.filter((m) => !!m.item_image).map((m) => m.item_image);

  const togglePicked = (p: any, list: any[], setList: any) => {
    const e = String(p.email || '').toLowerCase();
    if (list.some((x) => String(x.email || '').toLowerCase() === e)) setList(list.filter((x) => String(x.email || '').toLowerCase() !== e));
    else setList([...list, { email: e, name: p.name || p.email }]);
  };
  const createGroup = async () => {
    if (picked.length < 2) return;
    const members = [{ email: me, name: myName || me.split('@')[0] }, ...picked];
    const key = await createGroupThread(groupName.trim() || 'Group chat', members, me);
    setShowNew(false); setGroupMode(false); setPicked([]); setGroupName('');
    if (key) { await load(); openThread({ email: '', name: groupName.trim() || 'Group chat', group: true, key, members, created_by: me } as any); }
  };
  const doRename = async () => {
    if (!og.group || !renameText.trim()) { setRenameOpen(false); return; }
    await renameThread(og.key, renameText.trim());
    setOther({ ...og, name: renameText.trim() }); setRenameOpen(false); load();
  };
  const doAddMembers = async () => {
    if (!og.group || !addPicked.length) { setAddOpen(false); return; }
    const have = new Set((og.members || []).map((x: any) => String(x.email || '').toLowerCase()));
    const merged = [...(og.members || [])];
    addPicked.forEach((p) => { const e2 = String(p.email || '').toLowerCase(); if (!have.has(e2)) merged.push({ email: e2, name: p.name || p.email }); });
    await setThreadMembers(og.key, merged);
    setOther({ ...og, members: merged }); setAddOpen(false); setAddPicked([]); load();
  };
  const doLeave = async () => {
    if (!og.group) return;
    const merged = (og.members || []).filter((x: any) => String(x.email || '').toLowerCase() !== me);
    await setThreadMembers(og.key, merged);
    setMenuOpen(false); setView('inbox'); setOther(null); load();
  };
  const doDelete = () => {
    if (!og.group || String(og.created_by || '').toLowerCase() !== me) return;
    Alert.alert('Delete chat', 'Delete this group chat for everyone? This removes the chat and all its messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { setMenuOpen(false); await deleteThread(og.key); setView('inbox'); setOther(null); load(); } },
    ]);
  };
  const unsend = async (mid: string) => { setReactionFor(null); if (!mid) return; await unsendDm(mid); load(); };

  const [uploadingImg, setUploadingImg] = useState(false);
  const attachPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { return; }
      const res: any = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      setUploadingImg(true);
      const url = await uploadMedia(res.assets[0].uri, 'image/jpeg');
      setUploadingImg(false);
      if (url) setPendingImg(url);
    } catch (e) { setUploadingImg(false); }
  };
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<string[]>([]);
  const searchGifs = async (q: string) => {
    try {
      const key = 'YCohpE3qpXHTcaBbFlBWskYssH6rqLQ4';
      const ep = q.trim()
        ? 'https://api.giphy.com/v1/gifs/search?api_key=' + key + '&q=' + encodeURIComponent(q) + '&limit=24&rating=pg-13'
        : 'https://api.giphy.com/v1/gifs/trending?api_key=' + key + '&limit=24&rating=pg-13';
      const r = await fetch(ep);
      const j = await r.json();
      setGifResults((j.data || []).map((g: any) => g.images && g.images.fixed_height && g.images.fixed_height.url).filter(Boolean));
    } catch (e) { setGifResults([]); }
  };
  const sendGif = async (url: string) => {
    const t = draft.trim();
    const g: any = other;
    if (g && g.group) {
      await sendGroupDm(g.key, me, myName || me.split('@')[0], g.name, t, url, (g.members || []).map((x: any) => x.email));
    } else if (other) {
      await sendDm({ from_email: me, from_name: myName || me.split('@')[0], to_email: other.email, to_name: other.name, text: t, item_title: null, item_image: url });
    }
    setDraft('');
    setGifOpen(false);
    setGifQuery('');
    load();
  };
  const send = async () => {
    const t = draft.trim();
    if ((!t && !pendingImg) || !other) return;
    if (!me) return;
    setDraft('');
    const item = pendingItem;
    const img = pendingImg;
    setPendingItem(null);
    setPendingImg(null);
    const g: any = other;
    if (g.group) {
      await sendGroupDm(g.key, me, myName || me.split('@')[0], g.name, t, img || null, (g.members || []).map((x: any) => x.email));
    } else {
      await sendDm({
        from_email: me, from_name: myName || me.split('@')[0],
        to_email: other.email, to_name: other.name,
        text: t, item_title: item || null, item_image: img || null,
      });
    }
    load();
  };

  // Build inbox rows grouped by the other participant
  const buildInbox = () => {
    const map: { [k: string]: { other: Other; last: string; time: string; unread: number } } = {};
    const threadByKey: { [k: string]: any } = {};
    threads.forEach((t) => { threadByKey[t.thread_key] = t; });
    msgs.forEach((m) => {
      const tk = m.thread_key || dmThreadKey(m.from_email, m.to_email);
      const mineMsg = String(m.from_email || '').toLowerCase() === me;
      const isGroup = String(tk).indexOf('g:') === 0;
      let key: string; let o: Other;
      if (isGroup) {
        const t = threadByKey[tk];
        if (!t) return;
        key = tk;
        o = { email: '', name: t.title || 'Group chat', group: true, key: tk, members: t.members || [], created_by: t.created_by };
      } else {
        o = mineMsg
          ? { email: String(m.to_email || '').toLowerCase(), name: m.to_name || m.to_email }
          : { email: String(m.from_email || '').toLowerCase(), name: m.from_name || m.from_email };
        key = o.email;
      }
      if (!map[key]) map[key] = { other: o, last: '', time: '', unread: 0 };
      map[key].other = o;
      map[key].last = (mineMsg ? 'You: ' : (isGroup ? (m.from_name ? m.from_name + ': ' : '') : '')) + (m.text || (m.item_image ? '\uD83D\uDCF7 Photo' : ''));
      map[key].time = m.created_at;
      if (!mineMsg && !m.read) map[key].unread += 1;
    });
    threads.forEach((t) => { if (!map[t.thread_key]) map[t.thread_key] = { other: { email: '', name: t.title || 'Group chat', group: true, key: t.thread_key, members: t.members || [], created_by: t.created_by }, last: 'New group', time: t.created_at || '', unread: 0 }; });
    return Object.keys(map).map((k) => map[k]).sort((a, b) => (a.time < b.time ? 1 : -1));
  };
  const inbox = buildInbox().filter(
    (t: any) => !(t && t.other && !t.other.group && isBlockedKey(t.other.email, t.other.name)),
  );

  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const renderInboxRow = ({ item }: { item: { other: Other; last: string; time: string; unread: number } }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => openThread(item.other)}>
      <View style={styles.avatar}><Text style={styles.avatarTxt}>{item.other.group ? '👥' : (item.other.name || '?').charAt(0).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{item.other.name}</Text>
          <Text style={styles.rowTime}>{fmtTime(item.time)}</Text>
        </View>
        <Text style={[styles.rowLast, item.unread > 0 && styles.rowUnread]} numberOfLines={1}>{item.last}</Text>
      </View>
      {item.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeTxt}>{item.unread}</Text></View> : null}
    </TouchableOpacity>
  );

  const renderBubble = ({ item }: { item: DmMessage }) => {
    const mineMsg = String(item.from_email || '').toLowerCase() === me;
    return (
      <View style={[styles.bubbleRow, mineMsg ? styles.bubbleRight : styles.bubbleLeft]}>
        <View style={{ maxWidth: '82%' }}>
          <TouchableOpacity activeOpacity={0.85} onLongPress={() => setReactionFor(item.id)} style={[styles.bubble, mineMsg ? styles.bMine : styles.bThem]}>
          {!mineMsg && og.group ? <Text style={styles.bubbleSender}>{item.from_name || item.from_email}</Text> : null}
          {item.item_title ? <Text style={[styles.itemTag, mineMsg && { color: 'rgba(255,255,255,0.85)' }]}>Re: {item.item_title}</Text> : null}
          {item.item_image ? <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerImg(item.item_image)}><Image source={{ uri: item.item_image }} style={styles.bubbleImg} /></TouchableOpacity> : null}
          {item.text ? <Text style={[styles.bText, mineMsg && { color: '#fff' }]}>{item.text}</Text> : null}
                {item.created_at ? <Text style={{ fontSize: 10, marginTop: 3, alignSelf: 'flex-end', color: mineMsg ? 'rgba(255,255,255,0.7)' : '#9A9A9A' }}>{new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text> : null}
          </TouchableOpacity>
            {!mineMsg ? (<ReportMenu contentType="dm_message" contentId={String(item.id)} authorName={item.from_name || item.from_email} authorEmail={item.from_email} />) : null}
          {reactions.filter((r) => r.message_id === item.id).length ? (
            <View style={[styles.reactRow, mineMsg ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
              {Array.from(new Set(reactions.filter((r) => r.message_id === item.id).map((r) => r.type))).map((tp) => (
                <Text key={String(tp)} style={styles.reactEmoji}>{(DM_REACTIONS.find((x) => x[0] === tp) || [null, '•'])[1]}</Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {view === 'thread' ? (
          <TouchableOpacity onPress={() => { setView('inbox'); setOther(null); load(); }} hitSlop={hit}><Text style={styles.back}>‹ Inbox</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onBack} hitSlop={hit}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={1}>{view === 'thread' && other ? other.name : 'CHAT'}</Text>
        {view === 'inbox' ? (
          <TouchableOpacity onPress={() => { setNameQuery(''); setShowNew(true); }} hitSlop={hit}><Text style={styles.newBtn}>＋ New</Text></TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setSearchOpen((s) => !s)} hitSlop={hit} style={{ marginRight: 16 }}><Text style={[styles.newBtn, { fontSize: 20 }]}>🔍</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={hit}><Text style={[styles.newBtn, { fontSize: 24 }]}>⋮</Text></TouchableOpacity>
          </View>
        )}
      </View>

      {view === 'inbox' ? (
        <FlatList
          data={inbox.filter((x) => !inboxQuery.trim() || String(x.other.name || '').toLowerCase().indexOf(inboxQuery.trim().toLowerCase()) !== -1)}
          keyExtractor={(x) => x.other.group ? x.other.key : x.other.email}
          renderItem={renderInboxRow}
          ListHeaderComponent={<View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}><TextInput style={{ backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: colors.text, fontSize: 15 }} placeholder="Search people..." placeholderTextColor={colors.textMuted} value={inboxQuery} onChangeText={setInboxQuery} /></View>}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.empty}>No chats yet. Tap “＋ New” to message any member.</Text>}
        />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          {searchOpen ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 8 }}><TextInput style={styles.searchInChat} placeholder="Search in this chat…" placeholderTextColor={colors.textMuted} value={threadSearch} onChangeText={setThreadSearch} autoFocus /></View>
          ) : null}
          <FlatList
            ref={listRef}
            data={threadMsgs}
            keyExtractor={(x) => x.id}
            renderItem={renderBubble}
            contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
            onContentSizeChange={() => { if (listRef.current) listRef.current.scrollToEnd({ animated: false }); }}
          />
          {pendingImg ? (
            <View style={styles.attachPreview}><Image source={{ uri: pendingImg }} style={styles.attachThumb} /><TouchableOpacity onPress={() => setPendingImg(null)} style={styles.attachX}><Text style={styles.attachXTxt}>✕</Text></TouchableOpacity></View>
          ) : null}
          <View style={styles.composer}>
            <TouchableOpacity style={styles.attachBtn} onPress={attachPhoto} activeOpacity={0.7}><Text style={styles.attachIcon}>{uploadingImg ? '…' : '📷'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={() => { setGifOpen(true); setGifQuery(''); searchGifs(''); }} activeOpacity={0.7}><Text style={[styles.attachIcon, { fontSize: 13, fontWeight: '800', color: '#31c46b' }]}>GIF</Text></TouchableOpacity>
              <TextInput style={styles.cInput} placeholder="Message…" placeholderTextColor={colors.textMuted} value={draft} onChangeText={setDraft} multiline />
            <TouchableOpacity style={styles.sendBtn} onPress={send} activeOpacity={0.9}><Text style={styles.sendTxt}>Send</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
      <Modal visible={gifOpen} animationType="slide" transparent onRequestClose={() => setGifOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgDark, height: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TextInput style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: colors.text }} placeholder="Search GIFs" placeholderTextColor={colors.textMuted} value={gifQuery} onChangeText={(v) => { setGifQuery(v); searchGifs(v); }} autoFocus />
              <TouchableOpacity onPress={() => setGifOpen(false)} style={{ paddingHorizontal: 12 }}><Text style={{ color: colors.text, fontSize: 16 }}>Close</Text></TouchableOpacity>
            </View>
            <GifScroll contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {gifResults.map((u, i) => (
                <TouchableOpacity key={String(i)} onPress={() => sendGif(u)} style={{ marginBottom: 6 }}>
                  <Image source={{ uri: u }} style={{ width: 110, height: 110, borderRadius: 8, backgroundColor: colors.card }} />
                </TouchableOpacity>
              ))}
            </GifScroll>
              {gifResults.length === 0 ? (<Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10 }}>No GIFs loaded - check your internet and try another search.</Text>) : null}
            <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 4 }}>Powered by GIPHY</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{groupMode ? 'New group' : 'New chat'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => { setGroupMode((g) => !g); setPicked([]); setGroupName(''); }} hitSlop={hit} style={{ marginRight: 16 }}><Text style={styles.newBtn}>{groupMode ? 'Single' : '👥 Group'}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowNew(false); setGroupMode(false); setPicked([]); }} hitSlop={hit}><Text style={styles.close}>✕</Text></TouchableOpacity>
              </View>
            </View>
            {groupMode ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
                <TextInput style={styles.search} placeholder="Group name (optional)" placeholderTextColor={colors.textMuted} value={groupName} onChangeText={setGroupName} />
                <Text style={styles.pickHint}>{picked.length ? picked.map((p) => p.name).join(', ') : 'Tap members to add (2+)'}</Text>
                <TouchableOpacity onPress={createGroup} disabled={picked.length < 2} style={[styles.createBtn, picked.length < 2 && { opacity: 0.4 }]}><Text style={styles.createBtnTxt}>Create group ({picked.length})</Text></TouchableOpacity>
              </View>
            ) : null}
            <TextInput style={styles.search} placeholder="Type a member's name…" placeholderTextColor={colors.textMuted} value={nameQuery} onChangeText={setNameQuery} autoFocus />
            <FlatList
              data={roster.filter((p) => p.email && String(p.email).toLowerCase() !== me && String(p.name || '').toLowerCase().indexOf(nameQuery.trim().toLowerCase()) >= 0).slice(0, 40)}
              keyExtractor={(p) => p.id || p.email}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const sel = picked.some((x) => String(x.email || '').toLowerCase() === String(item.email).toLowerCase());
                return (
                <TouchableOpacity style={styles.pRow} activeOpacity={0.85} onPress={() => { if (groupMode) { togglePicked(item, picked, setPicked); } else { setShowNew(false); setPendingItem(null); setDraft(''); openThread({ email: String(item.email).toLowerCase(), name: item.name || item.email }); } }}>
                  <View style={styles.avatar}><Text style={styles.avatarTxt}>{(item.name || '?').charAt(0).toUpperCase()}</Text></View>
                  <Text style={styles.pName}>{item.name || item.email}</Text>
                  {groupMode ? <Text style={styles.checkMark}>{sel ? '☑' : '☐'}</Text> : null}
                </TouchableOpacity>
              ); }}
              ListEmptyComponent={<Text style={styles.empty}>No members found.</Text>}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={!!viewerImg} transparent animationType="fade" onRequestClose={() => setViewerImg(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setViewerImg(null)} style={styles.viewerBackdrop}>
          {viewerImg ? <Image source={{ uri: viewerImg }} style={styles.viewerImg} resizeMode="contain" /> : null}
          <TouchableOpacity onPress={() => setViewerImg(null)} style={styles.viewerClose}><Text style={styles.viewerCloseTxt}>✕</Text></TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={!!reactionFor} transparent animationType="fade" onRequestClose={() => setReactionFor(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setReactionFor(null)} style={styles.reactPickBackdrop}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.reactPick}>
            {DM_REACTIONS.map((x) => (
              <TouchableOpacity key={x[0]} onPress={() => pickReaction(x[0])} style={styles.reactPickBtn}><Text style={styles.reactPickEmoji}>{x[1]}</Text></TouchableOpacity>
            ))}
            </View>
            {(() => { const rm = msgs.find((m) => m.id === reactionFor); const mine = !!rm && String(rm.from_email || '').toLowerCase() === me; return mine ? (<TouchableOpacity onPress={() => unsend(reactionFor as string)} style={styles.unsendBtn}><Text style={styles.unsendTxt}>Unsend</Text></TouchableOpacity>) : null; })()}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setMenuOpen(false)} style={styles.menuBackdrop}>
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setSearchOpen(true); }}><Text style={styles.menuTxt}>🔍  Search in chat</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setMediaOpen(true); }}><Text style={styles.menuTxt}>🖼️  Chat media</Text></TouchableOpacity>
            {og.group ? <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setAddPicked([]); setNameQuery(''); setAddOpen(true); }}><Text style={styles.menuTxt}>➕  Add players</Text></TouchableOpacity> : null}
            {og.group ? <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setRenameText(og.name || ''); setRenameOpen(true); }}><Text style={styles.menuTxt}>✏️  Chat name</Text></TouchableOpacity> : null}
            {og.group ? <TouchableOpacity style={styles.menuItem} onPress={doLeave}><Text style={[styles.menuTxt, { color: '#d33' }]}>🚪  Leave chat</Text></TouchableOpacity> : null}
            {og.group && String(og.created_by || '').toLowerCase() === me ? <TouchableOpacity style={styles.menuItem} onPress={doDelete}><Text style={[styles.menuTxt, { color: '#d33' }]}>🗑️  Delete chat</Text></TouchableOpacity> : null}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={mediaOpen} transparent animationType="slide" onRequestClose={() => setMediaOpen(false)}>
        <View style={styles.modalWrap}><View style={styles.sheet}>
          <View style={styles.sheetHead}><Text style={styles.sheetTitle}>Chat media</Text><TouchableOpacity onPress={() => setMediaOpen(false)} hitSlop={hit}><Text style={styles.close}>✕</Text></TouchableOpacity></View>
          <FlatList data={threadMedia} numColumns={3} keyExtractor={(u, i) => String(i)} contentContainerStyle={{ padding: 8 }} renderItem={({ item }) => (<TouchableOpacity onPress={() => { setMediaOpen(false); setViewerImg(item); }}><Image source={{ uri: item }} style={styles.mediaThumb} /></TouchableOpacity>)} ListEmptyComponent={<Text style={styles.empty}>No photos shared yet.</Text>} />
        </View></View>
      </Modal>
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.sheet}>
          <View style={styles.sheetHead}><Text style={styles.sheetTitle}>Add players</Text><TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={hit}><Text style={styles.close}>✕</Text></TouchableOpacity></View>
          <TextInput style={styles.search} placeholder="Type a member's name…" placeholderTextColor={colors.textMuted} value={nameQuery} onChangeText={setNameQuery} />
          <TouchableOpacity onPress={doAddMembers} disabled={!addPicked.length} style={[styles.createBtn, !addPicked.length && { opacity: 0.4 }]}><Text style={styles.createBtnTxt}>Add ({addPicked.length})</Text></TouchableOpacity>
          <FlatList data={roster.filter((p) => p.email && String(p.email).toLowerCase() !== me && !(og.members || []).some((x) => String(x.email || '').toLowerCase() === String(p.email).toLowerCase()) && String(p.name || '').toLowerCase().indexOf(nameQuery.trim().toLowerCase()) >= 0).slice(0, 40)} keyExtractor={(p) => p.id || p.email} keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }} renderItem={({ item }) => { const sel = addPicked.some((x) => String(x.email || '').toLowerCase() === String(item.email).toLowerCase()); return (<TouchableOpacity style={styles.pRow} activeOpacity={0.85} onPress={() => togglePicked(item, addPicked, setAddPicked)}><View style={styles.avatar}><Text style={styles.avatarTxt}>{(item.name || '?').charAt(0).toUpperCase()}</Text></View><Text style={styles.pName}>{item.name || item.email}</Text><Text style={styles.checkMark}>{sel ? '☑' : '☐'}</Text></TouchableOpacity>); }} ListEmptyComponent={<Text style={styles.empty}>No members found.</Text>} />
        </View></KeyboardAvoidingView>
      </Modal>
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.menuBackdrop}><View style={styles.renameBox}>
          <Text style={styles.sheetTitle}>Chat name</Text>
          <TextInput style={styles.search} placeholder="Group name" placeholderTextColor={colors.textMuted} value={renameText} onChangeText={setRenameText} autoFocus />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
            <TouchableOpacity onPress={() => setRenameOpen(false)} style={{ padding: 10, marginRight: 8 }}><Text style={styles.menuTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={doRename} style={styles.createBtn}><Text style={styles.createBtnTxt}>Save</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  unsendBtn: { marginTop: 10, backgroundColor: '#fff', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 26 },
  unsendTxt: { color: '#d33', fontSize: 15, fontWeight: '800' },
  hdrIcon: { color: '#fff', fontSize: 22, fontWeight: '700' },
  searchInChat: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: colors.text, fontSize: 15 },
  bubbleSender: { color: colors.green, fontSize: 12, fontWeight: '800', marginBottom: 2 },
  pickHint: { color: colors.textMuted, fontSize: 13, marginTop: 6, marginBottom: 8 },
  createBtn: { backgroundColor: colors.green, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', marginTop: 4 },
  createBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  checkMark: { fontSize: 20, color: colors.green, marginLeft: 8 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  menuSheet: { position: 'absolute', top: 70, right: 12, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 6, minWidth: 210 },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16 },
  menuTxt: { color: colors.text, fontSize: 15, fontWeight: '600' },
  mediaThumb: { width: 104, height: 104, borderRadius: 8, margin: 3, backgroundColor: colors.card },
  renameBox: { backgroundColor: colors.card, borderRadius: 14, padding: 16, width: '86%' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '94%', height: '80%' },
  viewerClose: { position: 'absolute', top: 44, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseTxt: { color: '#fff', fontSize: 22, fontWeight: '700' },
  reactRow: { flexDirection: 'row', marginTop: 3, paddingHorizontal: 4 },
  reactEmoji: { fontSize: 16, marginRight: 2 },
  reactPickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  reactPick: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 28, paddingVertical: 10, paddingHorizontal: 12 },
  reactPickBtn: { paddingHorizontal: 8 },
  reactPickEmoji: { fontSize: 30 },
  attachBtn: { paddingHorizontal: 6, paddingVertical: 8, alignSelf: 'flex-end' },
  attachIcon: { fontSize: 22 },
  attachPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 6 },
  attachThumb: { width: 60, height: 60, borderRadius: 8 },
  attachX: { marginLeft: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  attachXTxt: { color: '#ffffff', fontWeight: '800' },
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { paddingTop: 58, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: colors.textOnDarkMuted, fontSize: 15, fontWeight: '700' },
  title: { color: colors.textOnDark, fontSize: 15, fontWeight: '900', letterSpacing: 1, flex: 1, textAlign: 'center' },
  empty: { color: colors.textOnDarkMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: 40, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, marginHorizontal: 12, marginTop: 10, padding: 12, borderRadius: radius.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarTxt: { color: '#fff', fontWeight: '900', fontSize: 18 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: colors.text, fontWeight: '800', fontSize: 15, flex: 1, paddingRight: 8 },
  rowTime: { color: colors.textMuted, fontSize: 12 },
  rowLast: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  rowUnread: { color: colors.text, fontWeight: '700' },
  badge: { backgroundColor: colors.green, borderRadius: 11, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  badgeTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  bMine: { backgroundColor: colors.green, borderBottomRightRadius: 4 },
  bThem: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  itemTag: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginBottom: 3 },
  bText: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bubbleImg: { width: 170, height: 128, borderRadius: 8, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.15)' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 30, backgroundColor: colors.bgDarker, gap: 8 },
  cInput: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text, maxHeight: 120 },
  sendBtn: { backgroundColor: colors.green, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 11 },
  sendTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  newBtn: { color: colors.green, fontSize: 14, fontWeight: '800' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, maxHeight: '85%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  close: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  search: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.text, marginBottom: 10 },
  pRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  pName: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
