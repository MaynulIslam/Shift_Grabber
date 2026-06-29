import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import {LogService} from '@/services/LogService';
import {LogItem} from '@/components/LogItem';
import {LogEntry} from '@/types';
import {colors, spacing} from '@/theme';

export const LogScreen: React.FC = () => {
  const [entries, setEntries] = useState<LogEntry[]>(() => LogService.getAll());

  useEffect(() => {
    setEntries(LogService.getAll());
    return LogService.subscribe(setEntries);
  }, []);

  const onClear = useCallback(() => {
    Alert.alert('Clear logs?', 'This removes all saved log entries.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Clear', style: 'destructive', onPress: () => LogService.clear()},
    ]);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{entries.length} entries</Text>
        <TouchableOpacity onPress={onClear} disabled={entries.length === 0}>
          <Text
            style={[styles.clear, entries.length === 0 && styles.clearDisabled]}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        renderItem={({item}) => <LogItem entry={item} />}
        contentContainerStyle={
          entries.length === 0 ? styles.emptyWrap : styles.list
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No activity yet. Logs from monitoring will show here.
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  count: {color: colors.textMuted, fontSize: 13},
  clear: {color: colors.danger, fontWeight: '700', fontSize: 14},
  clearDisabled: {opacity: 0.4},
  list: {paddingHorizontal: spacing(2)},
  emptyWrap: {flexGrow: 1, justifyContent: 'center', alignItems: 'center'},
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing(4),
  },
});
