import type { AppRole, ProfileVisibility } from '@safir/shared-types';
import { Avatar, Badge } from '@safir/ui';
import { CalendarDays, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { ProfileBanner } from './profile-banner';
import { UserRoleBadge } from './user-role-badge';

interface SocialProfileIdentity {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerPositionY: number;
  bio: string | null;
  role: AppRole;
  createdAt?: string;
  updatedAt?: string;
}

export function SocialProfileHeader({
  profile,
  visibility,
  friendsCount,
  actions,
  limited = false,
}: {
  profile: SocialProfileIdentity;
  visibility: ProfileVisibility;
  friendsCount?: number;
  actions?: ReactNode;
  limited?: boolean;
}) {
  const identity = profile.displayName ?? profile.username;
  const memberSince = profile.createdAt ?? profile.updatedAt;
  return (
    <header className="overflow-hidden border-b border-border bg-surface">
      <ProfileBanner
        bannerUrl={profile.bannerUrl}
        positionY={profile.bannerPositionY}
        alt={`Bannière du profil de ${identity}`}
      />
      <div className="px-4 pb-6 sm:px-6">
        <div className="flex min-h-16 items-start justify-between gap-3">
          <Avatar
            src={resolveAvatarUrl(profile.avatarUrl)}
            alt={`Avatar de ${identity}`}
            fallback={identity}
            size="lg"
            className="relative z-10 -mt-10 size-24 shrink-0 border-4 border-surface bg-surface text-2xl shadow-card sm:-mt-12 sm:size-28"
          />
          {actions ? <div className="flex flex-wrap justify-end gap-2 pt-3">{actions}</div> : null}
        </div>
        <div className="mt-2 max-w-3xl">
          <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
            {identity}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">@{profile.username}</p>
            <UserRoleBadge role={profile.role} />
          </div>
          {!limited ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {profile.bio || 'Aucune biographie renseignée.'}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {memberSince ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Membre depuis{' '}
                {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
                  new Date(memberSince),
                )}
              </span>
            ) : null}
            {friendsCount !== undefined ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                <strong className="font-semibold text-foreground">{friendsCount}</strong> ami
                {friendsCount > 1 ? 's' : ''}
              </span>
            ) : null}
            <Badge tone={visibility === 'PUBLIC' ? 'success' : 'neutral'}>
              {visibility === 'PUBLIC' ? 'Profil public' : 'Profil privé'}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
