/**
 * Uride / Sling grabber store.
 *
 * Owns the driver's auto-apply rules (per-day windows + buffer + triggers),
 * persisted to MMKV, plus runtime status and the shifts applied-to this session.
 * Mirrors useShiftStore so the two grabbers behave consistently.
 */
import {create} from 'zustand';
import {
  SlingRules,
  DEFAULT_SLING_RULES,
  ServiceStatus,
  Weekday,
  WEEKDAYS,
  DayWindow,
  WeekSchedule,
  DEFAULT_DAY_WINDOW,
  makeDefaultSchedule,
} from '@/types';
import {storage, StorageKeys} from '@/services/storage';

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

function loadRules(): SlingRules {
  const raw = storage.getString(StorageKeys.SLING_RULES);
  if (!raw) {
    return DEFAULT_SLING_RULES;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      schedule: normalizeSchedule(parsed.schedule),
      bufferMin: typeof parsed.bufferMin === 'number' ? parsed.bufferMin : 60,
      autoApply: parsed.autoApply !== false,
      autoWakeThursday: parsed.autoWakeThursday !== false,
    };
  } catch {
    return DEFAULT_SLING_RULES;
  }
}

const clampMin = (n: number): number => ((Math.round(n) % 1440) + 1440) % 1440;

interface SlingState {
  rules: SlingRules;
  status: ServiceStatus;
  /** Human labels of shifts applied-to this session, e.g. "Sat 6:00 PM – 7:00 PM". */
  appliedShifts: string[];

  setDayWindow: (day: Weekday, patch: Partial<DayWindow>) => void;
  applyToAllDays: (window: DayWindow) => void;
  setBufferMin: (min: number) => void;
  setAutoApply: (on: boolean) => void;
  setAutoWakeThursday: (on: boolean) => void;

  setStatus: (status: ServiceStatus) => void;
  addAppliedShift: (label: string) => void;
  resetAppliedShifts: () => void;
}

function persist(rules: SlingRules) {
  storage.set(StorageKeys.SLING_RULES, JSON.stringify(rules));
}

export const useSlingStore = create<SlingState>((set, get) => ({
  rules: loadRules(),
  status: 'OFF',
  appliedShifts: [],

  setDayWindow: (day, patch) => {
    const cur = get().rules;
    const merged: DayWindow = {...cur.schedule[day], ...patch};
    merged.startMin = clampMin(merged.startMin);
    merged.endMin = clampMin(merged.endMin);
    const next: SlingRules = {
      ...cur,
      schedule: {...cur.schedule, [day]: merged},
    };
    persist(next);
    set({rules: next});
  },

  applyToAllDays: window => {
    const cur = get().rules;
    const schedule = WEEKDAYS.reduce((acc, d) => {
      acc[d] = {...window};
      return acc;
    }, {} as WeekSchedule);
    const next = {...cur, schedule};
    persist(next);
    set({rules: next});
  },

  setBufferMin: min => {
    const next = {...get().rules, bufferMin: Math.max(0, Math.round(min))};
    persist(next);
    set({rules: next});
  },

  setAutoApply: on => {
    const next = {...get().rules, autoApply: on};
    persist(next);
    set({rules: next});
  },

  setAutoWakeThursday: on => {
    const next = {...get().rules, autoWakeThursday: on};
    persist(next);
    set({rules: next});
  },

  setStatus: status => set({status}),

  addAppliedShift: label =>
    set(state => ({appliedShifts: [label, ...state.appliedShifts]})),

  resetAppliedShifts: () => set({appliedShifts: []}),
}));
