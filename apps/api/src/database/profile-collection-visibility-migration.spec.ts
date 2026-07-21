import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260721100000_profile_collection_visibility.sql',
  ),
  'utf8',
);

describe('profile collection visibility migration contract', () => {
  it('is additive and backfills safe defaults through non-null columns', () => {
    expect(migration).toContain("collection_visibility as enum ('PUBLIC', 'FRIENDS', 'PRIVATE')");
    expect(migration).toContain(
      "collection_visibility public.collection_visibility not null default 'PUBLIC'",
    );
    expect(migration).toContain('show_card_quantities boolean not null default true');
    expect(migration).toContain('show_collection_completion boolean not null default true');
    expect(migration).not.toMatch(/drop\s+(table|column)/i);
  });
});
