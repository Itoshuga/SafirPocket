import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20260720090000_card_data_import_export.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const prismaSchema = readFileSync(
  fileURLToPath(new URL('../../../../prisma/schema.prisma', import.meta.url)),
  'utf8',
);

describe('card data operation migration contract', () => {
  it('adds history and preview storage without creating another card table', () => {
    expect(migration).toContain('create table public.card_data_operations');
    expect(migration).toContain('preview_payload jsonb');
    expect(migration).toContain('file_hash char(64)');
    expect(migration).not.toContain('create table public.cards');
  });

  it('indexes history and short-lived previews', () => {
    expect(migration).toContain('card_data_operations_actor_idx');
    expect(migration).toContain('card_data_operations_type_idx');
    expect(migration).toContain('card_data_operations_status_idx');
    expect(migration).toContain('card_data_operations_preview_expiry_idx');
  });

  it('keeps payloads inaccessible to browser database roles', () => {
    expect(migration).toContain(
      'alter table public.card_data_operations enable row level security',
    );
    expect(migration).toContain(
      'revoke all on public.card_data_operations from anon, authenticated',
    );
  });

  it('mirrors operations and their actor relation in Prisma', () => {
    expect(prismaSchema).toContain('model CardDataOperation');
    expect(prismaSchema).toMatch(/cardDataOperations\s+CardDataOperation\[\]/);
    expect(prismaSchema).toContain('@@map("card_data_operations")');
  });
});
