import ReportMenu from '../components/ReportMenu';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { fetchMessages, sendMessage, uploadMedia, LiveMessage } from '../logic/liveEvents';
import { getProfile } from '../logic/supabase';
import { colors, radius } from '../theme';
import { Round } from '../types';

export default function ChatScreen({ round }: { round: Round }) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [text, setText] = useState('');
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<{ uri: string; type: string; contentType: string } | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<any>(null);
  const scrollRef = useRef<any>(null);
  const eventId = round.liveEventId as string;

  const load = async () => {
    const msgs = await fetchMessages(eventId);
    setMessages(msgs);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      if (p && (p.first_name || p.surname)) {
        setMe(((p.first_name || '') + ' ' + (p.surname || '')).replace(/\s+/g, ' ').trim());
      } else if (p) {
        setMe(p.email);
      }
    })();
    load();
    timer.current = setInterval(load, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.6 });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === 'video';
    setMedia({ uri: a.uri, type: isVideo ? 'video' : 'image', contentType: isVideo ? 'video/mp4' : 'image/jpeg' });
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
  const sendGifMsg = async (url: string) => {
    setGifOpen(false); setGifQuery(''); setSending(true);
    try { await sendMessage(eventId, me || 'Player', '', url, 'image'); } catch (e) {}
    setSending(false); load();
  };
  const send = async () => {
    const t = text.trim();
    if (!t && !media) return;
    setSending(true);
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (media) {
      mediaUrl = await uploadMedia(media.uri, media.contentType);
      if (!mediaUrl) { setSending(false); return; }
      mediaType = media.type;
    }
    await sendMessage(eventId, me || 'Player', t, mediaUrl, mediaType);
    setText('');
    setMedia(null);
    setSending(false);
    load();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>EVENT CHAT</Text>
        <Text style={styles.sub} numberOfLines={1}>{round.name}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          onContentSizeChange={() => scrollRef.current && scrollRef.current.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text style={styles.empty}>No messages yet. Say hello 👋</Text>
          ) : (
            messages.map((m) => {
              const mine = m.author === me;
              return (
                <View key={m.id} style={[styles.row, mine ? styles.rowMine : null]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : null]}>
                    {!mine ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.author}>{m.author}</Text>
                <ReportMenu contentType="live_message" contentId={m.id} authorName={m.author} />
              </View>
            ) : null}
                    {m.text ? (
                      <Text style={[styles.msgText, mine ? styles.msgTextMine : null]}>{m.text}</Text>
                    ) : null}
                    {m.media_url ? (
                      m.media_type === 'video' ? (
                        <Video source={{ uri: m.media_url }} style={styles.media} useNativeControls resizeMode={ResizeMode.CONTAIN} />
                      ) : (
                        <Image source={{ uri: m.media_url }} style={styles.media} resizeMode="cover" />
                      )
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      {media ? (
        <View style={styles.preview}>
          {media.type === 'image' ? (
            <Image source={{ uri: media.uri }} style={styles.previewImg} />
          ) : (
            <Text style={styles.previewVid}>📹 Video attached</Text>
          )}
          <TouchableOpacity onPress={() => setMedia(null)}><Text style={styles.removeMedia}>Remove</Text></TouchableOpacity>
        </View>
      ) : null}
      {gifOpen ? (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', padding: 8, borderRadius: 12, marginBottom: 6 }}>
            <TextInput style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 }} placeholder="Search GIFs..." placeholderTextColor="#999" value={gifQuery} onChangeText={(v: string) => { setGifQuery(v); searchGifs(v); }} />
            <ScrollView horizontal style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
              {gifResults.map((u, i) => (
                <TouchableOpacity key={i} onPress={() => { sendGifMsg(u); }}>
                  <Image source={{ uri: u }} style={{ width: 120, height: 90, borderRadius: 8, marginRight: 6, backgroundColor: '#222' }} />
                </TouchableOpacity>
              ))}
              {gifResults.length === 0 ? (<Text style={{ color: '#999', fontSize: 12, padding: 10 }}>No GIFs loaded - check your internet.</Text>) : null}
            </ScrollView>
            <Text style={{ color: '#777', fontSize: 9, textAlign: 'center', marginTop: 4 }}>Powered by GIPHY</Text>
          </View>
        ) : null}
        <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message the field…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.mediaBtn} onPress={pickMedia}>
          <Text style={styles.mediaIcon}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaBtn} onPress={() => { const nv = !gifOpen; setGifOpen(nv); if (nv) { setGifQuery(''); searchGifs(''); } }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#31c46b' }}>GIF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
          <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { paddingTop: 50, paddingBottom: 10, paddingHorizontal: 16, alignItems: 'center' },
  title: { color: colors.textOnDark, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  sub: { color: colors.textOnDarkMuted, fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14, paddingBottom: 20 },
  empty: { color: colors.textOnDarkMuted, textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', marginBottom: 8 },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.green },
  author: { color: colors.greenDark, fontWeight: '800', fontSize: 12, marginBottom: 2 },
  msgText: { color: colors.text, fontSize: 15 },
  msgTextMine: { color: '#fff' },
  media: { width: 200, height: 200, borderRadius: radius.md, marginTop: 6, backgroundColor: colors.bgDarker },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 6 },
  previewImg: { width: 48, height: 48, borderRadius: 8 },
  previewVid: { color: colors.textOnDarkMuted, fontSize: 13 },
  removeMedia: { color: '#FF6B6B', fontWeight: '700', fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 30, backgroundColor: colors.bgDarker },
  input: { flex: 1, maxHeight: 110, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15 },
  mediaBtn: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  mediaIcon: { fontSize: 18 },
  sendBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12 },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
