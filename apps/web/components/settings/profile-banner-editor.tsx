'use client';

import type { UserProfile } from '@safir/shared-types';
import { Avatar, Button } from '@safir/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { profileQueryKeys, queryKeys } from '@/lib/query-keys';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from '../auth-provider';
import { ProfileBanner } from '../profile-banner';

const allowedBannerTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumBannerSize = 8 * 1024 * 1024;

export function ProfileBannerEditor({ profile }: { profile: UserProfile }) {
  const { user, refreshProfile } = useAuth();
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [file, setFile] = useState<File | null>(null);
  const [positionY, setPositionY] = useState(profile.bannerPositionY);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : profile.bannerUrl),
    [file, profile.bannerUrl],
  );

  useEffect(
    () => () => {
      if (file && previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    },
    [file, previewUrl],
  );

  const save = useMutation({
    mutationFn: async () => {
      let uploadedPath: string | undefined;
      try {
        if (file) {
          if (!user) throw new Error('Session expirée.');
          const extension =
            file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await getSupabaseBrowserClient()
            .storage.from('profile-banners')
            .upload(uploadedPath, file, { contentType: file.type, upsert: false });
          if (uploadError) throw new Error("La bannière n'a pas pu être envoyée.");
        }
        return await apiFetch<UserProfile>('/api/v1/me/profile/banner', {
          method: 'PATCH',
          body: JSON.stringify({
            ...(uploadedPath ? { bannerUrl: uploadedPath } : {}),
            bannerPositionY: positionY,
          }),
        });
      } catch (cause) {
        if (uploadedPath) {
          await getSupabaseBrowserClient().storage.from('profile-banners').remove([uploadedPath]);
        }
        throw cause;
      }
    },
    onSuccess: async (next) => {
      client.setQueryData(queryKeys.profile, next);
      await client.invalidateQueries({ queryKey: profileQueryKeys.public(next.username) });
      setFile(null);
      setPositionY(next.bannerPositionY);
      setError(null);
      notify('Bannière mise à jour.', 'success');
      await refreshProfile();
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'),
  });
  const remove = useMutation({
    mutationFn: () =>
      apiFetch<UserProfile>('/api/v1/me/profile/banner', {
        method: 'DELETE',
      }),
    onSuccess: async (next) => {
      client.setQueryData(queryKeys.profile, next);
      await client.invalidateQueries({ queryKey: profileQueryKeys.public(next.username) });
      setFile(null);
      setPositionY(50);
      setError(null);
      notify('Bannière supprimée.', 'success');
      await refreshProfile();
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.'),
  });
  const identity = profile.displayName ?? profile.username;
  const dirty = Boolean(file) || positionY !== profile.bannerPositionY;

  return (
    <section
      className="mb-6 border-b border-border pb-6"
      aria-labelledby="banner-editor-title"
      data-testid="profile-banner-editor"
    >
      <div className="mb-4">
        <h2 id="banner-editor-title" className="text-base font-semibold text-foreground">
          Bannière du profil
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG ou WebP, 8 Mo maximum.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <ProfileBanner
          bannerUrl={previewUrl}
          positionY={positionY}
          alt={`Aperçu de la bannière de ${identity}`}
        />
        <div className="relative min-h-20 px-4 pb-4 pt-10">
          <Avatar
            src={resolveAvatarUrl(profile.avatarUrl)}
            alt={`Avatar de ${identity}`}
            fallback={identity}
            size="lg"
            className="absolute -top-8 left-4 z-10 size-20 border-4 border-surface bg-surface shadow-card"
          />
          <p className="font-semibold text-foreground">{identity}</p>
          <p className="text-xs text-muted-foreground">@{profile.username}</p>
        </div>
      </div>
      <label className="mt-4 block text-sm font-medium text-foreground">
        Cadrage vertical : {positionY} %
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={positionY}
          className="mt-2 h-10 w-full accent-primary"
          onChange={(event) => setPositionY(Number(event.target.value))}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <label>
            <ImageUp className="size-4" /> Choisir une image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                if (!next) return;
                if (!allowedBannerTypes.has(next.type) || next.size > maximumBannerSize) {
                  setError('Utilisez une image JPEG, PNG ou WebP de 8 Mo maximum.');
                  return;
                }
                setError(null);
                setFile(next);
              }}
            />
          </label>
        </Button>
        <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          <Save className="size-4" /> Enregistrer la bannière
        </Button>
        {profile.bannerUrl || file ? (
          <Button
            variant="ghost"
            size="sm"
            loading={remove.isPending}
            onClick={() => (file ? setFile(null) : remove.mutate())}
          >
            <Trash2 className="size-4" /> Retirer
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
