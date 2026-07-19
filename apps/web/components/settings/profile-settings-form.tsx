'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { UserProfile } from '@safir/shared-types';
import {
  Avatar,
  Button,
  ErrorState,
  Input,
  Panel,
  SectionHeader,
  Skeleton,
  Textarea,
} from '@safir/ui';
import { profileUpdateSchema, type ProfileUpdateInput } from '@safir/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { queryKeys } from '@/lib/query-keys';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '../auth-provider';

const allowedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumAvatarSize = 5 * 1024 * 1024;

export function ProfileSettingsForm() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const { user, refreshProfile } = useAuth();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<UserProfile>('/api/v1/me/profile'),
  });
  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { username: '', displayName: null, bio: null },
  });
  const bioLength = useWatch({ control: form.control, name: 'bio' })?.length ?? 0;
  useEffect(() => {
    if (profile.data) {
      form.reset({
        username: profile.data.username,
        displayName: profile.data.displayName,
        bio: profile.data.bio,
      });
    }
  }, [form, profile.data]);
  const previewUrl = useMemo(
    () =>
      avatarFile ? URL.createObjectURL(avatarFile) : resolveAvatarUrl(profile.data?.avatarUrl),
    [avatarFile, profile.data?.avatarUrl],
  );
  useEffect(
    () => () => {
      if (avatarFile && previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [avatarFile, previewUrl],
  );

  const update = useMutation({
    mutationFn: async (values: ProfileUpdateInput) => {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        if (!user) throw new Error('Session expirée.');
        const extension =
          avatarFile.type === 'image/png'
            ? 'png'
            : avatarFile.type === 'image/webp'
              ? 'webp'
              : 'jpg';
        avatarUrl = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await getSupabaseBrowserClient()
          .storage.from('avatars')
          .upload(avatarUrl, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (error) throw new Error("L'avatar n'a pas pu être envoyé.");
      }
      return apiFetch<UserProfile>('/api/v1/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ...values, ...(avatarUrl ? { avatarUrl } : {}) }),
      });
    },
    onSuccess: async (next) => {
      client.setQueryData(queryKeys.profile, next);
      form.reset({ username: next.username, displayName: next.displayName, bio: next.bio });
      setAvatarFile(null);
      notify('Profil mis à jour.', 'success');
      await refreshProfile();
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
  const removeAvatar = useMutation({
    mutationFn: () =>
      apiFetch<UserProfile>('/api/v1/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: null }),
      }),
    onSuccess: async (next) => {
      client.setQueryData(queryKeys.profile, next);
      setAvatarFile(null);
      notify('Avatar supprimé.', 'success');
      await refreshProfile();
    },
    onError: (error) => notify(error.message, 'error'),
  });

  if (profile.isLoading) return <Skeleton className="h-[38rem]" />;
  if (profile.isError || !profile.data) return <ErrorState message="Profil indisponible." />;
  const usernameLocked = Boolean(
    profile.data.usernameChangeAvailableAt &&
    new Date(profile.data.usernameChangeAvailableAt) > new Date(),
  );
  return (
    <Panel>
      <SectionHeader
        title="Profil"
        description="Ces informations composent votre identité dans Safir Pocket."
      />
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => update.mutate(values))}
        noValidate
      >
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
          <Avatar
            src={previewUrl}
            alt={profile.data.displayName ?? profile.data.username}
            fallback={profile.data.displayName ?? profile.data.username}
            size="lg"
            className="size-20"
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <label>
                <ImageUp className="size-4" /> Choisir une image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    if (!allowedAvatarTypes.has(file.type) || file.size > maximumAvatarSize) {
                      setAvatarError('Utilisez une image JPEG, PNG ou WebP de 5 Mo maximum.');
                      return;
                    }
                    setAvatarError(null);
                    setAvatarFile(file);
                  }}
                />
              </label>
            </Button>
            {profile.data.avatarUrl || avatarFile ? (
              <Button
                variant="ghost"
                size="sm"
                loading={removeAvatar.isPending}
                onClick={() => (avatarFile ? setAvatarFile(null) : removeAvatar.mutate())}
              >
                <Trash2 className="size-4" /> Supprimer
              </Button>
            ) : null}
          </div>
        </div>
        {avatarError ? <p className="text-sm text-danger">{avatarError}</p> : null}
        <label className="block text-sm font-medium">
          Nom d&apos;utilisateur
          <Input
            className="mt-1.5"
            disabled={usernameLocked}
            aria-invalid={Boolean(form.formState.errors.username)}
            autoComplete="username"
            {...form.register('username')}
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Modifier ce nom change l&apos;URL publique. Un changement est autorisé tous les 30
            jours.
          </span>
        </label>
        {usernameLocked ? (
          <p className="text-xs text-warning">
            Prochain changement possible le{' '}
            {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
              new Date(profile.data.usernameChangeAvailableAt!),
            )}
            .
          </p>
        ) : null}
        {form.formState.errors.username ? (
          <p className="text-xs text-danger">{form.formState.errors.username.message}</p>
        ) : null}
        <label className="block text-sm font-medium">
          Nom affiché
          <Input
            className="mt-1.5"
            maxLength={50}
            {...form.register('displayName', { setValueAs: (value) => value || null })}
          />
        </label>
        <label className="block text-sm font-medium">
          Biographie
          <Textarea
            className="mt-1.5"
            maxLength={300}
            aria-invalid={Boolean(form.formState.errors.bio)}
            {...form.register('bio', { setValueAs: (value) => value || null })}
          />
          <span className="mt-1 block text-right text-xs font-normal text-muted-foreground">
            {bioLength}/300
          </span>
        </label>
        {form.formState.errors.bio ? (
          <p className="text-xs text-danger">{form.formState.errors.bio.message}</p>
        ) : null}
        {form.formState.errors.root?.message ? (
          <ErrorState message={form.formState.errors.root.message} />
        ) : null}
        <Button
          type="submit"
          loading={update.isPending}
          loadingLabel="Enregistrement…"
          disabled={!form.formState.isDirty && !avatarFile}
        >
          Enregistrer
        </Button>
      </form>
    </Panel>
  );
}
