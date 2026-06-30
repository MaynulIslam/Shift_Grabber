/**
 * Entitlement state — decides whether the signed-in user may use the app
 * (free trial active, or a paid subscription). The authoritative check is the
 * Supabase `has_access()` RPC, which uses the SERVER clock so the trial can't
 * be faked by changing the phone's time. We also read the profile row for
 * display (trial days left, status).
 */
import {create} from 'zustand';
import {supabase} from '@/services/supabase';

const TRIAL_DAYS = 14;

interface EntitlementState {
  loading: boolean;
  hasAccess: boolean;
  status: string | null; // trial | active | expired | canceled
  daysLeft: number | null;

  refresh: () => Promise<void>;
  reset: () => void;
}

export const useEntitlementStore = create<EntitlementState>(set => ({
  loading: true,
  hasAccess: false,
  status: null,
  daysLeft: null,

  refresh: async () => {
    set({loading: true});
    try {
      // Authoritative gate decision (server-computed).
      const {data: access, error: accessErr} = await supabase.rpc('has_access');
      // Profile for display.
      const {data: profile} = await supabase
        .from('profiles')
        .select('status, trial_started_at')
        .single();

      let daysLeft: number | null = null;
      if (profile?.trial_started_at) {
        const end =
          new Date(profile.trial_started_at).getTime() +
          TRIAL_DAYS * 86400_000;
        daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400_000));
      }

      set({
        loading: false,
        // If the RPC errored (e.g. table not created yet), fail closed = no access.
        hasAccess: accessErr ? false : Boolean(access),
        status: profile?.status ?? null,
        daysLeft,
      });
    } catch {
      set({loading: false, hasAccess: false});
    }
  },

  reset: () =>
    set({loading: true, hasAccess: false, status: null, daysLeft: null}),
}));
