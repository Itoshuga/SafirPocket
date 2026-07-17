-- Safir Pocket initial schema.
-- Supabase SQL migrations are the only schema migration source of truth.
-- Sensitive writes (inventory, wallets, boosters, matches) are intentionally denied to clients.

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.publication_status as enum ('draft', 'published', 'archived');
create type public.deck_visibility as enum ('private', 'unlisted', 'public');
create type public.pack_opening_status as enum ('pending', 'completed', 'failed');
create type public.mission_status as enum ('active', 'completed', 'claimed', 'expired');
create type public.match_status as enum ('pending', 'active', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_path text,
  bio text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 80),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500)
);
create unique index profiles_username_lower_key on public.profiles (lower(username));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_]', '', 'g'), '');
  if requested_username is null or char_length(requested_username) < 3 then
    requested_username := 'safir_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    left(requested_username, 30),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.id and auth.role() = 'authenticated' then
    new.id = old.id;
    new.role = old.role;
    new.created_at = old.created_at;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
before update on public.profiles
for each row execute function public.protect_profile_fields();

create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create table public.card_sets (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  code text not null unique,
  description text,
  release_date date,
  artwork_path text,
  status public.publication_status not null default 'draft',
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default extensions.gen_random_uuid(),
  set_id uuid not null references public.card_sets(id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  collection_number text not null,
  rarity text not null,
  card_type text not null,
  cost integer,
  effect_text text,
  effects jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  artwork_path text,
  status public.publication_status not null default 'draft',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_set_slug_key unique (set_id, slug),
  constraint cards_collection_number_key unique (set_id, collection_number),
  constraint cards_cost_nonnegative check (cost is null or cost >= 0),
  constraint cards_effects_data_only check (jsonb_typeof(effects) = 'array')
);
create index cards_catalog_idx on public.cards (status, card_type, rarity);

create table public.card_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  name text not null,
  slug text not null,
  finish text not null default 'standard',
  artwork_path text,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_variants_card_slug_key unique (card_id, slug)
);

create table public.user_cards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_variant_id uuid not null references public.card_variants(id) on delete restrict,
  quantity integer not null default 0,
  locked_quantity integer not null default 0,
  first_obtained_at timestamptz not null default now(),
  last_obtained_at timestamptz not null default now(),
  primary key (user_id, card_variant_id),
  constraint user_cards_quantities_valid check (
    quantity >= 0 and locked_quantity >= 0 and locked_quantity <= quantity
  )
);

create table public.decks (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default false,
  visibility public.deck_visibility not null default 'private',
  format text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decks_name_length check (char_length(name) between 1 and 80)
);
create index decks_owner_updated_idx on public.decks (owner_id, updated_at desc);
create unique index decks_one_active_per_format_idx on public.decks (owner_id, format) where is_active;

create table public.deck_cards (
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_variant_id uuid not null references public.card_variants(id) on delete restrict,
  quantity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (deck_id, card_variant_id),
  constraint deck_cards_quantity_positive check (quantity > 0)
);

create table public.booster_products (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  artwork_path text,
  price_currency text not null,
  price_amount bigint not null,
  cards_per_pack integer not null,
  status public.publication_status not null default 'draft',
  available_from timestamptz,
  available_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booster_price_nonnegative check (price_amount >= 0),
  constraint booster_cards_positive check (cards_per_pack > 0),
  constraint booster_availability_valid check (available_until is null or available_from is null or available_until > available_from)
);

create table public.booster_product_slots (
  id uuid primary key default extensions.gen_random_uuid(),
  booster_product_id uuid not null references public.booster_products(id) on delete cascade,
  slot_index integer not null,
  quantity integer not null default 1,
  weight_config jsonb not null,
  created_at timestamptz not null default now(),
  constraint booster_product_slots_key unique (booster_product_id, slot_index),
  constraint booster_slot_quantity_positive check (quantity > 0),
  constraint booster_slot_config_object check (jsonb_typeof(weight_config) = 'object')
);

create table public.pack_openings (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  booster_product_id uuid not null references public.booster_products(id) on delete restrict,
  idempotency_key uuid not null,
  status public.pack_opening_status not null default 'pending',
  price_currency text not null,
  price_amount bigint not null,
  error_code text,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pack_openings_user_idempotency_key unique (user_id, idempotency_key)
);

create table public.pack_opening_cards (
  id uuid primary key default extensions.gen_random_uuid(),
  pack_opening_id uuid not null references public.pack_openings(id) on delete cascade,
  card_variant_id uuid not null references public.card_variants(id) on delete restrict,
  slot_index integer not null,
  quantity integer not null default 1,
  probability_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pack_opening_cards_key unique (pack_opening_id, slot_index, card_variant_id),
  constraint pack_opening_cards_quantity_positive check (quantity > 0)
);

create table public.wallets (
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency_code text not null,
  balance bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, currency_code),
  constraint wallets_balance_nonnegative check (balance >= 0)
);

create table public.currency_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  currency_code text not null,
  amount bigint not null,
  balance_after bigint not null,
  reason text not null,
  reference_type text,
  reference_id text,
  idempotency_key uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint currency_transactions_amount_nonzero check (amount <> 0),
  constraint currency_transactions_balance_nonnegative check (balance_after >= 0),
  constraint currency_transactions_user_idempotency_key unique (user_id, idempotency_key)
);
create index currency_transactions_history_idx on public.currency_transactions (user_id, currency_code, created_at desc);

create or replace function public.prevent_currency_transaction_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'currency_transactions are immutable';
end;
$$;
create trigger currency_transactions_no_update
before update or delete on public.currency_transactions
for each row execute function public.prevent_currency_transaction_mutation();

create table public.missions (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  type text not null,
  target jsonb not null,
  rewards jsonb not null,
  status public.publication_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_missions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  status public.mission_status not null default 'active',
  progress jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create table public.matches (
  id uuid primary key default extensions.gen_random_uuid(),
  status public.match_status not null default 'pending',
  format text not null,
  rules_version text not null,
  current_sequence integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  winner_id uuid,
  result_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_sequence_nonnegative check (current_sequence >= 0)
);
create index matches_status_created_idx on public.matches (status, created_at);

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  deck_id uuid references public.decks(id) on delete set null,
  seat integer not null,
  is_ready boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id),
  constraint match_players_seat_key unique (match_id, seat),
  constraint match_players_seat_nonnegative check (seat >= 0)
);

create table public.match_events (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sequence integer not null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  rules_version text not null,
  created_at timestamptz not null default now(),
  constraint match_events_sequence_key unique (match_id, sequence),
  constraint match_events_sequence_positive check (sequence > 0)
);

create table public.ranked_seasons (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ranked_season_dates_valid check (ends_at > starts_at)
);

create table public.ranked_ratings (
  season_id uuid not null references public.ranked_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id),
  constraint ranked_rating_counts_nonnegative check (wins >= 0 and losses >= 0 and draws >= 0)
);
create index ranked_ratings_leaderboard_idx on public.ranked_ratings (season_id, rating desc);

-- Generic updated_at triggers.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'card_sets', 'cards', 'card_variants', 'decks', 'deck_cards',
    'booster_products', 'wallets', 'missions', 'user_missions', 'matches', 'ranked_ratings'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end $$;

-- Storage buckets are idempotently provisioned by the migration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('card-artworks', 'card-artworks', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS is enabled even for catalog tables so unpublished content remains private.
alter table public.profiles enable row level security;
alter table public.card_sets enable row level security;
alter table public.cards enable row level security;
alter table public.card_variants enable row level security;
alter table public.user_cards enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.booster_products enable row level security;
alter table public.booster_product_slots enable row level security;
alter table public.pack_openings enable row level security;
alter table public.pack_opening_cards enable row level security;
alter table public.wallets enable row level security;
alter table public.currency_transactions enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_events enable row level security;
alter table public.ranked_seasons enable row level security;
alter table public.ranked_ratings enable row level security;

create policy profiles_public_read on public.profiles for select using (true);
create policy profiles_owner_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy card_sets_published_read on public.card_sets for select
  using (status = 'published' or public.is_privileged());
create policy cards_published_read on public.cards for select
  using (status = 'published' or public.is_privileged());
create policy card_variants_published_read on public.card_variants for select
  using (exists (
    select 1 from public.cards where cards.id = card_variants.card_id
      and (cards.status = 'published' or public.is_privileged())
  ));

create policy user_cards_owner_read on public.user_cards for select to authenticated
  using (user_id = auth.uid());

create policy decks_owner_read on public.decks for select to authenticated
  using (owner_id = auth.uid() or visibility = 'public');
create policy decks_owner_insert on public.decks for insert to authenticated
  with check (owner_id = auth.uid());
create policy decks_owner_update on public.decks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy decks_owner_delete on public.decks for delete to authenticated
  using (owner_id = auth.uid());

create policy deck_cards_visible_read on public.deck_cards for select to authenticated
  using (exists (
    select 1 from public.decks where decks.id = deck_cards.deck_id
      and (decks.owner_id = auth.uid() or decks.visibility = 'public')
  ));
create policy deck_cards_owner_insert on public.deck_cards for insert to authenticated
  with check (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = auth.uid()));
create policy deck_cards_owner_update on public.deck_cards for update to authenticated
  using (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = auth.uid()))
  with check (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = auth.uid()));
create policy deck_cards_owner_delete on public.deck_cards for delete to authenticated
  using (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = auth.uid()));

create policy booster_products_published_read on public.booster_products for select
  using (status = 'published' or public.is_privileged());
-- No client policy on booster_product_slots: probability configuration remains server-only.
create policy pack_openings_owner_read on public.pack_openings for select to authenticated
  using (user_id = auth.uid());
create policy pack_opening_cards_owner_read on public.pack_opening_cards for select to authenticated
  using (exists (
    select 1 from public.pack_openings
    where pack_openings.id = pack_opening_cards.pack_opening_id and pack_openings.user_id = auth.uid()
  ));

create policy wallets_owner_read on public.wallets for select to authenticated using (user_id = auth.uid());
create policy currency_transactions_owner_read on public.currency_transactions for select to authenticated
  using (user_id = auth.uid());

create policy missions_published_read on public.missions for select
  using (status = 'published' or public.is_privileged());
create policy user_missions_owner_read on public.user_missions for select to authenticated
  using (user_id = auth.uid());

create policy matches_participant_read on public.matches for select to authenticated
  using (exists (select 1 from public.match_players where match_players.match_id = matches.id and match_players.user_id = auth.uid()));
create policy match_players_participant_read on public.match_players for select to authenticated
  using (exists (select 1 from public.match_players own where own.match_id = match_players.match_id and own.user_id = auth.uid()));
create policy match_events_participant_read on public.match_events for select to authenticated
  using (exists (select 1 from public.match_players where match_players.match_id = match_events.match_id and match_players.user_id = auth.uid()));

create policy ranked_seasons_public_read on public.ranked_seasons for select using (true);
create policy ranked_ratings_public_read on public.ranked_ratings for select using (true);

-- Storage: avatars are public; card artwork becomes readable only when linked to published catalog data.
create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
  with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

create policy card_artworks_published_read on storage.objects for select
  using (
    bucket_id = 'card-artworks' and (
      exists (select 1 from public.cards where cards.artwork_path = name and cards.status = 'published')
      or exists (select 1 from public.card_variants join public.cards on cards.id = card_variants.card_id
        where card_variants.artwork_path = name and cards.status = 'published')
      or exists (select 1 from public.card_sets where card_sets.artwork_path = name and card_sets.status = 'published')
    )
  );
create policy card_artworks_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-artworks' and public.is_admin()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'avif')
  );
create policy card_artworks_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'card-artworks' and public.is_admin())
  with check (bucket_id = 'card-artworks' and public.is_admin());
create policy card_artworks_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'card-artworks' and public.is_admin());

-- Reduce grants in addition to RLS. Server-side writes use a trusted database/service role.
revoke insert, update, delete on public.user_cards, public.wallets, public.currency_transactions,
  public.pack_openings, public.pack_opening_cards, public.user_missions, public.matches,
  public.match_players, public.match_events from anon, authenticated;
revoke all on public.booster_product_slots from anon, authenticated;
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_path, bio) on public.profiles to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.card_sets, public.cards, public.card_variants, public.booster_products,
  public.profiles, public.missions, public.ranked_seasons, public.ranked_ratings to anon, authenticated;
grant select on public.user_cards, public.wallets, public.currency_transactions, public.pack_openings,
  public.pack_opening_cards, public.user_missions, public.matches, public.match_players,
  public.match_events to authenticated;
grant select, insert, update, delete on public.decks, public.deck_cards to authenticated;
