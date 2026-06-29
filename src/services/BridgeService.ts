/**
 * BridgeService — the single seam between the JS layer and the Kotlin
 * ShiftGrabberModule.
 *
 * It is deliberately defensive: if the native module isn't linked yet (e.g.
 * you're iterating on the JS in Metro before the Kotlin side is wired up), the
 * methods no-op with a warning instead of crashing the app. That lets the whole
 * RN scaffold run on day one, before any native build exists.
 */
import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
} from 'react-native';
import {
  ShiftPreferences,
  ServiceStatus,
  NativeEvents,
  StatusChangePayload,
  NativeLogPayload,
  ShiftClaimedPayload,
} from '@/types';

interface ShiftGrabberNativeModule {
  startMonitoring(prefsJson: string): Promise<boolean>;
  stopMonitoring(): Promise<boolean>;
  getStatus(): Promise<ServiceStatus>;
  /** Whether SmartCourier's AccessibilityService is currently enabled in system settings. */
  isAccessibilityEnabled(): Promise<boolean>;
  /** Opens the system Accessibility settings page so the user can toggle it on. */
  openAccessibilitySettings(): void;
  /** Whether "Display over other apps" is granted (enables auto-opening Skip). */
  canDrawOverlays(): Promise<boolean>;
  /** Opens the "Display over other apps" settings page for this app. */
  openOverlaySettings(): void;
}

const LINKED: ShiftGrabberNativeModule | undefined =
  NativeModules.ShiftGrabberModule;

function warnUnlinked(method: string): void {
  if (__DEV__) {
    console.warn(
      `[BridgeService] ShiftGrabberModule.${method} called but native module ` +
        `is not linked (Platform: ${Platform.OS}). Build the Android app to enable it.`,
    );
  }
}

class BridgeServiceImpl {
  private emitter = LINKED ? new NativeEventEmitter(NativeModules.ShiftGrabberModule) : null;

  get isAvailable(): boolean {
    return Boolean(LINKED);
  }

  async startMonitoring(prefs: ShiftPreferences): Promise<boolean> {
    if (!LINKED) {
      warnUnlinked('startMonitoring');
      return false;
    }
    return LINKED.startMonitoring(JSON.stringify(prefs));
  }

  async stopMonitoring(): Promise<boolean> {
    if (!LINKED) {
      warnUnlinked('stopMonitoring');
      return false;
    }
    return LINKED.stopMonitoring();
  }

  async getStatus(): Promise<ServiceStatus> {
    if (!LINKED) {
      return 'OFF';
    }
    return LINKED.getStatus();
  }

  async isAccessibilityEnabled(): Promise<boolean> {
    if (!LINKED) {
      return false;
    }
    return LINKED.isAccessibilityEnabled();
  }

  openAccessibilitySettings(): void {
    if (!LINKED) {
      warnUnlinked('openAccessibilitySettings');
      return;
    }
    LINKED.openAccessibilitySettings();
  }

  async canDrawOverlays(): Promise<boolean> {
    if (!LINKED) {
      return false;
    }
    return LINKED.canDrawOverlays();
  }

  openOverlaySettings(): void {
    if (!LINKED) {
      warnUnlinked('openOverlaySettings');
      return;
    }
    LINKED.openOverlaySettings();
  }

  // -- Event subscriptions -------------------------------------------------

  onStatusChange(cb: (p: StatusChangePayload) => void): EmitterSubscription | null {
    return this.emitter?.addListener(NativeEvents.STATUS_CHANGE, cb) ?? null;
  }

  onLog(cb: (p: NativeLogPayload) => void): EmitterSubscription | null {
    return this.emitter?.addListener(NativeEvents.LOG, cb) ?? null;
  }

  onShiftClaimed(cb: (p: ShiftClaimedPayload) => void): EmitterSubscription | null {
    return this.emitter?.addListener(NativeEvents.SHIFT_CLAIMED, cb) ?? null;
  }
}

export const BridgeService = new BridgeServiceImpl();
