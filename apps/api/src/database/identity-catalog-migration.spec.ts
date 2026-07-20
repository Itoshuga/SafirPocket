import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20260717200000_identity_moderation_admin_catalog.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const initialMigration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20260717150000_initial_foundation.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const prismaSchema = readFileSync(
  fileURLToPath(new URL('../../../../prisma/schema.prisma', import.meta.url)),
  'utf8',
);
const userSecurityMigration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20260718090000_user_security_warnings.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('identity and catalog migration contract', () => {
  it('qualifies the outer Storage object name in catalog policies', () => {
    expect(initialMigration).toContain('cards.artwork_path = storage.objects.name');
    expect(initialMigration).toContain('card_variants.artwork_path = storage.objects.name');
    expect(initialMigration).toContain('card_sets.artwork_path = storage.objects.name');
    expect(initialMigration).not.toMatch(/artwork_path = name/);
  });

  it('creates an Auth-linked profile with safe identity defaults', () => {
    expect(migration).toContain('after insert on auth.users');
    expect(migration).toMatch(/insert into public\.user_profiles[\s\S]*?new\.id/);
    expect(migration).toMatch(/'USER',[\s\r\n]+\s*'ACTIVE'/);
    expect(migration).toContain('USERNAME_INVALID');
    expect(migration).toContain('user_profiles_normalized_username_key');
    expect(migration).toContain('lower(requested_username)');
  });

  it('keeps credentials out of the application profile', () => {
    const userProfileModel = prismaSchema.match(/model UserProfile \{[\s\S]*?\n\}/)?.[0];
    expect(userProfileModel).toBeDefined();
    expect(userProfileModel).not.toMatch(/password(Hash|Value|Secret)|temporaryPassword/i);
    expect(userProfileModel).toMatch(/mustChangePassword\s+Boolean/);
    expect(userProfileModel).toContain('@@map("user_profiles")');
  });

  it('provides a dry-run, non-destructive and idempotent repair helper', () => {
    expect(migration).toContain(
      'function public.repair_missing_user_profiles(apply_changes boolean default false)',
    );
    expect(migration).toContain('left join public.user_profiles profile');
    expect(migration).toContain("outcome := 'READY'");
    expect(migration).toContain("outcome := 'CREATED'");
    expect(migration).toContain(
      'revoke all on function public.repair_missing_user_profiles(boolean) from public, anon, authenticated',
    );
  });

  it('normalizes the catalog without dropping legacy card data', () => {
    expect(migration).toContain('create table public.card_rarities');
    expect(migration).toContain('create table public.card_seasons');
    expect(migration).toContain('create table public.card_types');
    expect(migration).toContain('create table public.card_type_links');
    expect(migration).toContain('create table public.catalog_migration_issues');
    expect(migration).toContain('cards_season_number_key unique (season_id, number)');
    expect(migration).not.toMatch(/drop\s+(table|column)\s+.*cards/i);
  });

  it('enables RLS and prevents direct client writes to sensitive tables', () => {
    expect(migration).toContain('alter table public.user_profiles enable row level security');
    expect(migration).toContain(
      'alter table public.user_moderation_actions enable row level security',
    );
    expect(migration).toContain('alter table public.admin_audit_logs enable row level security');
    expect(migration).toContain(
      'revoke all on public.user_moderation_actions, public.admin_audit_logs',
    );
  });

  it('adds durable warnings and a non-secret temporary-password flag', () => {
    expect(userSecurityMigration).toContain('create table if not exists public.user_warnings');
    expect(userSecurityMigration).toContain(
      'add column if not exists must_change_password boolean not null default false',
    );
    expect(userSecurityMigration).toContain(
      'alter table public.user_warnings enable row level security',
    );
    expect(userSecurityMigration).toContain(
      'revoke all on public.user_warnings from anon, authenticated',
    );
    expect(userSecurityMigration).not.toMatch(/delete from|truncate|drop table/i);
    expect(prismaSchema).toContain('model UserWarning');
  });
});
