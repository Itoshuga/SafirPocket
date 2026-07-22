'use client';

import type { FriendshipStatus, ProfilePermissions } from '@safir/shared-types';
import { Badge, Button, ConfirmDialog, DropdownMenu } from '@safir/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Copy, MoreHorizontal, UserMinus, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { profileQueryKeys, queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from './auth-provider';

type ConfirmedAction = 'remove' | 'block' | null;

export function ProfileSocialActions({
  username,
  status,
  permissions,
}: {
  username: string;
  status: FriendshipStatus;
  permissions: ProfilePermissions;
}) {
  const { user, loading } = useAuth();
  const notify = useAppStore((state) => state.notify);
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<ConfirmedAction>(null);
  const encodedUsername = encodeURIComponent(username);
  const mutation = useMutation({
    mutationFn: ({ path, method = 'POST' }: { path: string; method?: 'POST' | 'DELETE' }) =>
      apiFetch<unknown>(path, {
        method,
        ...(method === 'POST' ? { body: JSON.stringify({}) } : {}),
      }),
    onSuccess: async () => {
      setConfirmation(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: profileQueryKeys.public(username) }),
        client.invalidateQueries({ queryKey: profileQueryKeys.stats.me() }),
        client.invalidateQueries({ queryKey: profileQueryKeys.stats.public(username) }),
        client.invalidateQueries({ queryKey: queryKeys.friends }),
        client.invalidateQueries({ queryKey: queryKeys.friendRequestsReceived }),
        client.invalidateQueries({ queryKey: queryKeys.friendRequestsSent }),
        client.invalidateQueries({ queryKey: queryKeys.blockedUsers }),
      ]);
      notify('Relation mise à jour.', 'success');
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "L'action n'a pas pu être effectuée.",
        'error',
      );
    },
  });

  if (loading || !user) return null;
  if (status === 'SELF') {
    return (
      <Button asChild size="sm">
        <Link href="/profile">Voir mon profil</Link>
      </Button>
    );
  }

  const run = (path: string, method?: 'POST' | 'DELETE') => mutation.mutate({ path, method });
  const copyLink = () => {
    const url = `${window.location.origin}/users/${encodedUsername}`;
    void navigator.clipboard.writeText(url).then(() => notify('Lien du profil copié.', 'success'));
  };
  return (
    <>
      {status === 'NONE' && permissions.canSendFriendRequest ? (
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => run(`/api/v1/users/by-username/${encodedUsername}/friend-request`)}
        >
          <UserPlus className="size-4" /> Ajouter en ami
        </Button>
      ) : null}
      {status === 'PENDING_SENT' ? <Badge>Demande envoyée</Badge> : null}
      {status === 'PENDING_RECEIVED' ? (
        <>
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              run(`/api/v1/users/by-username/${encodedUsername}/friend-request/accept`)
            }
          >
            <Check className="size-4" /> Accepter
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() =>
              run(`/api/v1/users/by-username/${encodedUsername}/friend-request/decline`)
            }
          >
            <X className="size-4" /> Refuser
          </Button>
        </>
      ) : null}
      {status === 'FRIENDS' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => setConfirmation('remove')}
        >
          <UserMinus className="size-4" /> Retirer des amis
        </Button>
      ) : null}
      {status === 'BLOCKED' ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => run(`/api/v1/users/by-username/${encodedUsername}/block`, 'DELETE')}
        >
          Débloquer
        </Button>
      ) : null}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions secondaires du profil">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onSelect={copyLink}>
            <Copy className="size-4" /> Copier le lien
          </DropdownMenu.Item>
          {permissions.canBlock ? (
            <DropdownMenu.Item onSelect={() => setConfirmation('block')}>
              <Ban className="size-4" /> Bloquer
            </DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
        title={confirmation === 'block' ? 'Bloquer cet utilisateur ?' : 'Retirer cet ami ?'}
        description={
          confirmation === 'block'
            ? 'Les demandes et l’amitié existantes seront annulées.'
            : 'Vous pourrez envoyer une nouvelle demande plus tard.'
        }
        confirmLabel={confirmation === 'block' ? 'Bloquer' : 'Retirer'}
        danger
        loading={mutation.isPending}
        onConfirm={() => {
          if (confirmation === 'block') {
            run(`/api/v1/users/by-username/${encodedUsername}/block`);
          } else if (confirmation === 'remove') {
            run(`/api/v1/users/by-username/${encodedUsername}/friendship`, 'DELETE');
          }
        }}
      />
    </>
  );
}
