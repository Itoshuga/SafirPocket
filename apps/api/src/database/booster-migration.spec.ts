import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20260719223000_booster_management_openings.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);
const prismaSchema = readFileSync(
  fileURLToPath(new URL('../../../../prisma/schema.prisma', import.meta.url)),
  'utf8',
);

describe('booster migration contract', () => {
  it('extends the existing product and enforces the Safir 8/6/2 distribution', () => {
    expect(migration).toContain('alter table public.booster_products');
    expect(migration).toContain('cards_per_pack = 8');
    expect(migration).toContain('common_card_count = 6');
    expect(migration).toContain('premium_card_count = 2');
    expect(migration).not.toContain('create table public.booster_products');
  });

  it('stores integer rates and exact opening positions', () => {
    expect(migration).toContain('create table public.booster_rarity_drop_rates');
    expect(migration).toContain('drop_rate_bps > 0 and drop_rate_bps <= 10000');
    expect(migration).toContain(
      "create type public.pack_slot_category as enum ('COMMON', 'PREMIUM')",
    );
    expect(migration).toContain('slot_position between 1 and 8');
    expect(migration).toContain('pack_opening_cards_opening_position_key unique');
  });

  it('keeps configuration and all writes inaccessible to browser roles', () => {
    expect(migration).toContain(
      'alter table public.booster_rarity_drop_rates enable row level security',
    );
    expect(migration).toContain(
      'revoke all on public.booster_rarity_drop_rates from anon, authenticated',
    );
    expect(migration).toContain(
      'revoke insert, update, delete on public.booster_products from anon, authenticated',
    );
  });

  it('mirrors season, rarity, results and history relations in Prisma', () => {
    expect(prismaSchema).toContain('model BoosterRarityDropRate');
    expect(prismaSchema).toContain('guaranteedCommonRarity');
    expect(prismaSchema).toContain('slotCategory');
    expect(prismaSchema).toContain('boosterNameSnapshot');
  });
});
