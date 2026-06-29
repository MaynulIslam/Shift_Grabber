import React from 'react';
import {View, Text, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {HomeStackParamList} from '@/navigation/types';
import {useShiftStore} from '@/store/useShiftStore';
import {StatusBadge} from '@/components/StatusBadge';
import {colors, spacing} from '@/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Skip'>;

interface FeatureRow {
  key: string;
  title: string;
  subtitle: string;
  route?: keyof HomeStackParamList;
  enabled: boolean;
}

const FEATURES: FeatureRow[] = [
  {
    key: 'shift-grabber',
    title: 'Shift Grabber',
    subtitle: 'Auto-claim open shifts that match your preferences.',
    route: 'ShiftGrabber',
    enabled: true,
  },
  {
    key: 'auto-accept',
    title: 'Auto-Accept Orders',
    subtitle: 'Coming soon.',
    enabled: false,
  },
];

export const SkipScreen: React.FC<Props> = ({navigation}) => {
  const status = useShiftStore(s => s.status);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Shift Grabber</Text>
        <StatusBadge status={status} />
      </View>

      {FEATURES.map(f => (
        <TouchableOpacity
          key={f.key}
          activeOpacity={0.8}
          disabled={!f.enabled}
          onPress={() => f.route && navigation.navigate(f.route)}
          style={[styles.card, !f.enabled && styles.cardDisabled]}>
          <View style={{flex: 1}}>
            <Text style={styles.cardTitle}>{f.title}</Text>
            <Text style={styles.cardSubtitle}>{f.subtitle}</Text>
          </View>
          <Text style={styles.chevron}>{f.enabled ? '→' : ''}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {padding: spacing(2)},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  statusLabel: {color: colors.text, fontSize: 16, fontWeight: '700'},
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
  cardTitle: {color: colors.text, fontSize: 16, fontWeight: '700'},
  cardSubtitle: {color: colors.textMuted, fontSize: 13, marginTop: 2},
  chevron: {color: colors.primary, fontSize: 20, fontWeight: '700'},
});
