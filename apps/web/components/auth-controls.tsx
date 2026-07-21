'use client';

import { Avatar, Button, DropdownMenu, Skeleton } from '@safir/ui';
import { LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from './auth-provider';
import { useAppStore } from '@/stores/app-store';
import { resolveAvatarUrl } from '@/lib/avatar-url';
import { UserRoleBadge } from './user-role-badge';

export function AuthControls() {
  const { user, profile, loading, signOut } = useAuth();
  const notify = useAppStore((state) => state.notify);
  if (loading) return <Skeleton className="h-9 w-24" />;
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">Connexion</Link>
      </Button>
    );
  }
  const label = profile?.displayName ?? profile?.username ?? user.email ?? 'Compte';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="Ouvrir le menu du compte"
        >
          <Avatar
            src={resolveAvatarUrl(profile?.avatarUrl)}
            alt={String(label)}
            fallback={String(label)}
            size="sm"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label className="max-w-56">
          <span className="block truncate">{String(label)}</span>
          {profile ? (
            <span className="mt-1 block">
              <UserRoleBadge role={profile.role} />
            </span>
          ) : null}
        </DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item asChild>
          <Link href="/profile">
            <UserRound className="size-4" /> Voir mon profil
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Item asChild>
          <Link href="/settings/profile">
            <Settings className="size-4" /> Préférences
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          onSelect={() => {
            void signOut().then(() => {
              notify('Vous êtes déconnecté.', 'success');
              window.location.assign('/');
            });
          }}
        >
          <LogOut className="size-4" /> {'Se d\u00e9connecter'}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
