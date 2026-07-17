'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ErrorState, Input } from '@safir/ui';
import { credentialsSchema } from '@safir/validation';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { getBrowserAppUrl, isSupabaseConfigured } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type Credentials = z.infer<typeof credentialsSchema>;
type Mode = 'login' | 'signup' | 'recovery';

export function LoginForm() {
  const search = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });

  function changeMode(next: Mode) {
    setMode(next);
    form.clearErrors();
    setMessage(null);
  }

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    setMessage(null);
    if (!isSupabaseConfigured) {
      form.setError('root', {
        message: 'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      });
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword(values)
        : await supabase.auth.signUp({
            ...values,
            options: { emailRedirectTo: `${getBrowserAppUrl()}/auth/callback` },
          });
    if (result.error) {
      form.setError('root', { message: result.error.message });
      return;
    }
    if (mode === 'signup' && !result.data.session)
      setMessage('Compte créé. Consultez votre e-mail pour confirmer votre inscription.');
    else window.location.assign(search.get('next') ?? '/collection');
  });

  async function recoverPassword() {
    form.clearErrors('root');
    setMessage(null);
    const parsedEmail = credentialsSchema.shape.email.safeParse(form.getValues('email'));
    if (!parsedEmail.success) {
      form.setError('email', { message: 'Adresse e-mail invalide.' });
      return;
    }
    if (!isSupabaseConfigured) {
      form.setError('root', {
        message: 'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      });
      return;
    }
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
      parsedEmail.data,
      { redirectTo: `${getBrowserAppUrl()}/auth/callback?next=/profile` },
    );
    if (error) form.setError('root', { message: error.message });
    else setMessage('Si ce compte existe, un e-mail de réinitialisation vient d’être envoyé.');
  }

  const title =
    mode === 'login'
      ? 'Se connecter'
      : mode === 'signup'
        ? 'Créer un compte'
        : 'Réinitialiser le mot de passe';
  return (
    <div>
      <p className="text-xs font-semibold text-primary">Compte Safir</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === 'login'
          ? 'Retrouvez votre collection et vos decks.'
          : mode === 'signup'
            ? 'Créez votre espace personnel sécurisé.'
            : 'Recevez un lien sécurisé à l’adresse de votre compte.'}
      </p>
      {search.get('reason') === 'config' ? (
        <div className="mt-5">
          <ErrorState message="Configurez Supabase pour accéder aux espaces privés." />
        </div>
      ) : null}
      {mode !== 'recovery' ? (
        <div
          className="mt-7 grid grid-cols-2 rounded-md bg-surface-muted p-1"
          role="tablist"
          aria-label="Mode d’authentification"
        >
          {(['login', 'signup'] as const).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={mode === item}
              key={item}
              onClick={() => changeMode(item)}
              className={`rounded-sm py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${mode === item ? 'bg-surface text-foreground shadow-control' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {item === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>
      ) : null}
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <label className="block text-sm font-medium">
          E-mail
          <Input
            className="mt-1.5"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </label>
        {form.formState.errors.email ? (
          <p className="-mt-2 text-xs text-danger">Saisissez une adresse e-mail valide.</p>
        ) : null}
        {mode !== 'recovery' ? (
          <>
            <label className="block text-sm font-medium">
              Mot de passe
              <Input
                className="mt-1.5"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register('password')}
              />
            </label>
            {form.formState.errors.password ? (
              <p className="-mt-2 text-xs text-danger">
                Le mot de passe doit contenir au moins 8 caractères.
              </p>
            ) : null}
          </>
        ) : null}
        {form.formState.errors.root?.message ? (
          <ErrorState message={form.formState.errors.root.message} />
        ) : null}
        {message ? (
          <p
            role="status"
            className="rounded-md border border-success/20 bg-success/5 p-4 text-sm text-success"
          >
            {message}
          </p>
        ) : null}
        {mode === 'recovery' ? (
          <Button className="w-full" type="button" onClick={() => void recoverPassword()}>
            Envoyer le lien
          </Button>
        ) : (
          <Button
            className="w-full"
            type="submit"
            loading={form.formState.isSubmitting}
            loadingLabel="Veuillez patienter…"
          >
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </Button>
        )}
      </form>
      {mode === 'login' ? (
        <button
          type="button"
          className="mt-4 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => changeMode('recovery')}
        >
          Mot de passe oublié ?
        </button>
      ) : mode === 'recovery' ? (
        <button
          type="button"
          className="mt-4 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => changeMode('login')}
        >
          Retour à la connexion
        </button>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        L’authentification est gérée par Supabase. Safir Pocket ne stocke jamais votre mot de passe
        dans l’application.
      </p>
    </div>
  );
}
