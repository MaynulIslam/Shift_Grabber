/**
 * Supabase client.
 *
 * Auth sessions are persisted in the app's MMKV store so logins survive
 * restarts. The publishable key is safe to ship in the app (it's the public
 * key; data is protected by row-level security, not by hiding this).
 */
import 'react-native-url-polyfill/auto';
import {AppState} from 'react-native';
import {createClient} from '@supabase/supabase-js';
import {storage} from './storage';

const SUPABASE_URL = 'https://fbybtwbddgqoljeeaonz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_P8weDzyUBxEtj4mKouz5kQ_WWqDuN9w';

/** MMKV-backed storage adapter for the Supabase auth session. */
const MmkvAuthStorage = {
  getItem: (key: string): string | null => storage.getString(key) ?? null,
  setItem: (key: string, value: string): void => storage.set(key, value),
  removeItem: (key: string): void => storage.delete(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: MmkvAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Email/password (implicit) — avoids the crypto needs of the PKCE/OAuth flow.
    flowType: 'implicit',
  },
});

// Supabase recommends pausing token auto-refresh while the app is backgrounded.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
