import React, {useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';

import {HomeStackParamList} from '@/navigation/types';
import {AppCard} from '@/components/AppCard';
import {StatusBadge} from '@/components/StatusBadge';
import {DELIVERY_APPS} from '@/constants/apps';
import {useAppStore} from '@/store/useAppStore';
import {useShiftStore} from '@/store/useShiftStore';
import {useMonitoringControls} from '@/hooks/useMonitoringControls';
import {BridgeService} from '@/services/BridgeService';
import {DeliveryApp} from '@/types';
import {colors, spacing} from '@/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const selectApp = useAppStore(s => s.selectApp);
  const automationEnabled = useAppStore(s => s.settings.automationEnabled);
  const accessibilityEnabled = useAppStore(s => s.accessibilityEnabled);
  const setAccessibilityEnabled = useAppStore(s => s.setAccessibilityEnabled);
  const overlayEnabled = useAppStore(s => s.overlayEnabled);
  const setOverlayEnabled = useAppStore(s => s.setOverlayEnabled);

  const status = useShiftStore(s => s.status);
  const claimedCount = useShiftStore(s => s.claimedShifts.length);

  const {isRunning, start, stop} = useMonitoringControls();

  // Refresh the accessibility flag whenever the screen regains focus.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      BridgeService.isAccessibilityEnabled()
        .then(setAccessibilityEnabled)
        .catch(() => {});
      BridgeService.canDrawOverlays()
        .then(setOverlayEnabled)
        .catch(() => {});
    });
    return unsub;
  }, [navigation, setAccessibilityEnabled, setOverlayEnabled]);

  const onSelect = (app: DeliveryApp) => {
    selectApp(app.id);
    if (app.id === 'skip') {
      navigation.navigate('Skip');
    }
  };

  const cardSubtitle = (app: DeliveryApp): string | undefined => {
    if (app.id !== 'skip') {
      return undefined;
    }
    if (isRunning) {
      return `${claimedCount} grabbed this session`;
    }
    return claimedCount > 0 ? `${claimedCount} grabbed` : 'Tap to configure';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero: overall monitoring status */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Monitoring</Text>
            <StatusBadge status={status} />
          </View>
          <Text style={styles.heroStat}>
            {claimedCount}
            <Text style={styles.heroStatLabel}> grabbed this session</Text>
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!automationEnabled}
            onPress={isRunning ? stop : start}
            style={[
              styles.heroBtn,
              isRunning ? styles.heroBtnStop : styles.heroBtnStart,
              !automationEnabled && styles.heroBtnDisabled,
            ]}>
            <Text style={styles.heroBtnText}>
              {isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
            </Text>
          </TouchableOpacity>
          {!automationEnabled && (
            <Text style={styles.heroHint}>
              Automation is off — enable the master switch in Settings.
            </Text>
          )}
        </View>

        {/* Accessibility permission gate */}
        {!accessibilityEnabled && (
          <TouchableOpacity
            style={styles.warnBanner}
            onPress={() => BridgeService.openAccessibilitySettings()}>
            <Text style={styles.warnTitle}>⚠️ Accessibility not enabled</Text>
            <Text style={styles.warnText}>
              Tap to grant it. Required before monitoring can read and tap shift
              cards.
            </Text>
          </TouchableOpacity>
        )}

        {/* Auto-open gate (optional — enables launching Skip for you) */}
        {accessibilityEnabled && !overlayEnabled && (
          <TouchableOpacity
            style={styles.infoBanner}
            onPress={() => BridgeService.openOverlaySettings()}>
            <Text style={styles.infoTitle}>↗ Enable auto-open (optional)</Text>
            <Text style={styles.infoText}>
              Grant "Display over other apps" so Shift Grabber can open Skip and go
              to Open Runs for you. Without it, keep Skip open yourself.
            </Text>
          </TouchableOpacity>
        )}

        {/* App selector */}
        <Text style={styles.sectionTitle}>Your delivery apps</Text>
        {DELIVERY_APPS.map(app => (
          <AppCard
            key={app.id}
            app={app}
            onPress={onSelect}
            status={app.id === 'skip' ? status : undefined}
            subtitle={cardSubtitle(app)}
          />
        ))}

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Only Skip The Dishes is wired up right now. Uber Eats and DoorDash
            are placeholders for later.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing(2)},

  hero: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    marginBottom: spacing(2),
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {color: colors.text, fontSize: 18, fontWeight: '800'},
  heroStat: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing(1.5),
  },
  heroStatLabel: {color: colors.textMuted, fontSize: 14, fontWeight: '500'},
  heroBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing(2),
  },
  heroBtnStart: {backgroundColor: colors.success},
  heroBtnStop: {backgroundColor: colors.danger},
  heroBtnDisabled: {opacity: 0.4},
  heroBtnText: {color: '#06121A', fontSize: 16, fontWeight: '800'},
  heroHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing(1),
    textAlign: 'center',
  },

  warnBanner: {
    backgroundColor: '#3A2A12',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing(1.5),
    marginBottom: spacing(2),
  },
  warnTitle: {color: colors.warning, fontWeight: '700', fontSize: 14},
  warnText: {color: colors.text, fontSize: 12, marginTop: 4, lineHeight: 17},

  infoBanner: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing(1.5),
    marginBottom: spacing(2),
  },
  infoTitle: {color: colors.primary, fontWeight: '700', fontSize: 14},
  infoText: {color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17},

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing(1.5),
  },
  note: {
    marginTop: spacing(1),
    padding: spacing(1.5),
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: {color: colors.textMuted, fontSize: 12, lineHeight: 18},
});
