/**
 * Shared TypeScript contracts for SmartCourier.
 *
 * These types are the single source of truth shared between the JS layer and
 * the shape of data crossing the React Native bridge from the Kotlin modules.
 * Keep this in sync with the payloads emitted by ShiftGrabberModule.kt.
 */

// ---------------------------------------------------------------------------
// Delivery apps
// ---------------------------------------------------------------------------

export type DeliveryAppId = 'skip' | 'ubereats' | 'doordash';

export interface DeliveryApp {
  id: DeliveryAppId;
  name: string;
  /** Android package name of the target app, used by the AccessibilityService. */
  packageName: string;
  /** Whether this app's automation is implemented yet. */
  enabled: boolean;
  /** Accent color used by the AppCard. */
  color: string;
}

// ---------------------------------------------------------------------------
// Service status
// ---------------------------------------------------------------------------

/**
 * OFF     – monitoring not started
 * STARTING– foreground service / accessibility spinning up
 * RUNNING – actively monitoring + refreshing
 * ERROR   – something failed (e.g. accessibility permission revoked)
 */
export type ServiceStatus = 'OFF' | 'STARTING' | 'RUNNING' | 'ERROR';

// ---------------------------------------------------------------------------
// Shift grabber preferences
// ---------------------------------------------------------------------------

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const WEEKDAYS: Weekday[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

export type TimeSlot = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

export const TIME_SLOTS: TimeSlot[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
];

/** A single day's grab window. Times are minutes from midnight (0–1440). */
export interface DayWindow {
  /** Grab runs on this day at all? */
  enabled: boolean;
  /** Any time of day (ignore start/end). */
  allDay: boolean;
  startMin: number; // e.g. 0 = 12:00 AM
  endMin: number; // e.g. 720 = 12:00 PM, 1440 = midnight (end of day)
}

export type WeekSchedule = {[K in Weekday]: DayWindow};

export const DEFAULT_DAY_WINDOW: DayWindow = {
  enabled: true,
  allDay: true,
  startMin: 0,
  endMin: 1440,
};

export const makeDefaultSchedule = (): WeekSchedule =>
  WEEKDAYS.reduce((acc, d) => {
    acc[d] = {...DEFAULT_DAY_WINDOW};
    return acc;
  }, {} as WeekSchedule);

/** "8:30 AM" label from minutes-from-midnight. */
export const minutesToLabel = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
};

export interface ShiftPreferences {
  /** Per-day grab windows. */
  schedule: WeekSchedule;
  /** Free-text zone names, matched case-insensitively against shift cards. Empty == "any zone". */
  zones: string[];
  /** When false, the app only notifies on a match — it does not auto-tap claim. */
  autoGrab: boolean;
  /** How often (seconds) the refresh swipe may fire. Clamped 1–30. */
  refreshIntervalSec: number;
}

export const DEFAULT_PREFERENCES: ShiftPreferences = {
  schedule: makeDefaultSchedule(),
  zones: [],
  autoGrab: false,
  refreshIntervalSec: 3,
};

/** Step for the time pickers (minutes). */
export const TIME_STEP_MIN = 30;

export const REFRESH_INTERVAL_MIN = 1;
export const REFRESH_INTERVAL_MAX = 30;

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export interface Shift {
  /** Stable-ish id derived from the card contents (best effort). */
  id: string;
  day?: Weekday;
  /** Human label as parsed from the card, e.g. "Sun, Jun 29". */
  dateLabel?: string;
  startTime?: string; // "5:00 PM"
  endTime?: string; // "9:00 PM"
  timeSlot?: TimeSlot;
  zone?: string;
  /** Raw text scraped from the card, kept for debugging selector accuracy. */
  rawText: string;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'action' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  /** Epoch millis. */
  timestamp: number;
  level: LogLevel;
  message: string;
  app?: DeliveryAppId;
}

// ---------------------------------------------------------------------------
// Native bridge contract
// ---------------------------------------------------------------------------

/** Event names emitted by the native ShiftGrabberModule over DeviceEventEmitter. */
export const NativeEvents = {
  STATUS_CHANGE: 'SmartCourier.onStatusChange',
  LOG: 'SmartCourier.onLog',
  SHIFT_FOUND: 'SmartCourier.onShiftFound',
  SHIFT_CLAIMED: 'SmartCourier.onShiftClaimed',
} as const;

export interface StatusChangePayload {
  status: ServiceStatus;
  app: DeliveryAppId;
}

export interface NativeLogPayload {
  level: LogLevel;
  message: string;
  app?: DeliveryAppId;
  timestamp: number;
}

export interface ShiftClaimedPayload {
  shift: Shift;
}
