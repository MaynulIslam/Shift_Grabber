import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAuthStore} from '@/store/useAuthStore';
import {useEntitlementStore} from '@/store/useEntitlementStore';
import {STRIPE_PAYMENT_LINK} from '@/constants/billing';
import {colors, spacing} from '@/theme';

const FEATURES = [
  'Auto-grab open runs that match your schedule',
  'Per-day time windows (incl. overnight)',
  'Hands-free — it watches and taps for you',
  'Stays locked to Open Runs, recovers from drift',
];

export const PaywallScreen: React.FC = () => {
  const signOut = useAuthStore(s => s.signOut);
  const userId = useAuthStore(s => s.session?.user?.id);
  const refresh = useEntitlementStore(s => s.refresh);
  const status = useEntitlementStore(s => s.status);
  const [checking, setChecking] = useState(false);

  const onRefresh = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  const onSubscribe = () => {
    // Open the hosted Stripe checkout, tagged with this account's id so the
    // webhook knows who paid. After paying, the user returns and taps refresh.
    const url = `${STRIPE_PAYMENT_LINK}?client_reference_id=${userId ?? ''}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open checkout', 'Please try again.'),
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.logo}>🛵</Text>
        <Text style={styles.title}>
          {status === 'trial' ? 'Your free trial has ended' : 'Subscription required'}
        </Text>
        <Text style={styles.subtitle}>
          Subscribe to keep grabbing shifts automatically.
        </Text>

        <View style={styles.card}>
          {FEATURES.map(f => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.feature}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>$19.99</Text>
          <Text style={styles.per}> / month CAD</Text>
        </View>

        <TouchableOpacity style={styles.cta} onPress={onSubscribe}>
          <Text style={styles.ctaText}>Subscribe</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondary} onPress={onRefresh}>
          {checking ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryText}>I've subscribed — refresh</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  content: {flex: 1, justifyContent: 'center', padding: spacing(3)},
  logo: {fontSize: 52, textAlign: 'center'},
  title: {
    color: colors.text,
    fontSize: 24,
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing(2),
    marginBottom: spacing(2),
  },
  featureRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10},
  check: {color: colors.success, fontWeight: '800', marginRight: 10, fontSize: 15},
  feature: {color: colors.text, fontSize: 14, flex: 1, lineHeight: 19},
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  price: {color: colors.text, fontSize: 34, fontWeight: '800'},
  per: {color: colors.textMuted, fontSize: 15},
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {color: '#06121A', fontSize: 17, fontWeight: '800'},
  secondary: {alignItems: 'center', paddingVertical: spacing(2)},
  secondaryText: {color: colors.primary, fontSize: 14, fontWeight: '600'},
  signOut: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing(1),
    fontSize: 14,
  },
});
