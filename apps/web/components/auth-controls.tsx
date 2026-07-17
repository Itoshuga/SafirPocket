'use client';

import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAppStore } from '@/stores/app-store';

export function AuthControls() {
  const [user, setUser] = useState<User | null>(null);
  const notify = useAppStore((state) => state.notify);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition hover:border-sapphire-300/40 hover:bg-white/5"
      >
        Connexion
      </Link>
    );
  }
  return (
    <button
      className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition hover:border-sapphire-300/40 hover:bg-white/5"
      onClick={async () => {
        await getSupabaseBrowserClient().auth.signOut();
        notify('Vous êtes déconnecté.', 'success');
        window.location.assign('/');
      }}
    >
      Déconnexion
    </button>
  );
}
