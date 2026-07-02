import React from 'react';
import { TouchableOpacity, Text, Alert, StyleSheet } from 'react-native';
import { reportContent, blockUser } from '../logic/supabase';

export default function ReportMenu({ contentType, contentId, authorName, authorEmail, color }: { contentType: string; contentId?: string; authorName?: string; authorEmail?: string; color?: string }) {
  function open() {
    const options: any[] = [
      {
        text: 'Report',
        onPress: async () => {
          try { await reportContent({ contentType, contentId, contentAuthor: authorName }); } catch (e) {}
          Alert.alert('Reported', 'Thanks. Our team will review this within 24 hours.');
        },
      },
    ];
    if (authorName || authorEmail) {
      options.push({
        text: 'Block ' + (authorName || 'user'),
        style: 'destructive',
        onPress: async () => {
          try { await blockUser({ email: authorEmail, name: authorName }); } catch (e) {}
          Alert.alert('Blocked', (authorName || 'User') + ' has been blocked. Restart the app to hide their content.');
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Report or block', authorName ? ('Posted by ' + authorName) : 'Report this content', options);
  }
  return (
    <TouchableOpacity onPress={open} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.btn}>
      <Text style={[styles.dots, color ? { color } : null]}>⋯</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 6, paddingVertical: 2 },
  dots: { fontSize: 20, fontWeight: '800', color: '#9A9A9A' },
});
