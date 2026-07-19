import { hasPermission, type AppPermission, type AppRole } from '@safir/shared-types';
import {
  BookOpen,
  Bell,
  Boxes,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  CircleUserRound,
  GalleryVerticalEnd,
  Gem,
  House,
  Layers3,
  LayoutDashboard,
  PackageOpen,
  ScrollText,
  ShieldCheck,
  Swords,
  Tags,
  Users,
  LockKeyhole,
  UserCog,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';

const internalOrigin = 'https://safir-pocket.local';

export type NavigationMatch = 'exact' | 'segment';

export interface NavigationItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  match: NavigationMatch;
  requiresAuthentication?: boolean;
  permission?: AppPermission;
}

export interface NavigationGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  permission: AppPermission;
  children: readonly NavigationItem[];
}

export const primaryNavigationItems = [
  { key: 'home', href: '/', label: 'Accueil', icon: House, match: 'exact' },
  { key: 'cards', href: '/cards', label: 'Cartes', icon: BookOpen, match: 'segment' },
  {
    key: 'collection',
    href: '/collection',
    label: 'Collection',
    icon: Boxes,
    match: 'segment',
    requiresAuthentication: true,
  },
  {
    key: 'decks',
    href: '/decks',
    label: 'Decks',
    icon: Layers3,
    match: 'segment',
    requiresAuthentication: true,
  },
  {
    key: 'boosters',
    href: '/boosters',
    label: 'Boosters',
    icon: PackageOpen,
    match: 'segment',
    requiresAuthentication: true,
  },
  {
    key: 'play',
    href: '/play',
    label: 'Jouer',
    icon: Swords,
    match: 'segment',
    requiresAuthentication: true,
  },
  {
    key: 'rankings',
    href: '/rankings',
    label: 'Classement',
    icon: ChartNoAxesColumnIncreasing,
    match: 'segment',
  },
  {
    key: 'profile',
    href: '/profile',
    label: 'Profil',
    icon: CircleUserRound,
    match: 'segment',
    requiresAuthentication: true,
  },
] as const satisfies readonly NavigationItem[];

export const adminNavigationGroup = {
  key: 'administration',
  label: 'Administration',
  icon: ShieldCheck,
  permission: 'ADMIN_ACCESS',
  children: [
    {
      key: 'admin-overview',
      href: '/admin',
      label: 'Vue d\u2019ensemble',
      icon: LayoutDashboard,
      match: 'exact',
      permission: 'ADMIN_ACCESS',
    },
    {
      key: 'admin-users',
      href: '/admin/users',
      label: 'Utilisateurs',
      icon: Users,
      match: 'segment',
      permission: 'USERS_READ',
    },
    {
      key: 'admin-cards',
      href: '/admin/cards',
      label: 'Cartes',
      icon: GalleryVerticalEnd,
      match: 'segment',
      permission: 'CARDS_READ_ADMIN',
    },
    {
      key: 'admin-rarities',
      href: '/admin/rarities',
      label: 'Raretés',
      icon: Gem,
      match: 'segment',
      permission: 'CARDS_READ_ADMIN',
    },
    {
      key: 'admin-seasons',
      href: '/admin/seasons',
      label: 'Saisons',
      icon: CalendarRange,
      match: 'segment',
      permission: 'CARDS_READ_ADMIN',
    },
    {
      key: 'admin-types',
      href: '/admin/types',
      label: 'Types',
      icon: Tags,
      match: 'segment',
      permission: 'CARDS_READ_ADMIN',
    },
    {
      key: 'admin-audit-logs',
      href: '/admin/audit-logs',
      label: 'Journaux',
      icon: ScrollText,
      match: 'segment',
      permission: 'AUDIT_LOGS_READ',
    },
  ],
} as const satisfies NavigationGroup;

export const mobilePrimaryHrefs = new Set(['/cards', '/collection', '/decks', '/boosters']);

export const settingsNavigationItems = [
  {
    key: 'settings-profile',
    href: '/settings/profile',
    label: 'Profil',
    icon: UserCog,
    match: 'exact',
    requiresAuthentication: true,
  },
  {
    key: 'settings-privacy',
    href: '/settings/privacy',
    label: 'Confidentialité',
    icon: LockKeyhole,
    match: 'exact',
    requiresAuthentication: true,
  },
  {
    key: 'settings-notifications',
    href: '/settings/notifications',
    label: 'Notifications',
    icon: Bell,
    match: 'exact',
    requiresAuthentication: true,
  },
  {
    key: 'settings-account',
    href: '/settings/account',
    label: 'Compte',
    icon: CircleUserRound,
    match: 'exact',
    requiresAuthentication: true,
  },
  {
    key: 'settings-friends',
    href: '/settings/friends',
    label: 'Amis',
    icon: UserRoundCheck,
    match: 'exact',
    requiresAuthentication: true,
  },
] as const satisfies readonly NavigationItem[];

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  return path === '/' ? path : path.replace(/\/+$/, '');
}

export function isNavigationItemActive(pathname: string, item: NavigationItem): boolean {
  const path = normalizePathname(pathname);
  return item.match === 'exact'
    ? path === item.href
    : path === item.href || path.startsWith(`${item.href}/`);
}

export function isAdministrationPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === '/admin' || path.startsWith('/admin/');
}

export function resolveAdministrationOpen(pathname: string, currentlyOpen: boolean): boolean {
  return currentlyOpen || isAdministrationPath(pathname);
}

export function getVisibleAdminNavigationItems(role: AppRole): NavigationItem[] {
  if (!hasPermission(role, adminNavigationGroup.permission)) return [];
  return adminNavigationGroup.children.filter(
    (item) => !item.permission || hasPermission(role, item.permission),
  );
}

export function canAccessAdministration(role: AppRole): boolean {
  return hasPermission(role, 'ADMIN_ACCESS');
}

export function canReadAuditLogs(role: AppRole): boolean {
  return hasPermission(role, 'AUDIT_LOGS_READ');
}

export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (!value?.startsWith('/')) return fallback;
  try {
    const url = new URL(value, internalOrigin);
    if (url.origin !== internalOrigin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
