import type { AppRole, ProfileVisibility } from '@safir/shared-types';
import { Avatar, Badge } from '@safir/ui';
import type { ReactNode } from 'react';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { UserRoleBadge } from './user-role-badge';

interface ProfileHeaderIdentity {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: AppRole;
  createdAt?: string;
  updatedAt?: string;
}

export function ProfileHeader({
  profile,
  visibility,
  actions,
  limited = false,
}: {
  profile: ProfileHeaderIdentity;
  visibility: ProfileVisibility;
  actions?: ReactNode;
  limited?: boolean;
}) {
  const identity = profile.displayName ?? profile.username;
  const memberSince = profile.createdAt ?? profile.updatedAt;
  return (
    <header className="border-b border-border pb-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar
          src={resolveAvatarUrl(profile.avatarUrl)}
          alt={`Avatar de ${identity}`}
          fallback={identity}
          size="lg"
          className="size-24 shrink-0 text-2xl sm:size-28"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
              {identity}
            </h1>
            <UserRoleBadge role={profile.role} />
            <Badge tone={visibility === 'PUBLIC' ? 'success' : 'neutral'}>
              {visibility === 'PUBLIC' ? 'Profil public' : 'Profil privé'}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">@{profile.username}</p>
          {!limited ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-foreground">
              {profile.bio || 'Aucune biographie renseignée.'}
            </p>
          ) : null}
          {memberSince ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Membre depuis le{' '}
              {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
                new Date(memberSince),
              )}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
