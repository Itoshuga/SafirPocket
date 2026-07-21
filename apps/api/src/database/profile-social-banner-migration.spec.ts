import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20260721200000_profile_social_banners.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const prismaSchema = readFileSync(
  fileURLToPath(new URL('../../../../prisma/schema.prisma', import.meta.url)),
  'utf8',
);

describe('profile social banner migration contract', () => {
  it('adds safe profile fields and constrains crop positioning', () => {
    expect(migration).toContain('add column if not exists banner_url text');
    expect(migration).toContain(
      'add column if not exists banner_position_y smallint not null default 50',
    );
    expect(migration).toContain('check (banner_position_y between 0 and 100)');
    expect(migration).not.toMatch(/drop\s+(table|column)|truncate|delete\s+from/i);
  });

  it('creates a public 8 MiB image bucket with owner-folder write policies', () => {
    expect(migration).toContain("'profile-banners'");
    expect(migration).toContain('8388608');
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(migration).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(migration).toContain('owner_id = auth.uid()::text');
    expect(migration).toContain('profile_banners_public_read');
    expect(migration).toContain('profile_banners_owner_insert');
    expect(migration).toContain('profile_banners_owner_update');
    expect(migration).toContain('profile_banners_owner_delete');
  });

  it('keeps Prisma aligned with the additive migration', () => {
    const model = prismaSchema.match(/model UserProfile \{[\s\S]*?\n\}/)?.[0];
    expect(model).toContain('bannerUrl');
    expect(model).toContain('@map("banner_url")');
    expect(model).toContain('bannerPositionY');
    expect(model).toContain('@map("banner_position_y")');
  });
});
