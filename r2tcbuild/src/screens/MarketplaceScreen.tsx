import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius } from '../theme';
import {
  fetchMarketItems, createMarketItem, setMarketItemSold, deleteMarketItem,
  uploadMedia, MarketItem,
} from '../logic/liveEvents';
import { fetchAllPlayers, getSession } from '../logic/supabase';
import { ADMIN_EMAILS } from '../config';

interface Props {
  onBack: () => void;
  meEmail: string;
  onMessageSeller: (sellerEmail: string, sellerName: string, itemTitle: string, itemImage?: string | null) => void;
  onOpenInbox: () => void;
}

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

export default function MarketplaceScreen({ onBack, meEmail, onMessageSeller, onOpenInbox }: Props) {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<MarketItem | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fCat, setFCat] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fImg, setFImg] = useState<{ uri: string; contentType: string } | null>(null);
  const [posting, setPosting] = useState(false);

  const [me, setMe] = useState(String(meEmail || '').toLowerCase());
  const isAdmin = ADMIN_EMAILS.map((e) => String(e).toLowerCase()).includes(me);
  const [roster, setRoster] = useState<any[]>([]);

  const load = () => { fetchMarketItems().then((x) => { setItems(x || []); setLoading(false); }); };
  useEffect(() => {
    load();
    getSession().then((s: any) => { if (s && s.email) setMe(String(s.email).toLowerCase()); });
    fetchAllPlayers().then((ps: any[]) => {
      setRoster(ps || []);
      const mine = (ps || []).find((p) => String(p.email || '').toLowerCase() === me);
      if (mine && mine.name) setMyName(mine.name);
    });
  }, []);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to add a photo.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    setFImg({ uri: res.assets[0].uri, contentType: 'image/jpeg' });
  };

  const submit = async () => {
    if (!me) { Alert.alert('Sign in first', 'Sign in to list an item.'); return; }
    if (!fTitle.trim()) { Alert.alert('Add a title', 'Give your item a title.'); return; }
    setPosting(true);
    let imageUrl: string | null = null;
    if (fImg) {
      imageUrl = await uploadMedia(fImg.uri, fImg.contentType);
      if (!imageUrl) { setPosting(false); Alert.alert('Upload failed', 'Could not upload the photo.'); return; }
    }
    const res = await createMarketItem({
      seller_email: me, seller_name: nameFor(me),
      title: fTitle.trim(), price: fPrice.trim() || null,
      category: fCat.trim() || null, description: fDesc.trim() || null, image_url: imageUrl,
    });
    setPosting(false);
    if (res.ok) {
      setShowForm(false); setFTitle(''); setFPrice(''); setFCat(''); setFDesc(''); setFImg(null);
      load(); Alert.alert('Listed', 'Your item is now on the marketplace.');
    } else { Alert.alert('Could not list', res.error || ('Status ' + res.status)); }
  };

  const isMine = (it: MarketItem) => String(it.seller_email || '').toLowerCase() === me;
  const toggleSold = async (it: MarketItem) => { const ok = await setMarketItemSold(it.id, !it.sold); if (ok) { setDetail(null); load(); } };
  const removeItem = (it: MarketItem) => {
    Alert.alert('Delete listing', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const ok = await deleteMarketItem(it.id); if (ok) { setDetail(null); load(); } } },
    ]);
  };

  const nameFor = (email: string, fallback?: string) => {
    const p = roster.find((x) => String(x.email || '').toLowerCase() === String(email || '').toLowerCase());
    return (p && p.name) || fallback || (email ? String(email).split('@')[0] : 'Member');
  };

  const mktCats = Array.from(new Set(items.map((x: any) => String(x.category || '').trim()).filter(Boolean)));
  const visibleItems = items.filter((x: any) => {
    const okCat = !catFilter || String(x.category || '').trim() === catFilter;
    const q = query.trim().toLowerCase();
    const okQ = !q || [x.title, x.category, x.description].some((f: any) => String(f || '').toLowerCase().indexOf(q) !== -1);
    return okCat && okQ;
  });
  const renderMktHeader = () => (
    <View style={styles.mktSearchWrap}>
      <TextInput style={styles.mktSearch} placeholder="Search listings..." placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery} />
      {mktCats.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          <TouchableOpacity onPress={() => setCatFilter(null)} style={[styles.mktChip, !catFilter && styles.mktChipOn]}><Text style={[styles.mktChipTxt, !catFilter && styles.mktChipTxtOn]}>All</Text></TouchableOpacity>
          {mktCats.map((c: any) => (
            <TouchableOpacity key={c} onPress={() => setCatFilter(catFilter === c ? null : c)} style={[styles.mktChip, catFilter === c && styles.mktChipOn]}><Text style={[styles.mktChipTxt, catFilter === c && styles.mktChipTxtOn]}>{c}</Text></TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
  const renderCard = ({ item }: { item: MarketItem }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setDetail(item)}>
      <View style={styles.sellerRow}>
        <View style={styles.sellerDot}><Text style={styles.sellerDotTxt}>{(nameFor(item.seller_email, item.seller_name) || '?').charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.cSellerTop} numberOfLines={1}>{nameFor(item.seller_email, item.seller_name)}</Text>
      </View>
      <View style={styles.thumbWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}><Text style={styles.thumbEmojiTxt}>🏌️</Text></View>
        )}
        {item.sold ? <View style={styles.soldBadge}><Text style={styles.soldTxt}>SOLD</Text></View> : null}
      </View>
      <Text style={styles.cTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.cPrice}>{item.price ? item.price : '—'}</Text>
      {isMine(item) ? (
        <View style={styles.ownTag}><Text style={styles.ownTagTxt}>Your listing</Text></View>
      ) : (
        <TouchableOpacity style={styles.chatBtn} activeOpacity={0.85} onPress={() => onMessageSeller(item.seller_email, nameFor(item.seller_email, item.seller_name), item.title, item.image_url || null)}>
          <Text style={styles.chatBtnTxt}>💬  Chat</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={hit}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>MARKETPLACE</Text>
        <TouchableOpacity onPress={onOpenInbox} hitSlop={hit}><Text style={styles.inbox}>💬 Inbox</Text></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visibleItems}
          ListHeaderComponent={renderMktHeader}
          keyExtractor={(x) => x.id}
          numColumns={2}
          renderItem={renderCard}
          columnWrapperStyle={{ paddingHorizontal: 10, gap: 10 }}
          contentContainerStyle={{ paddingBottom: 130, paddingTop: 6, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No items yet. Tap “Sell an item” to list your gear.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setShowForm(true)}>
        <Text style={styles.fabTxt}>＋  Sell an item</Text>
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Sell an item</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={hit}><Text style={styles.close}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.9}>
                {fImg ? <Image source={{ uri: fImg.uri }} style={styles.photoPreview} /> : <Text style={styles.photoBtnTxt}>📷  Add a photo</Text>}
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="Title (e.g. TaylorMade driver)" placeholderTextColor={colors.textMuted} value={fTitle} onChangeText={setFTitle} />
              <TextInput style={styles.input} placeholder="Price (e.g. $150 or Swap)" placeholderTextColor={colors.textMuted} value={fPrice} onChangeText={setFPrice} />
              <TextInput style={styles.input} placeholder="Category (optional, e.g. Clubs)" placeholderTextColor={colors.textMuted} value={fCat} onChangeText={setFCat} />
              <TextInput style={[styles.input, styles.area]} placeholder="Description" placeholderTextColor={colors.textMuted} value={fDesc} onChangeText={setFDesc} multiline />
              <TouchableOpacity style={[styles.primaryBtn, posting && { opacity: 0.6 }]} onPress={submit} disabled={posting} activeOpacity={0.9}>
                <Text style={styles.primaryTxt}>{posting ? 'Posting…' : 'Post listing'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{detail ? detail.title : ''}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={hit}><Text style={styles.close}>✕</Text></TouchableOpacity>
            </View>
            {detail ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
                {detail.image_url ? <Image source={{ uri: detail.image_url }} style={styles.detailImg} /> : null}
                <Text style={styles.dPrice}>{detail.price ? detail.price : '—'}{detail.sold ? '   · SOLD' : ''}</Text>
                {detail.category ? <Text style={styles.dCat}>{detail.category}</Text> : null}
                {detail.description ? <Text style={styles.dDesc}>{detail.description}</Text> : null}
                <Text style={styles.dSeller}>Listed by {nameFor(detail.seller_email, detail.seller_name)}</Text>
                {(isMine(detail) || isAdmin) ? (
                  <View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => toggleSold(detail)} activeOpacity={0.9}><Text style={styles.primaryTxt}>{detail.sold ? 'Mark as available' : 'Mark as sold'}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(detail)} activeOpacity={0.9}><Text style={styles.deleteTxt}>Delete listing</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => { const d = detail; setDetail(null); onMessageSeller(d.seller_email, nameFor(d.seller_email, d.seller_name), d.title, d.image_url || null); }} activeOpacity={0.9}><Text style={styles.primaryTxt}>💬  Message seller</Text></TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mktSearchWrap: { paddingHorizontal: 10, paddingTop: 6 },
  mktSearch: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15 },
  mktChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card, marginRight: 8 },
  mktChipOn: { backgroundColor: colors.green },
  mktChipTxt: { color: colors.text, fontSize: 13, fontWeight: '700' },
  mktChipTxtOn: { color: '#fff' },
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { paddingTop: 58, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: colors.textOnDarkMuted, fontSize: 15, fontWeight: '700' },
  title: { color: colors.textOnDark, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  inbox: { color: colors.green, fontSize: 14, fontWeight: '800' },
  empty: { color: colors.textOnDarkMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: 40, lineHeight: 20 },
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: '100%', height: 130, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbEmojiTxt: { fontSize: 34 },
  soldBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.red, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  soldTxt: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  cTitle: { color: colors.text, fontWeight: '800', fontSize: 14, marginTop: 8 },
  cPrice: { color: colors.greenDark, fontWeight: '900', fontSize: 15, marginTop: 2 },
  cSeller: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cSellerTop: { color: colors.text, fontWeight: '800', fontSize: 13, flex: 1 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sellerDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  sellerDotTxt: { color: '#fff', fontWeight: '900', fontSize: 11 },
  chatBtn: { backgroundColor: colors.green, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  chatBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
  ownTag: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  ownTagTxt: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', bottom: 26, alignSelf: 'center', backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  fabTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 16, paddingTop: 14, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.text, fontWeight: '900', fontSize: 18, flex: 1, paddingRight: 10 },
  close: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  photoBtn: { height: 160, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  photoBtnTxt: { color: colors.textMuted, fontWeight: '700', fontSize: 15 },
  photoPreview: { width: '100%', height: '100%' },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.text, marginBottom: 10 },
  area: { height: 96, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  detailImg: { width: '100%', height: 240, borderRadius: radius.md, backgroundColor: colors.cardAlt, marginBottom: 12 },
  dPrice: { color: colors.greenDark, fontWeight: '900', fontSize: 22 },
  dCat: { color: colors.textMuted, fontWeight: '700', fontSize: 13, marginTop: 4 },
  dDesc: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 10 },
  dSeller: { color: colors.textMuted, fontSize: 13, marginTop: 14, marginBottom: 4 },
  deleteBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  deleteTxt: { color: colors.red, fontWeight: '800', fontSize: 14 },
});
