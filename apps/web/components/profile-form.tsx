'use client';

import type { PublicUser } from '@safir/shared-types';
import { Badge, Button, Card, ErrorState, Input, Spinner } from '@safir/ui';
import { profileUpdateSchema } from '@safir/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';

export function ProfileForm() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<PublicUser>('/api/v1/me/profile'),
  });
  const update = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<PublicUser>('/api/v1/me/profile', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (profile) => {
      client.setQueryData(['profile'], profile);
      notify('Profil mis à jour.', 'success');
    },
    onError: (reason) => setError(reason.message),
  });
  if (query.isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Spinner />
      </div>
    );
  if (query.isError || !query.data)
    return <ErrorState message="Impossible de charger le profil." />;
  const profile = query.data;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = profileUpdateSchema.safeParse({
      username: form.get('username'),
      displayName: form.get('displayName') || null,
      bio: form.get('bio') || null,
    });
    if (!parsed.success) return setError('Vérifiez les champs du profil.');
    update.mutate(parsed.data);
  }
  return (
    <Card>
      <form className="space-y-5" onSubmit={submit}>
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-sapphire-500/15 text-2xl text-sapphire-300">
            ◆
          </div>
          <div>
            <p className="font-bold">{profile.displayName ?? profile.username}</p>
            <Badge>{profile.role}</Badge>
          </div>
        </div>
        <label className="block text-sm font-semibold">
          Nom d’utilisateur
          <Input
            className="mt-2"
            name="username"
            defaultValue={profile.username}
            pattern="[A-Za-z0-9_]{3,30}"
          />
        </label>
        <label className="block text-sm font-semibold">
          Nom affiché
          <Input
            className="mt-2"
            name="displayName"
            defaultValue={profile.displayName ?? ''}
            maxLength={80}
          />
        </label>
        <label className="block text-sm font-semibold">
          Bio
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-ink-800/70 p-4 outline-none focus:border-sapphire-400"
            name="bio"
            defaultValue={profile.bio ?? ''}
            maxLength={500}
          />
        </label>
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </Card>
  );
}
