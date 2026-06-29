import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import {colors, spacing} from '@/theme';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

/**
 * Lightweight horizontal slider built on PanResponder so we don't pull in a
 * native slider dependency. Used for thresholds like the refresh interval.
 */
export const CriteriaSlider: React.FC<Props> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  const clampToStep = (raw: number): number => {
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, stepped));
  };

  const valueFromX = (x: number): number => {
    const w = trackWidthRef.current;
    if (w <= 0) {
      return value;
    }
    const ratio = Math.min(1, Math.max(0, x / w));
    return clampToStep(min + ratio * (max - min));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => onChange(valueFromX(e.nativeEvent.locationX)),
      onPanResponderMove: e => onChange(valueFromX(e.nativeEvent.locationX)),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
  };

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const fillWidth = trackWidth * ratio;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {value}
          {unit}
        </Text>
      </View>
      <View style={styles.track} onLayout={onLayout} {...pan.panHandlers}>
        <View style={styles.trackBase} />
        <View style={[styles.fill, {width: fillWidth}]} />
        <View style={[styles.thumb, {left: Math.max(0, fillWidth - 11)}]} />
      </View>
      <View style={styles.bounds}>
        <Text style={styles.bound}>
          {min}
          {unit}
        </Text>
        <Text style={styles.bound}>
          {max}
          {unit}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {marginVertical: spacing(1)},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {color: colors.text, fontSize: 14, fontWeight: '600'},
  value: {color: colors.primary, fontSize: 14, fontWeight: '700'},
  track: {
    height: 22,
    justifyContent: 'center',
  },
  trackBase: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  bounds: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  bound: {color: colors.textMuted, fontSize: 11},
});
