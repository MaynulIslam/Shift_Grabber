/**
 * Auth state, backed by Supabase. Holds the current session and exposes
 * sign-up / sign-in / sign-out. `init()` loads any persisted session and keeps
 * the store in sync with auth changes (token refresh, sign-out, etc.).
 */
import {create} from 'zustand';
import {Session} from '@supabase/supabase-js';
import {supabase} from '@/services/supabase';

interface AuthResult {
  error?: string;
  /** True when sign-up needs email confirmation before a session exists. */
  needsConfirmation?: boolean;
}

interface AuthState {
  session: Session | null;
  initializing: boolean;

  init: () => void;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  initializing: true,

  init: () => {
    supabase.auth
      .getSession()
      .then(({data}) => set({session: data.session, initializing: false}))
      .catch(() => set({initializing: false}));

    supabase.auth.onAuthStateChange((_event, session) => {
      set({session});
    });
  },

  signUp: async (email, password) => {
    const {data, error} = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      return {error: error.message};
    }
    // If email confirmation is required, there's a user but no session yet.
    const needsConfirmation = !data.session && !!data.user;
    return {needsConfirmation};
  },

  signIn: async (email, password) => {
    const {error} = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return {error: error?.message};
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
