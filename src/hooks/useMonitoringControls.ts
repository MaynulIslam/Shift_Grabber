/**
 * useMonitoringControls — the single source of truth for starting/stopping
 * monitoring, including the automation-master-switch and accessibility-permission
 * gates. Shared by the Home dashboard and the Shift Grabber screen so the gate
 * logic lives in exactly one place.
 */
import {useCallback} from 'react';
import {Alert} from 'react-native';

import {BridgeService} from '@/services/BridgeService';
import {LogService} from '@/services/LogService';
import {useShiftStore} from '@/store/useShiftStore';
import {useAppStore} from '@/store/useAppStore';
import {ServiceStatus} from '@/types';

export interface MonitoringControls {
  status: ServiceStatus;
  isRunning: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useMonitoringControls(): MonitoringControls {
  const status = useShiftStore(s => s.status);
  const preferences = useShiftStore(s => s.preferences);
  const automationEnabled = useAppStore(s => s.settings.automationEnabled);
  const setAccessibilityEnabled = useAppStore(s => s.setAccessibilityEnabled);

  const isRunning = status === 'RUNNING' || status === 'STARTING';

  const start = useCallback(async () => {
    if (!automationEnabled) {
      Alert.alert(
        'Automation disabled',
        'Turn on the master switch in Settings first.',
      );
      return;
    }

    const enabled = await BridgeService.isAccessibilityEnabled();
    setAccessibilityEnabled(enabled);
    if (!enabled) {
      Alert.alert(
        'Accessibility required',
        'Shift Grabber needs the Accessibility permission to read and tap the ' +
          'Skip app. Open settings to enable it?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Open settings',
            onPress: () => BridgeService.openAccessibilitySettings(),
          },
        ],
      );
      return;
    }

    LogService.add('action', 'Start monitoring requested', 'skip');
    const ok = await BridgeService.startMonitoring(preferences);
    if (!ok) {
      Alert.alert(
        'Could not start',
        BridgeService.isAvailable
          ? 'The native service failed to start. Check the logs.'
          : 'Native module not linked yet — build the Android app to run this.',
      );
    }
  }, [automationEnabled, preferences, setAccessibilityEnabled]);

  const stop = useCallback(async () => {
    LogService.add('action', 'Stop monitoring requested', 'skip');
    await BridgeService.stopMonitoring();
  }, []);

  return {status, isRunning, start, stop};
}
