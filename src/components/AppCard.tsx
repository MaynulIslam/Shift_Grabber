import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet} from 'react-native';
import {DeliveryApp, ServiceStatus} from '@/types';
import {StatusBadge} from '@/components/StatusBadge';
import {colors, spacing} from '@/theme';

interface Props {
  app: DeliveryApp;
  onPress: (app: DeliveryApp) => void;
  /** When provided, a live status badge is shown instead of the package name. */
  status?: ServiceStatus;
  /** Optional secondary line, e.g. "2 grabbed this session". */
  subtitle?: string;
}

export const AppCard: React.FC<Props> = ({app, onPress, status, subtitle}) => {
  const disabled = !app.enabled;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={() => onPress(app)}
      style={[styles.card, disabled && styles.cardDisabled]}>
      <View style={[styles.accent, {backgroundColor: app.color}]} />
      <View style={styles.body}>
        <Text style={styles.name}>{app.name}</Text>
        {status ? (
          <View style={styles.statusRow}>
            <StatusBadge status={status} />
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : (
          <Text style={styles.pkg}>{subtitle ?? app.packageName}</Text>
        )}
      </View>
      <Text style={[styles.tag, disabled ? styles.tagSoon : styles.tagReady]}>
        {disabled ? 'Soon' : 'Open →'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    marginBottom: spacing(1.5),
  },
  cardDisabled: {opacity: 0.5},
  accent: {
    width: 6,
    height: 44,
    borderRadius: 3,
    marginRight: spacing(1.5),
  },
  body: {flex: 1},
  name: {color: colors.text, fontSize: 16, fontWeight: '700'},
  pkg: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8},
  subtitle: {color: colors.textMuted, fontSize: 12},
  tag: {fontSize: 13, fontWeight: '700'},
  tagReady: {color: colors.primary},
  tagSoon: {color: colors.textMuted},
});
