import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { fetchPosts } from '../logic/liveEvents';
import { colors } from '../theme';

const W = Dimensions.get('window').width;
const SIZE = (W - 14 * 2 - 8) / 2;

export default function GalleryScreen({ onBack }: { onBack: () => void }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    let on = true;
    fetchPosts().then((posts) => {
      if (!on) return;
      const m = (posts || []).filter((p) => p && p.media_url);
      setMedia(m); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>PHOTOS & VIDEOS</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
        ) : media.length === 0 ? (
          <Text style={styles.empty}>No photos or videos yet. Anything posted to the tour feed shows up here.</Text>
        ) : (
          <View style={styles.grid}>
            {media.map((p) => (
              <TouchableOpacity key={p.id} style={styles.cell} activeOpacity={0.85} onPress={() => setSel(p)}>
                <Image source={{ uri: p.media_url }} style={styles.img} resizeMode="cover" />
                {p.media_type === 'video' ? (<Text style={styles.play}>▶</Text>) : null}
                {p.author ? (<Text style={styles.cap} numberOfLines={1}>{p.author}</Text>) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={() => setSel(null)}>
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setSel(null)}><Text style={styles.viewerCloseTxt}>✕</Text></TouchableOpacity>
          {sel && sel.media_type === 'video' ? (
            <Video source={{ uri: sel.media_url }} style={styles.viewerMedia} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping={false} />
          ) : sel ? (
            <Image source={{ uri: sel.media_url }} style={styles.viewerMedia} resizeMode="contain" />
          ) : null}
          {sel && (sel.author || sel.text) ? (
            <Text style={styles.viewerCap} numberOfLines={3}>{[sel.author, sel.text].filter(Boolean).join(' — ')}</Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 48, paddingBottom: 14 },
  back: { color: colors.green, fontWeight: '700', fontSize: 15 },
  title: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  body: { padding: 14, paddingBottom: 60 },
  empty: { color: '#9fb0a6', fontSize: 14, textAlign: 'center', marginTop: 30, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  viewerClose: { position: 'absolute', top: 46, right: 18, padding: 8, zIndex: 2 },
  viewerCloseTxt: { color: '#fff', fontSize: 26, fontWeight: '800' },
  viewerMedia: { width: '100%', height: '72%' },
  viewerCap: { color: '#fff', fontSize: 14, marginTop: 14, paddingHorizontal: 20, textAlign: 'center' },
  cell: { width: SIZE, height: SIZE, borderRadius: 12, overflow: 'hidden', marginBottom: 8, backgroundColor: '#0c2014' },
  img: { width: '100%', height: '100%' },
  play: { position: 'absolute', top: '42%', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 26 },
  cap: { position: 'absolute', bottom: 4, left: 6, right: 6, color: '#fff', fontSize: 11, fontWeight: '700' },
});
