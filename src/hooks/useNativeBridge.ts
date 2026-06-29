/**
 * useNativeBridge — mounts once (at the App root) and fans native events out to
 * the rest of the app:
 *   - status changes  -> useShiftStore
 *   - log lines       -> LogService (+ persisted to MMKV)
 *   - claimed shifts  -> useShiftStore + Notifee notification
 *
 * Keeping this in one place means screens never touch BridgeService listeners
 * directly; they just read from the stores.
 */
import {useEffect} from 'react';
import {BridgeService} from '@/services/BridgeService';
import {LogService} from '@/services/LogService';
import {NotificationService} from '@/services/NotificationService';
import {useShiftStore} from '@/store/useShiftStore';
import {useAppStore} from '@/store/useAppStore';

export function useNativeBridge(): void {
  const setStatus = useShiftStore(s => s.setStatus);
  const addClaimedShift = useShiftStore(s => s.addClaimedShift);
  const notifyOnClaim = useAppStore(s => s.settings.notifyOnClaim);

  useEffect(() => {
    const subs = [
      BridgeService.onStatusChange(p => setStatus(p.status)),

      BridgeService.onLog(p =>
        LogService.ingest({
          id: `${p.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: p.timestamp,
          level: p.level,
          message: p.message,
          app: p.app,
        }),
      ),

      BridgeService.onShiftClaimed(p => {
        addClaimedShift(p.shift);
        LogService.add('success', `Claimed shift: ${p.shift.rawText}`, 'skip');
        if (notifyOnClaim) {
          NotificationService.notifyShiftClaimed(p.shift).catch(() => {});
        }
      }),
    ];

    return () => {
      subs.forEach(s => s?.remove());
    };
  }, [setStatus, addClaimedShift, notifyOnClaim]);

  // Keep the accessibility-enabled flag fresh on mount.
  const setAccessibilityEnabled = useAppStore(s => s.setAccessibilityEnabled);
  useEffect(() => {
    BridgeService.isAccessibilityEnabled()
      .then(setAccessibilityEnabled)
      .catch(() => {});
  }, [setAccessibilityEnabled]);
}
