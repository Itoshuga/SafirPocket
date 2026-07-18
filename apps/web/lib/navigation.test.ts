import { describe, expect, it } from 'vitest';
import {
  adminNavigationGroup,
  canAccessAdministration,
  canReadAuditLogs,
  getVisibleAdminNavigationItems,
  isAdministrationPath,
  isNavigationItemActive,
  resolveAdministrationOpen,
  safeInternalPath,
} from './navigation';

describe('safeInternalPath', () => {
  it('keeps an internal path with its query and fragment', () => {
    expect(safeInternalPath('/decks/123?tab=cards#summary')).toBe('/decks/123?tab=cards#summary');
  });

  it.each(['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)'])(
    'rejects an external redirect target: %s',
    (target) => {
      expect(safeInternalPath(target, '/collection')).toBe('/collection');
    },
  );
});

describe('administration navigation permissions', () => {
  it.each(['USER', 'PIONEER'] as const)('hides administration from %s', (role) => {
    expect(canAccessAdministration(role)).toBe(false);
  });

  it.each(['MODERATOR', 'ADMINISTRATOR'] as const)('shows administration to %s', (role) => {
    expect(canAccessAdministration(role)).toBe(true);
  });

  it('keeps audit logs administrator-only', () => {
    expect(canReadAuditLogs('MODERATOR')).toBe(false);
    expect(canReadAuditLogs('ADMINISTRATOR')).toBe(true);
  });

  it('declares the complete administration group in one ordered configuration', () => {
    expect(adminNavigationGroup.label).toBe('Administration');
    expect(
      adminNavigationGroup.children.map(({ label, href, permission }) => ({
        label,
        href,
        permission,
      })),
    ).toEqual([
      { label: 'Vue d’ensemble', href: '/admin', permission: 'ADMIN_ACCESS' },
      { label: 'Utilisateurs', href: '/admin/users', permission: 'USERS_READ' },
      { label: 'Cartes', href: '/admin/cards', permission: 'CARDS_READ_ADMIN' },
      { label: 'Raretés', href: '/admin/rarities', permission: 'CARDS_READ_ADMIN' },
      { label: 'Saisons', href: '/admin/seasons', permission: 'CARDS_READ_ADMIN' },
      { label: 'Types', href: '/admin/types', permission: 'CARDS_READ_ADMIN' },
      { label: 'Journaux', href: '/admin/audit-logs', permission: 'AUDIT_LOGS_READ' },
    ]);
  });

  it('filters every child from the shared role permission matrix', () => {
    expect(getVisibleAdminNavigationItems('USER')).toEqual([]);
    expect(getVisibleAdminNavigationItems('PIONEER')).toEqual([]);
    expect(getVisibleAdminNavigationItems('MODERATOR').map((item) => item.label)).toEqual([
      'Vue d’ensemble',
      'Utilisateurs',
      'Cartes',
      'Raretés',
      'Saisons',
      'Types',
    ]);
    expect(getVisibleAdminNavigationItems('ADMINISTRATOR').map((item) => item.label)).toEqual([
      'Vue d’ensemble',
      'Utilisateurs',
      'Cartes',
      'Raretés',
      'Saisons',
      'Types',
      'Journaux',
    ]);
  });
});

describe('administration route matching', () => {
  it.each([
    ['/admin', 'admin-overview'],
    ['/admin/users', 'admin-users'],
    ['/admin/users/11111111-1111-4111-8111-111111111111', 'admin-users'],
    ['/admin/cards', 'admin-cards'],
    ['/admin/cards/new', 'admin-cards'],
    ['/admin/cards/66666666-6666-4666-8666-666666666666', 'admin-cards'],
    ['/admin/rarities', 'admin-rarities'],
    ['/admin/seasons', 'admin-seasons'],
    ['/admin/types', 'admin-types'],
    ['/admin/audit-logs', 'admin-audit-logs'],
  ])('activates only %s for %s', (pathname, expectedKey) => {
    const activeItems = adminNavigationGroup.children.filter((item) =>
      isNavigationItemActive(pathname, item),
    );
    expect(activeItems.map((item) => item.key)).toEqual([expectedKey]);
  });

  it('does not confuse similarly prefixed non-admin routes', () => {
    expect(isAdministrationPath('/administrator')).toBe(false);
    expect(
      adminNavigationGroup.children.some((item) =>
        isNavigationItemActive('/admin/cards-archive', item),
      ),
    ).toBe(false);
  });

  it('opens automatically on any administration route and preserves a manual opening', () => {
    expect(resolveAdministrationOpen('/admin/cards/new', false)).toBe(true);
    expect(resolveAdministrationOpen('/cards', true)).toBe(true);
    expect(resolveAdministrationOpen('/cards', false)).toBe(false);
  });
});
