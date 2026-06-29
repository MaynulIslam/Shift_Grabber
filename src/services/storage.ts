/**
 * Single shared MMKV instance. Importing MMKV in multiple places creates
 * multiple native instances pointing at the same file, so we centralise it.
 */
import {MMKV} from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'smartcourier',
});

/** Storage keys, namespaced to avoid collisions. */
export const StorageKeys = {
  PREFERENCES: 'shift.preferences',
  LOGS: 'logs.entries',
  SELECTED_APP: 'app.selected',
  GLOBAL_SETTINGS: 'app.settings',
} as const;
