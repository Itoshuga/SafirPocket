'use client';

import { Button, ErrorState, Input } from '@safir/ui';
import { credentialsSchema } from '@safir/validation';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export function LoginForm() {
  const search = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(
    search.get('reason') === 'config'
      ? 'Configurez Supabase pour accéder aux espaces privés.'
      : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!isSupabaseConfigured) {
      setError('Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      setError('Saisissez un e-mail valide et un mot de passe de 8 caractères minimum.');
      return;
    }
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword(parsed.data)
        : await supabase.auth.signUp({
            ...parsed.data,
            options: { emailRedirectTo: `${publicEnv.appUrl}/auth/callback` },
          });
    setPending(false);
    if (result.error) return setError(result.error.message);
    if (mode === 'signup' && !result.data.session) {
      setMessage('Compte créé. Consultez votre e-mail pour confirmer votre inscription.');
    } else {
      window.location.assign(search.get('next') ?? '/collection');
    }
  }

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-sapphire-300">Compte Safir</p>
      <h1 className="mt-2 text-3xl font-black">
        {mode === 'login' ? 'Heureux de vous revoir' : 'Créer votre collection'}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        {mode === 'login'
          ? 'Connectez-vous pour retrouver votre progression.'
          : 'Un compte suffit pour commencer.'}
      </p>
      <div className="mt-7 grid grid-cols-2 rounded-xl bg-ink-950 p-1">
        {(['login', 'signup'] as const).map((item) => (
          <button
            key={item}
            onClick={() => {
              setMode(item);
              setError(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === item ? 'bg-sapphire-500 text-white' : 'text-slate-400'}`}
          >
            {item === 'login' ? 'Connexion' : 'Inscription'}
          </button>
        ))}
      </div>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          E-mail
          <Input
            className="mt-2"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="vous@exemple.fr"
          />
        </label>
        <label className="block text-sm font-medium">
          Mot de passe
          <Input
            className="mt-2"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
        </label>
        {error ? <ErrorState message={error} /> : null}
        {message ? (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-4 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={pending}>
          {pending ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-600">
        <span className="h-px flex-1 bg-white/8" />
        ou
        <span className="h-px flex-1 bg-white/8" />
      </div>
      <Button className="w-full bg-white/5 text-slate-400 shadow-none hover:bg-white/8" disabled>
        Google OAuth · bientôt
      </Button>
    </div>
  );
}
