/**
 * Shift Grabber feature store.
 *
 * Owns: the driver's preferences, the live monitoring status (mirrored from the
 * native service), and the list of shifts claimed this session. Preferences are
 * persisted to MMKV; status/claims are runtime-only.
 */
import {create} from 'zustand';
import {
  ShiftPreferences,
  DEFAULT_PREFERENCES,
  ServiceStatus,
  Shift,
  Weekday,
  WEEKDAYS,
  DayWindow,
  WeekSchedule,
  DEFAULT_DAY_WINDOW,
  makeDefaultSchedule,
  REFRESH_INTERVAL_MIN,
  REFRESH_INTERVAL_MAX,
} from '@/types';
import {storage, StorageKeys} from '@/services/storage';

/** Ensure a loaded schedule has every weekday (handles old/partial saves). */
function normalizeSchedule(raw: Partial<WeekSchedule> | undefined): WeekSchedule {
  const base = makeDefaultSchedule();
  if (!raw) {
    return base;
  }
  for (const d of WEEKDAYS) {
    if (raw[d]) {
      base[d] = {...DEFAULT_DAY_WINDOW, ...raw[d]};
    }
  }
  return base;
}

function loadPreferences(): ShiftPreferences {
  const raw = storage.getString(StorageKeys.PREFERENCES);
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      schedule: normalizeSchedule(parsed.schedule),
      zones: Array.isArray(parsed.zones) ? parsed.zones : [],
      autoGrab: Boolean(parsed.autoGrab),
      refreshIntervalSec: parsed.refreshIntervalSec ?? 15,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const clampInterval = (n: number): number =>
  Math.min(REFRESH_INTERVAL_MAX, Math.max(REFRESH_INTERVAL_MIN, Math.round(n)));

// Wrap to a single day so stepping past midnight loops to 12:00 AM (overnight
// windows are then expressed as end <= start and handled by the matcher).
const clampMin = (n: number): number => ((Math.round(n) % 1440) + 1440) % 1440;

interface ShiftState {
  preferences: ShiftPreferences;
  status: ServiceStatus;
  claimedShifts: Shift[];

  // schedule mutators
  setDayWindow: (day: Weekday, patch: Partial<DayWindow>) => void;
  applyToAllDays: (window: DayWindow) => void;

  // other preference mutators
  setZones: (zones: string[]) => void;
  setAutoGrab: (on: boolean) => void;
  setRefreshInterval: (sec: number) => void;

  // status / results (driven by native events via BridgeService)
  setStatus: (status: ServiceStatus) => void;
  addClaimedShift: (shift: Shift) => void;
}

function persist(prefs: ShiftPreferences) {
  storage.set(StorageKeys.PREFERENCES, JSON.stringify(prefs));
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  preferences: loadPreferences(),
  status: 'OFF',
  claimedShifts: [],

  setDayWindow: (day, patch) => {
    const cur = get().preferences;
    const merged: DayWindow = {...cur.schedule[day], ...patch};
    merged.startMin = clampMin(merged.startMin);
    merged.endMin = clampMin(merged.endMin);
    const next: ShiftPreferences = {
      ...cur,
      schedule: {...cur.schedule, [day]: merged},
    };
    persist(next);
    set({preferences: next});
  },

  applyToAllDays: window => {
    const cur = get().preferences;
    const schedule = WEEKDAYS.reduce((acc, d) => {
      acc[d] = {...window};
      return acc;
    }, {} as WeekSchedule);
    const next = {...cur, schedule};
    persist(next);
    set({preferences: next});
  },

  setZones: zones => {
    const next = {...get().preferences, zones};
    persist(next);
    set({preferences: next});
  },

  setAutoGrab: on => {
    const next = {...get().preferences, autoGrab: on};
    persist(next);
    set({preferences: next});
  },

  setRefreshInterval: sec => {
    const next = {...get().preferences, refreshIntervalSec: clampInterval(sec)};
    persist(next);
    set({preferences: next});
  },

  setStatus: status => set({status}),

  addClaimedShift: shift =>
    set(state => ({claimedShifts: [shift, ...state.claimedShifts]})),
}));
