import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useEntitlementStore} from '@/store/useEntitlementStore';
import {colors} from '@/theme';

/**
 * Small plan indicator shown in the header (top-right) on every screen:
 *  - active subscription -> "PRO"
 *  - free trial          -> "Trial · Xd"
 */
export const PlanBadge: React.FC = () => {
  const status = useEntitlementStore(s => s.status);
  const daysLeft = useEntitlementStore(s => s.daysLeft);

  if (status === 'active') {
    return (
      <View style={[styles.badge, styles.pro]}>
        <Text style={styles.proText}>PRO</Text>
      </View>
    );
  }

  if (status === 'trial') {
    const label =
      daysLeft == null
        ? 'Trial'
        : daysLeft <= 0
        ? 'Trial ends today'
        : `Trial ends in ${daysLeft}d`;
    return (
      <View style={[styles.badge, styles.trial]}>
        <Text style={styles.trialDot}>●</Text>
        <Text style={styles.trialText}>{label}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 14,
  },
  trial: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  trialDot: {color: colors.warning, fontSize: 8, marginRight: 5},
  trialText: {color: colors.warning, fontSize: 12, fontWeight: '700'},
  pro: {backgroundColor: colors.warning},
  proText: {
    color: '#1A1206',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
