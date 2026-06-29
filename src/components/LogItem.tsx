import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {LogEntry, LogLevel} from '@/types';
import {colors} from '@/theme';

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: colors.textMuted,
  action: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.danger,
};

const LEVEL_ICON: Record<LogLevel, string> = {
  info: '•',
  action: '➜',
  success: '✓',
  warning: '!',
  error: '✕',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const LogItem: React.FC<{entry: LogEntry}> = ({entry}) => {
  const color = LEVEL_COLOR[entry.level];
  return (
    <View style={styles.row}>
      <Text style={[styles.icon, {color}]}>{LEVEL_ICON[entry.level]}</Text>
      <View style={styles.body}>
        <Text style={styles.message}>{entry.message}</Text>
        <Text style={styles.meta}>
          {formatTime(entry.timestamp)}
          {entry.app ? ` · ${entry.app}` : ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {width: 20, fontSize: 14, fontWeight: '700', textAlign: 'center'},
  body: {flex: 1},
  message: {color: colors.text, fontSize: 14},
  meta: {color: colors.textMuted, fontSize: 11, marginTop: 2},
});
