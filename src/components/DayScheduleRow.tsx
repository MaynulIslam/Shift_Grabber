import React from 'react';
import {View, Text, Switch, TouchableOpacity, StyleSheet} from 'react-native';
import {
  Weekday,
  DayWindow,
  minutesToLabel,
  TIME_STEP_MIN,
} from '@/types';
import {colors, spacing} from '@/theme';

interface Props {
  day: Weekday;
  window: DayWindow;
  onChange: (patch: Partial<DayWindow>) => void;
}

const Stepper: React.FC<{
  label: string;
  value: number;
  onStep: (deltaMin: number) => void;
}> = ({label, value, onStep}) => (
  <View style={styles.stepperWrap}>
    <Text style={styles.stepperLabel}>{label}</Text>
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => onStep(-TIME_STEP_MIN)}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{minutesToLabel(value)}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={() => onStep(TIME_STEP_MIN)}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export const DayScheduleRow: React.FC<Props> = ({day, window, onChange}) => {
  // Wrap past midnight so an end time of 1:00 AM / 2:00 AM (overnight) is reachable.
  const stepStart = (delta: number) =>
    onChange({startMin: wrap(window.startMin + delta)});
  const stepEnd = (delta: number) =>
    onChange({endMin: wrap(window.endMin + delta)});

  const overnight = !window.allDay && window.endMin <= window.startMin;

  return (
    <View style={[styles.card, !window.enabled && styles.cardOff]}>
      <View style={styles.headerRow}>
        <Text style={[styles.day, !window.enabled && styles.dayOff]}>{day}</Text>
        <View style={styles.headerRight}>
          {window.enabled && (
            <Text style={styles.summary}>
              {window.allDay
                ? 'All day'
                : `${minutesToLabel(window.startMin)} – ${minutesToLabel(
                    window.endMin,
                  )}${overnight ? ' (next day)' : ''}`}
            </Text>
          )}
          <Switch
            value={window.enabled}
            onValueChange={v => onChange({enabled: v})}
            trackColor={{true: colors.primary, false: colors.surfaceAlt}}
            thumbColor={colors.text}
          />
        </View>
      </View>

      {window.enabled && (
        <>
          <View style={styles.allDayRow}>
            <Text style={styles.allDayLabel}>All day</Text>
            <Switch
              value={window.allDay}
              onValueChange={v => onChange({allDay: v})}
              trackColor={{true: colors.primary, false: colors.surfaceAlt}}
              thumbColor={colors.text}
            />
          </View>

          {!window.allDay && (
            <View style={styles.steppers}>
              <Stepper label="From" value={window.startMin} onStep={stepStart} />
              <Stepper label="To" value={window.endMin} onStep={stepEnd} />
            </View>
          )}
        </>
      )}
    </View>
  );
};

const wrap = (n: number) => ((n % 1440) + 1440) % 1440;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardOff: {opacity: 0.6},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  day: {color: colors.text, fontSize: 16, fontWeight: '700', width: 48},
  dayOff: {color: colors.textMuted},
  headerRight: {flexDirection: 'row', alignItems: 'center', gap: 10},
  summary: {color: colors.textMuted, fontSize: 12},
  allDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(1),
    paddingTop: spacing(1),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  allDayLabel: {color: colors.text, fontSize: 14},
  steppers: {flexDirection: 'row', gap: 12, marginTop: spacing(1)},
  stepperWrap: {flex: 1},
  stepperLabel: {color: colors.textMuted, fontSize: 11, marginBottom: 4},
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  stepBtn: {paddingHorizontal: 12, paddingVertical: 8},
  stepBtnText: {color: colors.primary, fontSize: 20, fontWeight: '800'},
  stepValue: {color: colors.text, fontSize: 13, fontWeight: '600'},
});
