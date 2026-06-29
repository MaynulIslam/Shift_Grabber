import React, {useEffect} from 'react';
import {View, Text, Switch, ScrollView, TouchableOpacity, StyleSheet} from 'react-native';

import {useAppStore} from '@/store/useAppStore';
import {BridgeService} from '@/services/BridgeService';
import {colors, spacing} from '@/theme';

const Row: React.FC<{
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}> = ({label, hint, value, onValueChange}) => (
  <View style={styles.row}>
    <View style={{flex: 1, paddingRight: spacing(2)}}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{true: colors.primary, false: colors.surfaceAlt}}
      thumbColor={colors.text}
    />
  </View>
);

export const SettingsScreen: React.FC = () => {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const accessibilityEnabled = useAppStore(s => s.accessibilityEnabled);
  const setAccessibilityEnabled = useAppStore(s => s.setAccessibilityEnabled);

  useEffect(() => {
    BridgeService.isAccessibilityEnabled()
      .then(setAccessibilityEnabled)
      .catch(() => {});
  }, [setAccessibilityEnabled]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.groupTitle}>Automation</Text>
      <View style={styles.group}>
        <Row
          label="Automation enabled"
          hint="Master switch. When off, monitoring can't start."
          value={settings.automationEnabled}
          onValueChange={v => updateSettings({automationEnabled: v})}
        />
        <Row
          label="Notify on claim"
          hint="Send a notification each time a shift is grabbed."
          value={settings.notifyOnClaim}
          onValueChange={v => updateSettings({notifyOnClaim: v})}
        />
        <Row
          label="Keep screen on"
          hint="Prevent the phone sleeping while monitoring."
          value={settings.keepScreenOn}
          onValueChange={v => updateSettings({keepScreenOn: v})}
        />
      </View>

      <Text style={styles.groupTitle}>Permissions</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={{flex: 1}}>
            <Text style={styles.label}>Accessibility service</Text>
            <Text style={styles.hint}>
              {accessibilityEnabled ? 'Enabled' : 'Not enabled'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => BridgeService.openAccessibilitySettings()}>
            <Text style={styles.linkBtnText}>Open</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        SmartCourier automates another app's UI on your behalf. This may violate
        that app's terms of service and could put your driver account at risk.
        Use at your own discretion.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {padding: spacing(2)},
  groupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing(1),
    marginTop: spacing(1),
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {color: colors.text, fontSize: 15, fontWeight: '600'},
  hint: {color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 16},
  linkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  linkBtnText: {color: '#06121A', fontWeight: '700'},
  disclaimer: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing(1),
  },
});
