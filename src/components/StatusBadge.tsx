import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {ServiceStatus} from '@/types';
import {colors, status as statusColors} from '@/theme';

interface Props {
  status: ServiceStatus;
}

const LABEL: Record<ServiceStatus, string> = {
  OFF: 'OFF',
  STARTING: 'STARTING…',
  RUNNING: 'RUNNING',
  ERROR: 'ERROR',
};

export const StatusBadge: React.FC<Props> = ({status}) => {
  const color = statusColors[status];
  return (
    <View style={[styles.badge, {borderColor: color}]}>
      <View style={[styles.dot, {backgroundColor: color}]} />
      <Text style={[styles.label, {color}]}>{LABEL[status]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
