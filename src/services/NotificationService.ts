/**
 * Thin wrapper over Notifee for local notifications (e.g. "Shift grabbed!").
 * The persistent "monitoring" notification is owned by the native
 * ForegroundService, not this — this is only for one-off event alerts.
 */
import notifee, {AndroidImportance} from '@notifee/react-native';
import {Shift} from '@/types';

const CHANNEL_ID = 'smartcourier-events';

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady) {
    return;
  }
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Shift events',
    importance: AndroidImportance.HIGH,
  });
  channelReady = true;
}

export const NotificationService = {
  async requestPermission(): Promise<void> {
    // Required on Android 13+ (POST_NOTIFICATIONS).
    await notifee.requestPermission();
  },

  async notifyShiftClaimed(shift: Shift): Promise<void> {
    await ensureChannel();
    const parts = [shift.dateLabel, shift.startTime && shift.endTime
      ? `${shift.startTime}–${shift.endTime}`
      : undefined, shift.zone]
      .filter(Boolean)
      .join(' · ');
    await notifee.displayNotification({
      title: '✅ Shift grabbed!',
      body: parts || shift.rawText,
      android: {channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: {id: 'default'}},
    });
  },

  async notify(title: string, body: string): Promise<void> {
    await ensureChannel();
    await notifee.displayNotification({
      title,
      body,
      android: {channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: {id: 'default'}},
    });
  },
};
