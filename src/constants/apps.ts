import {DeliveryApp} from '@/types';

/**
 * Supported delivery apps shown on the Home screen.
 *
 * NOTE: packageName values are best-effort guesses and MUST be verified against
 * the real installs (`adb shell pm list packages | grep -i skip`). The
 * AccessibilityService keys off these, so a wrong value means it never fires.
 */
export const DELIVERY_APPS: DeliveryApp[] = [
  {
    id: 'skip',
    name: 'Skip The Dishes',
    packageName: 'com.skipthedishes.courier', // TODO: verify actual courier-app package
    enabled: true,
    color: '#F26722',
  },
  {
    id: 'ubereats',
    name: 'Uber Eats (Driver)',
    packageName: 'com.ubercab.driver', // TODO: verify
    enabled: false,
    color: '#06C167',
  },
  {
    id: 'doordash',
    name: 'DoorDash (Dasher)',
    packageName: 'com.doordash.driverapp', // TODO: verify
    enabled: false,
    color: '#EB1700',
  },
];

export const getAppById = (id: string): DeliveryApp | undefined =>
  DELIVERY_APPS.find(a => a.id === id);
