/**
 * Global app store — cross-feature UI state and global settings.
 * Persisted to MMKV manually (Zustand persist middleware works with MMKV but we
 * keep it explicit and dependency-light here).
 */
import {create} from 'zustand';
import {DeliveryAppId} from '@/types';
import {storage, StorageKeys} from '@/services/storage';

export interface GlobalSettings {
  /** Master kill switch — when false, monitoring can't be started. */
  automationEnabled: boolean;
  /** Show a local notification on every claim. */
  notifyOnClaim: boolean;
  /** Keep the phone awake while monitoring. */
  keepScreenOn: boolean;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  automationEnabled: true,
  notifyOnClaim: true,
  keepScreenOn: false,
};

function loadSettings(): GlobalSettings {
  const raw = storage.getString(StorageKeys.GLOBAL_SETTINGS);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }
  try {
    return {...DEFAULT_SETTINGS, ...JSON.parse(raw)};
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface AppState {
  selectedApp: DeliveryAppId | null;
  settings: GlobalSettings;
  accessibilityEnabled: boolean;
  /** "Display over other apps" — required for auto-opening Skip. */
  overlayEnabled: boolean;

  selectApp: (id: DeliveryAppId | null) => void;
  setAccessibilityEnabled: (enabled: boolean) => void;
  setOverlayEnabled: (enabled: boolean) => void;
  updateSettings: (patch: Partial<GlobalSettings>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedApp:
    (storage.getString(StorageKeys.SELECTED_APP) as DeliveryAppId | null) ??
    null,
  settings: loadSettings(),
  accessibilityEnabled: false,
  overlayEnabled: false,

  selectApp: id => {
    if (id) {
      storage.set(StorageKeys.SELECTED_APP, id);
    } else {
      storage.delete(StorageKeys.SELECTED_APP);
    }
    set({selectedApp: id});
  },

  setAccessibilityEnabled: enabled => set({accessibilityEnabled: enabled}),

  setOverlayEnabled: enabled => set({overlayEnabled: enabled}),

  updateSettings: patch => {
    const next = {...get().settings, ...patch};
    storage.set(StorageKeys.GLOBAL_SETTINGS, JSON.stringify(next));
    set({settings: next});
  },
}));
