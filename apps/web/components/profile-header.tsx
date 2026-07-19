import type { ProfileVisibility, UserProfile } from '@safir/shared-types';
import { Avatar, Badge, Button, Panel } from '@safir/ui';
import { Copy, Settings, UserPen } from 'lucide-react';
import Link from 'next/link';
import { resolveAvatarUrl } from '@/lib/avatar-url';

export function ProfileHeader({
  profile,
  visibility,
  onCopy,
}: {
  profile: UserProfile;
  visibility: ProfileVisibility;
  onCopy: () => void;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar
          src={resolveAvatarUrl(profile.avatarUrl)}
          alt={profile.displayName ?? profile.username}
          fallback={profile.displayName ?? profile.username}
          size="lg"
          className="size-24 text-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
              {profile.displayName ?? profile.username}
            </h1>
            {profile.role === 'PIONEER' ? <Badge tone="primary">Pionnier</Badge> : null}
            <Badge tone={visibility === 'PUBLIC' ? 'success' : 'neutral'}>
              {visibility === 'PUBLIC' ? 'Profil public' : 'Profil privé'}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">@{profile.username}</p>
          <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-foreground">
            {profile.bio || 'Aucune biographie renseignée.'}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Membre depuis le{' '}
            {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
              new Date(profile.createdAt ?? profile.updatedAt),
            )}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button asChild size="sm">
          <Link href="/settings/profile">
            <UserPen className="size-4" /> Modifier le profil
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/settings/profile">
            <Settings className="size-4" /> Préférences
          </Link>
        </Button>
        {visibility === 'PUBLIC' ? (
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="size-4" /> Copier le lien du profil
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}
