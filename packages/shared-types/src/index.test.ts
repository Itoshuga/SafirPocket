import { describe, expect, it } from 'vitest';
import { hasPermission, ROLE_LABELS } from './index.js';

describe('public role labels', () => {
  it('provides the four French labels used by role badges', () => {
    expect(ROLE_LABELS).toEqual({
      USER: 'Utilisateur',
      PIONEER: 'Pionnier',
      MODERATOR: 'Modérateur',
      ADMINISTRATOR: 'Administrateur',
    });
  });
});

describe('booster permissions', () => {
  it('allows moderators to manage boosters without permanent deletion rights', () => {
    expect(hasPermission('MODERATOR', 'BOOSTERS_READ_ADMIN')).toBe(true);
    expect(hasPermission('MODERATOR', 'BOOSTERS_CREATE')).toBe(true);
    expect(hasPermission('MODERATOR', 'BOOSTERS_UPDATE')).toBe(true);
    expect(hasPermission('MODERATOR', 'BOOSTERS_ARCHIVE')).toBe(true);
    expect(hasPermission('MODERATOR', 'BOOSTERS_MANAGE_DROP_RATES')).toBe(true);
    expect(hasPermission('MODERATOR', 'BOOSTERS_RESTORE')).toBe(false);
    expect(hasPermission('MODERATOR', 'BOOSTERS_DELETE_PERMANENTLY')).toBe(false);
  });

  it('reserves restore and permanent deletion for administrators', () => {
    expect(hasPermission('ADMINISTRATOR', 'BOOSTERS_RESTORE')).toBe(true);
    expect(hasPermission('ADMINISTRATOR', 'BOOSTERS_DELETE_PERMANENTLY')).toBe(true);
    expect(hasPermission('USER', 'BOOSTERS_READ_ADMIN')).toBe(false);
  });
});
