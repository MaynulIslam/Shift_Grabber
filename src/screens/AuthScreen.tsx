import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAuthStore} from '@/store/useAuthStore';
import {colors, spacing} from '@/theme';

type Mode = 'signin' | 'signup';

export const AuthScreen: React.FC = () => {
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
    } else if (result.needsConfirmation) {
      setInfo('Check your email to confirm your account, then sign in.');
      setMode('signin');
    }
    // On success the auth listener flips the app to the main screen.
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.logo}>🛵</Text>
          <Text style={styles.title}>Shift Grabber</Text>
          <Text style={styles.subtitle}>
            {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaDisabled]}
            disabled={busy}
            onPress={submit}>
            {busy ? (
              <ActivityIndicator color="#06121A" />
            ) : (
              <Text style={styles.ctaText}>
                {mode === 'signin' ? 'Sign in' : 'Sign up'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setInfo(null);
            }}>
            <Text style={styles.switch}>
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  flex: {flex: 1},
  content: {flex: 1, justifyContent: 'center', padding: spacing(3)},
  logo: {fontSize: 56, textAlign: 'center'},
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing(1),
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing(3),
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing(1.5),
  },
  error: {color: colors.danger, fontSize: 13, marginBottom: spacing(1)},
  info: {color: colors.success, fontSize: 13, marginBottom: spacing(1)},
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing(1),
  },
  ctaDisabled: {opacity: 0.6},
  ctaText: {color: '#06121A', fontSize: 17, fontWeight: '800'},
  switch: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing(2.5),
    fontSize: 14,
    fontWeight: '600',
  },
});
