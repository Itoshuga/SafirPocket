-- Complete booster administration, rarity rates and auditable eight-card openings.
create type public.pack_slot_category as enum ('COMMON', 'PREMIUM');

alter table public.booster_products
  add column season_id uuid references public.card_seasons(id) on delete restrict,
  add column image_url text,
  add column guaranteed_common_rarity_id uuid references public.card_rarities(id) on delete restrict,
  add column common_card_count smallint not null default 6,
  add column premium_card_count smallint not null default 2,
  add column is_active boolean not null default false,
  add column sort_order integer not null default 0,
  add column deleted_at timestamptz;

update public.booster_products
set image_url = artwork_path,
    is_active = status = 'published';

with inferred as (
  select distinct on (slots.booster_product_id)
    slots.booster_product_id,
    cards.season_id,
    cards.rarity_id
  from public.booster_product_slots slots
  cross join lateral jsonb_array_elements(coalesce(slots.weight_config -> 'entries', '[]'::jsonb)) entry
  join public.card_variants variants on variants.id = (entry ->> 'cardVariantId')::uuid
  join public.cards on cards.id = variants.card_id
  order by slots.booster_product_id, slots.slot_index, cards.created_at
)
update public.booster_products product
set season_id = inferred.season_id,
    guaranteed_common_rarity_id = inferred.rarity_id
from inferred
where inferred.booster_product_id = product.id
  and product.season_id is null;

update public.booster_products product
set season_id = (
  select id from public.card_seasons where deleted_at is null order by sort_order, created_at limit 1
)
where product.season_id is null;

update public.booster_products product
set guaranteed_common_rarity_id = (
  select id from public.card_rarities where deleted_at is null order by sort_order, created_at limit 1
)
where product.guaranteed_common_rarity_id is null;

do $$
begin
  if exists (
    select 1 from public.booster_products
    where season_id is null or guaranteed_common_rarity_id is null
  ) then
    raise exception 'Existing boosters require at least one season and one rarity before this migration';
  end if;
end $$;

alter table public.booster_products
  alter column season_id set not null,
  alter column guaranteed_common_rarity_id set not null,
  alter column cards_per_pack set default 8,
  alter column price_amount set default 0,
  alter column price_currency drop not null,
  add constraint booster_products_name_length check (char_length(name) between 1 and 150),
  add constraint booster_products_slug_length check (char_length(slug) between 1 and 160),
  add constraint booster_products_cards_per_pack_safir check (cards_per_pack = 8),
  add constraint booster_products_common_card_count_safir check (common_card_count = 6),
  add constraint booster_products_premium_card_count_safir check (premium_card_count = 2),
  add constraint booster_products_price_nonnegative check (price_amount >= 0),
  add constraint booster_products_paid_currency_required check (price_amount = 0 or price_currency is not null),
  add constraint booster_products_dates_ordered check (available_until is null or available_from is null or available_until > available_from),
  add constraint booster_products_season_name_key unique (season_id, name);

create index booster_products_season_idx on public.booster_products (season_id, sort_order, name);
create index booster_products_active_idx on public.booster_products (is_active, deleted_at, sort_order);
create index booster_products_availability_idx on public.booster_products (available_from, available_until);

create table public.booster_rarity_drop_rates (
  booster_id uuid not null references public.booster_products(id) on delete cascade,
  rarity_id uuid not null references public.card_rarities(id) on delete restrict,
  drop_rate_bps integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (booster_id, rarity_id),
  constraint booster_drop_rate_range check (drop_rate_bps > 0 and drop_rate_bps <= 10000)
);

create index booster_drop_rates_booster_sort_idx
  on public.booster_rarity_drop_rates (booster_id, sort_order, rarity_id);

create trigger booster_rarity_drop_rates_set_updated_at
before update on public.booster_rarity_drop_rates
for each row execute function public.set_updated_at();

alter table public.pack_openings
  add column season_id uuid references public.card_seasons(id) on delete restrict,
  add column booster_name_snapshot text;

update public.pack_openings opening
set season_id = product.season_id,
    booster_name_snapshot = product.name
from public.booster_products product
where product.id = opening.booster_product_id;

alter table public.pack_openings
  alter column season_id set not null,
  alter column booster_name_snapshot set not null,
  alter column price_currency drop not null,
  add constraint pack_openings_price_nonnegative check (price_amount >= 0),
  add constraint pack_openings_paid_currency_required check (price_amount = 0 or price_currency is not null);

alter table public.pack_opening_cards
  add column card_id uuid references public.cards(id) on delete restrict,
  add column rarity_id uuid references public.card_rarities(id) on delete restrict,
  add column slot_position smallint,
  add column slot_category public.pack_slot_category,
  add column card_name_snapshot text,
  add column rarity_name_snapshot text,
  add column previous_quantity integer,
  add column new_quantity integer;

alter table public.pack_opening_cards drop constraint pack_opening_cards_key;

create temporary table booster_opening_results_expanded on commit drop as
  select result.id as source_id,
         copies.copy_index,
         row_number() over (
           partition by result.pack_opening_id
           order by result.slot_index, result.created_at, result.id, copies.copy_index
         )::smallint as position,
         result.pack_opening_id,
         result.card_variant_id,
         result.probability_data,
         result.created_at,
         cards.id as card_id,
         cards.name as card_name,
         rarities.id as rarity_id,
         rarities.name as rarity_name
  from public.pack_opening_cards result
  cross join lateral generate_series(1, result.quantity) copies(copy_index)
  join public.card_variants variants on variants.id = result.card_variant_id
  join public.cards on cards.id = variants.card_id
  join public.card_rarities rarities on rarities.id = cards.rarity_id;

update public.pack_opening_cards result
set card_id = expanded.card_id,
    rarity_id = expanded.rarity_id,
    slot_index = expanded.position,
    slot_position = expanded.position,
    slot_category = case when expanded.position <= 6 then 'COMMON' else 'PREMIUM' end::public.pack_slot_category,
    card_name_snapshot = expanded.card_name,
    rarity_name_snapshot = expanded.rarity_name,
    previous_quantity = 0,
    new_quantity = 1,
    quantity = 1
from booster_opening_results_expanded expanded
where expanded.source_id = result.id and expanded.copy_index = 1;

insert into public.pack_opening_cards (
  pack_opening_id,
  card_id,
  card_variant_id,
  rarity_id,
  slot_index,
  slot_position,
  slot_category,
  quantity,
  probability_data,
  card_name_snapshot,
  rarity_name_snapshot,
  previous_quantity,
  new_quantity,
  created_at
)
select pack_opening_id,
       card_id,
       card_variant_id,
       rarity_id,
       position,
       position,
       case when position <= 6 then 'COMMON' else 'PREMIUM' end::public.pack_slot_category,
       1,
       probability_data,
       card_name,
       rarity_name,
       0,
       1,
       created_at
from booster_opening_results_expanded
where copy_index > 1;

do $$
begin
  if exists (
    select 1 from public.pack_opening_cards
    where card_id is null or rarity_id is null or slot_position is null or slot_position > 8
  ) then
    raise exception 'Existing opening results cannot be converted to eight exact positions';
  end if;
end $$;

alter table public.pack_opening_cards
  alter column card_id set not null,
  alter column rarity_id set not null,
  alter column slot_position set not null,
  alter column slot_category set not null,
  alter column card_name_snapshot set not null,
  alter column rarity_name_snapshot set not null,
  alter column previous_quantity set not null,
  alter column new_quantity set not null,
  add constraint pack_opening_cards_quantity_one check (quantity = 1),
  add constraint pack_opening_cards_slot_range check (slot_position between 1 and 8),
  add constraint pack_opening_cards_slot_category_match check (
    (slot_position between 1 and 6 and slot_category = 'COMMON')
    or (slot_position between 7 and 8 and slot_category = 'PREMIUM')
  ),
  add constraint pack_opening_cards_quantities_valid check (
    previous_quantity >= 0 and new_quantity = previous_quantity + 1
  ),
  add constraint pack_opening_cards_opening_position_key unique (pack_opening_id, slot_position);

alter table public.booster_rarity_drop_rates enable row level security;

drop policy if exists booster_products_published_read on public.booster_products;
create policy booster_products_published_read on public.booster_products for select
  using (
    (status = 'published' and is_active and deleted_at is null)
    or public.is_privileged()
  );

-- Probability configuration and every write remain server-only.
revoke all on public.booster_rarity_drop_rates from anon, authenticated;
revoke insert, update, delete on public.booster_products from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booster-designs',
  'booster-designs',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy booster_designs_public_read on storage.objects for select
  using (bucket_id = 'booster-designs');
create policy booster_designs_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booster-designs'
    and public.is_privileged()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'avif')
  );
create policy booster_designs_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'booster-designs' and public.is_privileged())
  with check (bucket_id = 'booster-designs' and public.is_privileged());
create policy booster_designs_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'booster-designs' and public.is_privileged());

comment on table public.booster_product_slots is
  'Legacy compatibility only. New Safir boosters use season pools and booster_rarity_drop_rates.';
