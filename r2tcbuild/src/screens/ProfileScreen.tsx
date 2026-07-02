import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

export default function ProfileScreen({ onBack, url, title }: { onBack: () => void; url?: string; title?: string }) {
  const [loading, setLoading] = useState(true);
  const pageUrl = url || 'https://www.r2tctour.com/players';
  const pageTitle = title || 'PLAYER PROFILES';
  const INJECT =
    "(function(){var s=document.createElement('style');" +
    "s.innerHTML='#SITE_HEADER{display:none!important;}#SITE_FOOTER{display:none!important;}';" +
    "document.head.appendChild(s);window.scrollTo(0,0);})();true;";
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Home</Text></TouchableOpacity>
        <Text style={styles.title}>{pageTitle}</Text>
        <View style={{ width: 70 }} />
      </View>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: pageUrl }}
          startInLoadingState
          injectedJavaScript={INJECT}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1, backgroundColor: '#fff' }}
        />
        {loading ? (
          <View style={styles.overlay}><ActivityIndicator size="large" color={colors.green} /></View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDark },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16 },
  back: { color: colors.green, fontWeight: '800', fontSize: 15, width: 70 },
  title: { color: colors.textOnDark, fontWeight: '900', fontSize: 16, letterSpacing: 1, flex: 1, textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgDark },
});
