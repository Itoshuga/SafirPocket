'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ProfileSummary, PublicUser } from '@safir/shared-types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Panel,
  Skeleton,
  StatCard,
  Switch,
  Textarea,
} from '@safir/ui';
import { profileUpdateSchema, type ProfileUpdateInput } from '@safir/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { publicEnv } from '@/lib/env';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';

function avatarUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return publicEnv.supabaseUrl
    ? `${publicEnv.supabaseUrl}/storage/v1/object/public/avatars/${path.split('/').map(encodeURIComponent).join('/')}`
    : null;
}

function ProfileEditor({ profile }: { profile: PublicUser }) {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
    },
  });
  const update = useMutation({
    mutationFn: (body: ProfileUpdateInput) =>
      apiFetch<PublicUser>('/api/v1/me/profile', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (next) => {
      client.setQueryData(queryKeys.profile, next);
      notify('Profil mis à jour.', 'success');
      form.reset({ username: next.username, displayName: next.displayName, bio: next.bio });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field === 'username' || field === 'displayName' || field === 'bio') {
            form.setError(field, { message: messages[0] });
          }
        }
      }
      form.setError('root', { message: error.message });
    },
  });
  return (
    <Card>
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => update.mutate(values))}
        noValidate
      >
        <div className="flex items-center gap-4">
          <Avatar
            src={avatarUrl(profile.avatarPath)}
            alt={profile.displayName ?? profile.username}
            fallback={profile.displayName ?? profile.username}
            size="lg"
          />
          <div>
            <p className="font-semibold">{profile.displayName ?? profile.username}</p>
            <Badge className="mt-1">{profile.role}</Badge>
            {profile.createdAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Membre depuis le{' '}
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                  new Date(profile.createdAt),
                )}
              </p>
            ) : null}
          </div>
        </div>
        <label className="block text-sm font-medium">
          Nom d’utilisateur
          <Input
            className="mt-1.5"
            aria-invalid={Boolean(form.formState.errors.username)}
            {...form.register('username')}
          />
        </label>
        {form.formState.errors.username ? (
          <p className="-mt-3 text-xs text-danger">{form.formState.errors.username.message}</p>
        ) : null}
        <label className="block text-sm font-medium">
          Nom affiché
          <Input
            className="mt-1.5"
            maxLength={80}
            {...form.register('displayName', { setValueAs: (value) => value || null })}
          />
        </label>
        <label className="block text-sm font-medium">
          Bio
          <Textarea
            className="mt-1.5"
            maxLength={500}
            {...form.register('bio', { setValueAs: (value) => value || null })}
          />
        </label>
        {form.formState.errors.root?.message ? (
          <ErrorState message={form.formState.errors.root.message} />
        ) : null}
        <Button
          type="submit"
          loading={update.isPending}
          loadingLabel="Enregistrement…"
          disabled={!form.formState.isDirty}
        >
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}

function Preferences() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem('safir:reduce-motion') === 'true';
    document.documentElement.dataset.reduceMotion = String(stored);
    const timer = window.setTimeout(() => setReducedMotion(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <Panel id="preferences">
      <h2 className="text-base font-semibold">Préférences d’affichage</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ce réglage non sensible est conservé uniquement dans ce navigateur.
      </p>
      <div className="mt-5 border-t border-border pt-4">
        <Switch
          id="reduce-motion"
          label="Réduire les animations"
          checked={reducedMotion}
          onCheckedChange={(checked) => {
            setReducedMotion(checked);
            window.localStorage.setItem('safir:reduce-motion', String(checked));
            document.documentElement.dataset.reduceMotion = String(checked);
          }}
        />
      </div>
    </Panel>
  );
}

export function ProfileForm() {
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<PublicUser>('/api/v1/me/profile'),
  });
  const summary = useQuery({
    queryKey: queryKeys.profileSummary,
    queryFn: () => apiFetch<ProfileSummary>('/api/v1/me/profile/summary'),
  });
  if (profile.isLoading)
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-72" />
      </div>
    );
  if (profile.isError || !profile.data)
    return <ErrorState message="Impossible de charger le profil." />;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <ProfileEditor profile={profile.data} />
        <Preferences />
      </div>
      <div className="grid h-fit gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {summary.isLoading
          ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)
          : null}
        {summary.data ? (
          <>
            <StatCard
              label="Collection"
              value={summary.data.collection.uniqueCards}
              hint={`${summary.data.collection.completionRate} % complète`}
            />
            <StatCard label="Decks" value={summary.data.deckCount} />
            <StatCard
              label="Victoires"
              value={summary.data.wins}
              hint={`${summary.data.matchCount} parties`}
            />
            <StatCard
              label="Classement"
              value={summary.data.currentRank ? `#${summary.data.currentRank}` : 'Non classé'}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
