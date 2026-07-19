import type { BlockedUser, FriendRequest, Friendship, UserSearchResult } from '@safir/shared-types';
import { Avatar, Badge, Button } from '@safir/ui';
import { Ban, Check, UserMinus, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { resolveAvatarUrl } from '@/lib/avatar-url';

function UserIdentity({
  user,
}: {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isPioneer: boolean;
  };
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar
        src={resolveAvatarUrl(user.avatarUrl)}
        alt={user.displayName ?? user.username}
        fallback={user.displayName ?? user.username}
      />
      <div className="min-w-0">
        <Link
          href={`/users/${encodeURIComponent(user.username)}`}
          className="block truncate text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {user.displayName ?? user.username}
        </Link>
        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
          {user.isPioneer ? <Badge tone="primary">Pionnier</Badge> : null}
        </div>
      </div>
    </div>
  );
}

export function FriendListItem({
  friendship,
  pending,
  onRemove,
  onBlock,
}: {
  friendship: Friendship;
  pending: boolean;
  onRemove: () => void;
  onBlock: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <UserIdentity user={friendship.user} />
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
          <UserMinus className="size-4" /> Retirer
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={onBlock}>
          <Ban className="size-4" /> Bloquer
        </Button>
      </div>
    </div>
  );
}

export function FriendRequestCard({
  request,
  direction,
  pending,
  onAccept,
  onDecline,
  onCancel,
}: {
  request: FriendRequest;
  direction: 'received' | 'sent';
  pending: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}) {
  const user = direction === 'received' ? request.sender : request.receiver;
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <UserIdentity user={user} />
      <div className="flex gap-2">
        {direction === 'received' ? (
          <>
            <Button size="sm" disabled={pending} onClick={onAccept}>
              <Check className="size-4" /> Accepter
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={onDecline}>
              <X className="size-4" /> Refuser
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
            <X className="size-4" /> Annuler
          </Button>
        )}
      </div>
    </div>
  );
}

export function UserSearchResultItem({
  result,
  pending,
  onRequest,
  onBlock,
}: {
  result: UserSearchResult;
  pending: boolean;
  onRequest: () => void;
  onBlock: () => void;
}) {
  const statusLabel = {
    NONE: null,
    PENDING_SENT: 'Demande envoyée',
    PENDING_RECEIVED: 'Demande reçue',
    FRIENDS: 'Ami',
    BLOCKED: 'Bloqué',
  }[result.friendshipStatus];
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <UserIdentity user={result} />
      <div className="flex items-center gap-2">
        {statusLabel ? <Badge>{statusLabel}</Badge> : null}
        {result.friendshipStatus === 'NONE' ? (
          <Button size="sm" disabled={pending} onClick={onRequest}>
            <UserPlus className="size-4" /> Ajouter
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" disabled={pending} onClick={onBlock}>
          <Ban className="size-4" /> Bloquer
        </Button>
      </div>
    </div>
  );
}

export function BlockedUserItem({
  block,
  pending,
  onUnblock,
}: {
  block: BlockedUser;
  pending: boolean;
  onUnblock: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <UserIdentity user={block.user} />
      <Button variant="secondary" size="sm" disabled={pending} onClick={onUnblock}>
        Débloquer
      </Button>
    </div>
  );
}
