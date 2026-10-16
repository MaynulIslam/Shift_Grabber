import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useSlingStore} from '@/store/useSlingStore';
import {DayScheduleRow} from '@/components/DayScheduleRow';
import {StatusBadge} from '@/components/StatusBadge';
import {WEEKDAYS, BUFFER_OPTIONS_MIN, bufferLabel} from '@/types';
import {colors, spacing} from '@/theme';

export const SlingScreen: React.FC = () => {
  const rules = useSlingStore(s => s.rules);
  const status = useSlingStore(s => s.status);
  const appliedShifts = useSlingStore(s => s.appliedShifts);
  const setDayWindow = useSlingStore(s => s.setDayWindow);
  const setBufferMin = useSlingStore(s => s.setBufferMin);
  const setAutoApply = useSlingStore(s => s.setAutoApply);
  const setAutoWakeThursday = useSlingStore(s => s.setAutoWakeThursday);

  const activeDays = WEEKDAYS.filter(d => rules.schedule[d].enabled).length;

  const onScanNow = () => {
    // Phase B wires this to the native Sling automation. For now it confirms the
    // rules are saved and explains what's coming.
    Alert.alert(
      'Rules saved ✓',
      `You've set ${activeDays} active day${activeDays === 1 ? '' : 's'} with a ` +
        `${bufferLabel(rules.bufferMin)} buffer. The auto-apply engine (opening ` +
        `Sling → Available → applying to matches) is the next build step — this ` +
        `button will then scan and apply for real.`,
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Uride Shifts</Text>
            <Text style={styles.subtitle}>Auto-apply on Sling</Text>
          </View>
          <StatusBadge status={status} />
        </View>

        <Text style={styles.intro}>
          Pick the days and time windows you want. When shifts drop, the app
          applies to any that fit — whole ranges, or every hour in your window.
        </Text>

        {/* Per-day schedule */}
        <Text style={styles.section}>Days &amp; times</Text>
        {WEEKDAYS.map(day => (
          <DayScheduleRow
            key={day}
            day={day}
            window={rules.schedule[day]}
            onChange={patch => setDayWindow(day, patch)}
          />
        ))}

        {/* Buffer */}
        <Text style={styles.section}>Buffer (flexibility)</Text>
        <Text style={styles.help}>
          If a shift's edges don't exactly match, allow it to start this much
          early or end this much late.
        </Text>
        <View style={styles.segment}>
          {BUFFER_OPTIONS_MIN.map(opt => {
            const active = rules.bufferMin === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.segBtn, active && styles.segBtnActive]}
                onPress={() => setBufferMin(opt)}>
                <Text style={[styles.segText, active && styles.segTextActive]}>
                  {bufferLabel(opt)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toggles */}
        <Text style={styles.section}>How it runs</Text>
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Apply automatically</Text>
              <Text style={styles.toggleSub}>
                Apply to matches on its own. Off = just list them for you.
              </Text>
            </View>
            <Switch
              value={rules.autoApply}
              onValueChange={setAutoApply}
              trackColor={{true: colors.primary, false: colors.surfaceAlt}}
              thumbColor={colors.text}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Auto-wake Thursday</Text>
              <Text style={styles.toggleSub}>
                Wake ~Thursday noon to catch the weekly drop. (Needs battery
                optimization off — best-effort.)
              </Text>
            </View>
            <Switch
              value={rules.autoWakeThursday}
              onValueChange={setAutoWakeThursday}
              trackColor={{true: colors.primary, false: colors.surfaceAlt}}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* Manual trigger */}
        <TouchableOpacity style={styles.cta} onPress={onScanNow}>
          <Text style={styles.ctaText}>Scan &amp; apply now</Text>
        </TouchableOpacity>

        {/* Applied this session */}
        {appliedShifts.length > 0 && (
          <>
            <Text style={styles.section}>Applied this session</Text>
            <View style={styles.appliedCard}>
              {appliedShifts.map((label, i) => (
                <Text key={`${label}-${i}`} style={styles.appliedItem}>
                  ✓ {label}
                </Text>
              ))}
            </View>
          </>
        )}

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Shifts are posted by Uride on Sling (com.gangverk.sling). The app
            reads the "Available" tab and applies to matching open shifts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing(2)},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  title: {color: colors.text, fontSize: 22, fontWeight: '800'},
  subtitle: {color: colors.textMuted, fontSize: 13, marginTop: 2},
  intro: {color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing(2)},
  section: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing(1),
    marginBottom: spacing(1),
  },
  help: {color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: spacing(1)},
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segBtn: {flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center'},
  segBtnActive: {backgroundColor: colors.primary},
  segText: {color: colors.textMuted, fontSize: 14, fontWeight: '700'},
  segTextActive: {color: '#06121A'},
  toggleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing(1.5),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(1.5),
    gap: 12,
  },
  toggleRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  toggleText: {flex: 1},
  toggleTitle: {color: colors.text, fontSize: 15, fontWeight: '600'},
  toggleSub: {color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16},
  cta: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing(2),
  },
  ctaText: {color: '#06121A', fontSize: 16, fontWeight: '800'},
  appliedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing(1.5),
  },
  appliedItem: {color: colors.success, fontSize: 13, paddingVertical: 3},
  note: {
    marginTop: spacing(2),
    padding: spacing(1.5),
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: {color: colors.textMuted, fontSize: 12, lineHeight: 18},
});
