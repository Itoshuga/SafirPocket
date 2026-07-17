'use client';

import { Avatar, Button, DropdownMenu, Skeleton } from '@safir/ui';
import { LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from './auth-provider';
import { useAppStore } from '@/stores/app-store';

export function AuthControls() {
  const { user, loading, signOut } = useAuth();
  const notify = useAppStore((state) => state.notify);
  if (loading) return <Skeleton className="h-9 w-24" />;
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">Connexion</Link>
      </Button>
    );
  }
  const label = user.user_metadata.display_name ?? user.email ?? 'Compte';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="Ouvrir le menu du compte"
        >
          <Avatar alt={String(label)} fallback={String(label)} size="sm" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label className="max-w-56 truncate">{String(label)}</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item asChild>
          <Link href="/profile">
            <UserRound className="size-4" /> Profil
          </Link>
        </DropdownMenu.Item>
        <DropdownMenu.Item asChild>
          <Link href="/profile#preferences">
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
          <LogOut className="size-4" /> Déconnexion
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
