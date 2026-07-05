import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  requestPasswordReset,
  resetPasswordWithCode,
  signInWithPassword,
  signUp,
} from '../logic/supabase';
import { colors, radius } from '../theme';

interface Props {
  bootImage: any;
  checking?: boolean;
  onSignedIn: () => void;
}

/**
 * Full-screen sign-in gate shown before anything else in the app.
 * Uses the boot artwork as its background; once signed in the app
 * goes straight to the home screen on every launch.
 */
export default function AuthGateScreen({ bootImage, checking, onSignedIn }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [handicap, setHandicap] = useState('');
  const [golfId, setGolfId] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const setCleanEmail = (t: string) => setEmail(t.replace(/\s+/g, '').toLowerCase());

  const doSignIn = async () => {
    if (!email.trim() || !password) { setMsg('Enter your email and password.'); return; }
    setBusy(true); setMsg('');
    try {
      await signInWithPassword(email, password);
      onSignedIn();
    } catch (e: any) {
      setMsg((e && e.message) || 'Could not sign in.');
    }
    setBusy(false);
  };

  const doRegister = async () => {
    if (!firstName.trim() || !surname.trim()) { setMsg('Enter your first name and surname.'); return; }
    if (!email.trim() || password.length < 6) { setMsg('Enter your email and a password of at least 6 characters.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await signUp(email, password, firstName, surname, Number(handicap) || 0, golfId);
      if (r.session) onSignedIn();
      else setMsg('Check your email to confirm your account, then sign in.');
    } catch (e: any) {
      setMsg((e && e.message) || 'Could not register.');
    }
    setBusy(false);
  };

  const forgotPassword = async () => {
    if (!email.trim()) { setMsg('Enter your email above first, then tap Forgot password.'); return; }
    setBusy(true); setMsg('');
    try {
      await requestPasswordReset(email);
      setResetSent(true);
      setMsg('We emailed a 6-digit code. Enter it below with a new password.');
    } catch (e: any) {
      setMsg('Could not send the reset code - check the email address.');
    }
    setBusy(false);
  };

  const doReset = async () => {
    if (!resetCode.trim() || resetNewPass.length < 6) { setMsg('Enter the 6-digit code and a new password of at least 6 characters.'); return; }
    setBusy(true); setMsg('');
    try {
      await resetPasswordWithCode(email, resetCode, resetNewPass);
      onSignedIn();
    } catch (e: any) {
      setMsg((e && e.message) || 'Could not reset password. Check the code and try again.');
    }
    setBusy(false);
  };

  return (
    <View style={styles.screen}>
      <Image source={bootImage} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
      <View style={styles.scrim} />
      {checking ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.brand}>R2TC TOUR</Text>
            <Text style={styles.season}>Sign in or register to play</Text>
            <View style={styles.card}>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, mode === 'login' && styles.tabActive]}
                  onPress={() => { setMode('login'); setMsg(''); }}
                >
                  <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Sign in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, mode === 'register' && styles.tabActive]}
                  onPress={() => { setMode('register'); setMsg(''); setResetSent(false); }}
                >
                  <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Register</Text>
                </TouchableOpacity>
              </View>
              {mode === 'register' ? (
                <>
                  <TextInput style={styles.input} placeholder="First name" placeholderTextColor="#9CA3AF" value={firstName} onChangeText={setFirstName} />
                  <TextInput style={styles.input} placeholder="Surname" placeholderTextColor="#9CA3AF" value={surname} onChangeText={setSurname} />
                  <TextInput style={styles.input} placeholder="Handicap (e.g. 18)" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={handicap} onChangeText={setHandicap} />
                  <TextInput style={styles.input} placeholder="Golf Link ID (optional)" placeholderTextColor="#9CA3AF" autoCapitalize="characters" value={golfId} onChangeText={setGolfId} />
                </>
              ) : null}
              <TextInput style={styles.input} placeholder="you@email.com" placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setCleanEmail} />
              {!resetSent ? (
                <TextInput style={styles.input} placeholder={mode === 'register' ? 'Password (at least 6 characters)' : 'Password'} placeholderTextColor="#9CA3AF" secureTextEntry value={password} onChangeText={setPassword} />
              ) : null}
              {mode === 'login' && !resetSent ? (
                <TouchableOpacity onPress={forgotPassword} disabled={busy} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                  <Text style={styles.forgot}>Forgot password?</Text>
                </TouchableOpacity>
              ) : null}
              {mode === 'login' && resetSent ? (
                <>
                  <TextInput style={styles.input} placeholder="6-digit code from email" placeholderTextColor="#9CA3AF" keyboardType="number-pad" value={resetCode} onChangeText={setResetCode} />
                  <TextInput style={styles.input} placeholder="New password" placeholderTextColor="#9CA3AF" secureTextEntry value={resetNewPass} onChangeText={setResetNewPass} />
                  <TouchableOpacity style={styles.primaryBtn} onPress={doReset} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Reset password & sign in</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setResetSent(false); setMsg(''); }} disabled={busy} style={{ alignSelf: 'center', marginTop: 12 }}>
                    <Text style={styles.forgot}>Back to sign in</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={mode === 'register' ? doRegister : doSignIn} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{mode === 'register' ? 'Create account' : 'Sign in'}</Text>}
                </TouchableOpacity>
              )}
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b3d1f' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingTop: 70, paddingBottom: 40 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  season: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: radius.pill, padding: 4, marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.green },
  tabText: { color: '#374151', fontWeight: '800', fontSize: 15 },
  tabTextActive: { color: '#fff' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10, fontSize: 16, color: '#111827' },
  forgot: { color: colors.green, fontSize: 13, fontWeight: '700' },
  primaryBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  msg: { color: '#B91C1C', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
