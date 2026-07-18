'use client';

import type { AppRole, UserProfile } from '@safir/shared-types';
import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api-client';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  role: AppRole;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = useCallback(async (nextUser: User | null): Promise<void> => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProfile(await apiFetch<UserProfile>('/api/v1/me/profile'));
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth
      .getUser()
      .then(({ data }) => loadProfile(data.user))
      .catch(() => loadProfile(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      configured: isSupabaseConfigured,
      role: profile?.role ?? 'USER',
      refreshProfile: async () => loadProfile(user),
      signOut: async () => {
        if (isSupabaseConfigured) await getSupabaseBrowserClient().auth.signOut();
        setUser(null);
        setProfile(null);
      },
    }),
    [loadProfile, loading, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé sous AuthProvider.');
  return value;
}
