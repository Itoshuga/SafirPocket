'use client';

import type { UsernameAvailability } from '@safir/shared-types';
import { Button, ErrorState, Input } from '@safir/ui';
import { credentialsSchema, signupSchema, usernameSchema } from '@safir/validation';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiFetch } from '@/lib/api-client';
import { getBrowserAppUrl, isSupabaseConfigured } from '@/lib/env';
import { safeInternalPath } from '@/lib/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface AuthFields {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type Mode = 'login' | 'signup' | 'recovery';
type Availability = 'idle' | 'checking' | 'available' | 'unavailable';

export function LoginForm() {
  const search = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>('idle');
  const form = useForm<AuthFields>({
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  function changeMode(next: Mode) {
    setMode(next);
    form.clearErrors();
    setMessage(null);
    setAvailability('idle');
  }

  async function checkUsername(): Promise<boolean> {
    const parsed = usernameSchema.safeParse(form.getValues('username'));
    if (!parsed.success) {
      form.setError('username', { message: parsed.error.issues[0]?.message });
      setAvailability('idle');
      return false;
    }
    setAvailability('checking');
    try {
      const result = await apiFetch<UsernameAvailability>(
        `/api/v1/auth/username-availability?username=${encodeURIComponent(parsed.data)}`,
      );
      setAvailability(result.available ? 'available' : 'unavailable');
      if (!result.available) {
        form.setError('username', { message: "Ce nom d'utilisateur est déjà utilisé." });
      }
      return result.available;
    } catch {
      setAvailability('idle');
      return true;
    }
  }

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    setMessage(null);
    const parsed =
      mode === 'signup'
        ? signupSchema.safeParse(values)
        : credentialsSchema.safeParse({ email: values.email, password: values.password });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'username' ||
          field === 'email' ||
          field === 'password' ||
          field === 'confirmPassword'
        ) {
          form.setError(field, { message: issue.message });
        }
      }
      return;
    }
    if (!isSupabaseConfigured) {
      form.setError('root', {
        message: 'Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      });
      return;
    }
    if (mode === 'signup' && !(await checkUsername())) return;
    const supabase = getSupabaseBrowserClient();
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
        : await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              data: { username: values.username.trim() },
              emailRedirectTo: `${getBrowserAppUrl()}/auth/callback`,
            },
          });
    if (result.error) {
      const message = result.error.message.includes('USERNAME_ALREADY_EXISTS')
        ? "Ce nom d'utilisateur est déjà utilisé."
        : result.error.message.includes('USERNAME_INVALID')
          ? "Le nom d'utilisateur n'est pas valide."
          : result.error.message;
      form.setError('root', { message });
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      setMessage('Compte créé. Consultez votre e-mail pour confirmer votre inscription.');
    } else {
      window.location.assign(safeInternalPath(search.get('next'), '/collection'));
    }
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
        {mode === 'signup' ? (
          <label className="block text-sm font-medium">
            Nom d’utilisateur
            <Input
              className="mt-1.5"
              autoComplete="username"
              maxLength={24}
              aria-invalid={Boolean(form.formState.errors.username)}
              {...form.register('username', {
                onChange: () => setAvailability('idle'),
                onBlur: () => void checkUsername(),
              })}
            />
            {availability === 'checking' ? (
              <span className="mt-1 block text-xs text-muted-foreground">Vérification…</span>
            ) : null}
            {availability === 'available' ? (
              <span className="mt-1 block text-xs text-success">Nom disponible</span>
            ) : null}
          </label>
        ) : null}
        {form.formState.errors.username ? (
          <p className="-mt-2 text-xs text-danger">{form.formState.errors.username.message}</p>
        ) : null}
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
        {mode === 'signup' ? (
          <>
            <label className="block text-sm font-medium">
              Confirmer le mot de passe
              <Input
                className="mt-1.5"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register('confirmPassword')}
              />
            </label>
            {form.formState.errors.confirmPassword ? (
              <p className="-mt-2 text-xs text-danger">
                {form.formState.errors.confirmPassword.message}
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
