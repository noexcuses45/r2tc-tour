import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { colors, radius } from '../theme';
import { deleteMyAccount, signOut } from '../logic/supabase';

export default function AccountScreen({ onBack, onPrivacy, onTerms }: { onBack: () => void; onPrivacy: () => void; onTerms: () => void }) {
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      Alert.alert('Done', 'Please close and reopen the app.');
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); reload(); } },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and personal data and cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await deleteMyAccount();
              reload();
            } catch (e) {
              setBusy(false);
              Alert.alert('Error', 'Could not delete your account. Please try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <TouchableOpacity onPress={onBack} style={styles.backRow}>
        <Text style={styles.back}>‹ Home</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Account</Text>

        <TouchableOpacity style={styles.row} onPress={onPrivacy}>
          <Text style={styles.rowText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={onTerms}>
          <Text style={styles.rowText}>Terms of Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={confirmSignOut}>
          <Text style={styles.rowText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row, styles.deleteRow]} onPress={confirmDelete} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.rowText, styles.deleteText]}>Delete Account</Text>}
        </TouchableOpacity>

        <Text style={styles.note}>Deleting your account removes your profile, login and personal content. Past competition results are kept but no longer linked to you.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  backRow: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: colors.textOnDark, fontSize: 16, fontWeight: '700' },
  body: { padding: 16 },
  title: { color: colors.textOnDark, fontSize: 28, fontWeight: '800', marginBottom: 16 },
  row: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  rowText: { color: colors.textOnDark, fontSize: 16, fontWeight: '600' },
  deleteRow: { borderColor: colors.red, marginTop: 12, alignItems: 'center' },
  deleteText: { color: colors.red, fontWeight: '800' },
  note: { color: colors.textOnDarkMuted, fontSize: 12, marginTop: 16, lineHeight: 18 },
});
