import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';

import {useShiftStore} from '@/store/useShiftStore';
import {useAppStore} from '@/store/useAppStore';
import {BridgeService} from '@/services/BridgeService';
import {useMonitoringControls} from '@/hooks/useMonitoringControls';
import {StatusBadge} from '@/components/StatusBadge';
import {CriteriaSlider} from '@/components/CriteriaSlider';
import {DayScheduleRow} from '@/components/DayScheduleRow';
import {
  WEEKDAYS,
  DEFAULT_DAY_WINDOW,
  REFRESH_INTERVAL_MIN,
  REFRESH_INTERVAL_MAX,
} from '@/types';
import {colors, spacing} from '@/theme';

const Section: React.FC<{title: string; children: React.ReactNode}> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

export const ShiftGrabberScreen: React.FC = () => {
  const {
    preferences,
    status,
    claimedShifts,
    setDayWindow,
    applyToAllDays,
    setZones,
    setAutoGrab,
    setRefreshInterval,
  } = useShiftStore();

  const accessibilityEnabled = useAppStore(s => s.accessibilityEnabled);
  const {isRunning, start, stop} = useMonitoringControls();

  const [zonesText, setZonesText] = useState(preferences.zones.join(', '));

  const commitZones = (text: string) => {
    const zones = text
      .split(',')
      .map(z => z.trim())
      .filter(Boolean);
    setZones(zones);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Status header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Monitoring</Text>
          <Text style={styles.muted}>
            {claimedShifts.length} grabbed this session
          </Text>
        </View>
        <StatusBadge status={status} />
      </View>

      {/* Accessibility gate */}
      {!accessibilityEnabled && (
        <TouchableOpacity
          style={styles.warnBanner}
          onPress={() => BridgeService.openAccessibilitySettings()}>
          <Text style={styles.warnTitle}>⚠️ Accessibility not enabled</Text>
          <Text style={styles.warnText}>
            Tap to open settings and enable SmartCourier. Required to read and
            tap shift cards.
          </Text>
        </TouchableOpacity>
      )}

      {/* Schedule: per-day time windows */}
      <Section title="Days & times">
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => applyToAllDays({...DEFAULT_DAY_WINDOW})}>
            <Text style={styles.quickText}>All days · all day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => applyToAllDays({...preferences.schedule.Mon})}>
            <Text style={styles.quickText}>Copy Mon → all</Text>
          </TouchableOpacity>
        </View>
        {WEEKDAYS.map(day => (
          <DayScheduleRow
            key={day}
            day={day}
            window={preferences.schedule[day]}
            onChange={patch => setDayWindow(day, patch)}
          />
        ))}
        <Text style={styles.hint}>
          Turn a day off to skip it. "All day" grabs any time; otherwise it only
          grabs runs starting within your window.
        </Text>
      </Section>

      {/* Zones */}
      <Section title="Preferred zones">
        <TextInput
          value={zonesText}
          onChangeText={setZonesText}
          onBlur={() => commitZones(zonesText)}
          placeholder="Downtown, North End, …"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.hint}>
          Comma-separated, matched against shift cards. Empty = any zone.
        </Text>
      </Section>

      {/* Auto-grab */}
      <Section title="Auto-grab">
        <View style={styles.switchRow}>
          <View style={{flex: 1}}>
            <Text style={styles.switchLabel}>Tap claim automatically</Text>
            <Text style={styles.hint}>
              Off = notify only, don't tap. On = claim matching shifts instantly.
            </Text>
          </View>
          <Switch
            value={preferences.autoGrab}
            onValueChange={setAutoGrab}
            trackColor={{true: colors.primary, false: colors.surfaceAlt}}
            thumbColor={colors.text}
          />
        </View>
      </Section>

      {/* Refresh interval */}
      <Section title="Refresh interval">
        <CriteriaSlider
          label="Refresh every"
          value={preferences.refreshIntervalSec}
          min={REFRESH_INTERVAL_MIN}
          max={REFRESH_INTERVAL_MAX}
          step={1}
          unit="s"
          onChange={setRefreshInterval}
        />
      </Section>

      {/* Start / Stop */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={isRunning ? stop : start}
        style={[styles.cta, isRunning ? styles.ctaStop : styles.ctaStart]}>
        <Text style={styles.ctaText}>
          {isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {padding: spacing(2), paddingBottom: spacing(6)},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  h1: {color: colors.text, fontSize: 22, fontWeight: '800'},
  muted: {color: colors.textMuted, fontSize: 13, marginTop: 2},
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
  section: {marginBottom: spacing(2.5)},
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  chipText: {color: colors.textMuted, fontWeight: '600', fontSize: 13},
  chipTextActive: {color: '#0B1220'},
  quickRow: {flexDirection: 'row', gap: 8, marginBottom: spacing(1.5)},
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  quickText: {color: colors.primary, fontWeight: '700', fontSize: 13},
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  hint: {color: colors.textMuted, fontSize: 12, marginTop: 6},
  switchRow: {flexDirection: 'row', alignItems: 'center'},
  switchLabel: {color: colors.text, fontSize: 15, fontWeight: '600'},
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing(1),
  },
  ctaStart: {backgroundColor: colors.success},
  ctaStop: {backgroundColor: colors.danger},
  ctaText: {color: '#06121A', fontSize: 17, fontWeight: '800'},
});
