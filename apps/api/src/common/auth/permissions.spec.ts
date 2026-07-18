import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions.js';

describe('role permission matrix', () => {
  it.each(['USER', 'PIONEER'] as const)('%s cannot access administration', (role) => {
    expect(hasPermission(role, 'ADMIN_ACCESS')).toBe(false);
  });

  it.each(['MODERATOR', 'ADMINISTRATOR'] as const)('%s can access administration', (role) => {
    expect(hasPermission(role, 'ADMIN_ACCESS')).toBe(true);
  });

  it('keeps role changes and permanent deletion administrator-only', () => {
    expect(hasPermission('MODERATOR', 'USERS_CHANGE_ROLE')).toBe(false);
    expect(hasPermission('MODERATOR', 'CARDS_DELETE_PERMANENTLY')).toBe(false);
    expect(hasPermission('ADMINISTRATOR', 'USERS_CHANGE_ROLE')).toBe(true);
    expect(hasPermission('ADMINISTRATOR', 'CARDS_DELETE_PERMANENTLY')).toBe(true);
  });

  it('grants moderators only the approved user-management actions', () => {
    expect(hasPermission('MODERATOR', 'USERS_UPDATE_PROFILE')).toBe(true);
    expect(hasPermission('MODERATOR', 'USERS_SEND_PASSWORD_RESET')).toBe(true);
    expect(hasPermission('MODERATOR', 'USERS_WARN')).toBe(true);
    expect(hasPermission('MODERATOR', 'USERS_SUSPEND')).toBe(true);
    expect(hasPermission('MODERATOR', 'USERS_BAN')).toBe(true);
    expect(hasPermission('MODERATOR', 'USERS_UPDATE_EMAIL')).toBe(false);
    expect(hasPermission('MODERATOR', 'USERS_SET_TEMPORARY_PASSWORD')).toBe(false);
    expect(hasPermission('MODERATOR', 'USERS_DELETE')).toBe(false);
  });

  it('reserves sensitive identity actions for administrators', () => {
    expect(hasPermission('ADMINISTRATOR', 'USERS_UPDATE_EMAIL')).toBe(true);
    expect(hasPermission('ADMINISTRATOR', 'USERS_SET_TEMPORARY_PASSWORD')).toBe(true);
    expect(hasPermission('ADMINISTRATOR', 'USERS_DELETE')).toBe(true);
  });
});
