-- Identity, moderation and relational catalog foundation.
-- This migration preserves existing profile and card rows. Legacy catalog columns remain
-- available while API consumers move to the normalized relations.

begin;

create type public.app_role as enum ('USER', 'PIONEER', 'MODERATOR', 'ADMINISTRATOR');
create type public.account_status as enum ('ACTIVE', 'SUSPENDED', 'BANNED');
create type public.moderation_action as enum (
  'USER_SUSPENDED',
  'USER_UNSUSPENDED',
  'USER_BANNED',
  'USER_UNBANNED',
  'ROLE_CHANGED',
  'PIONEER_GRANTED',
  'PIONEER_REVOKED'
);

-- Keep the Auth UUID and every existing foreign key while adopting the explicit application name.
alter table public.profiles rename to user_profiles;

do $$
begin
  if exists (
    select 1
    from public.user_profiles
    where char_length(username) not between 3 and 24
      or username !~ '^[A-Za-z0-9_][A-Za-z0-9_-]*[A-Za-z0-9_]$'
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'IDENTITY_MIGRATION_BLOCKED: existing usernames must satisfy the 3-24 character Safir format';
  end if;
end;
$$;

drop trigger if exists profiles_protect_fields on public.user_profiles;
drop function if exists public.protect_profile_fields();
drop index if exists public.profiles_username_lower_key;

alter table public.user_profiles
  drop constraint if exists profiles_username_key,
  drop constraint if exists profiles_username_format,
  drop constraint if exists profiles_display_name_length,
  drop constraint if exists profiles_bio_length;

alter table public.user_profiles rename column avatar_path to avatar_url;

alter table public.user_profiles
  alter column username type varchar(24),
  alter column display_name type varchar(50),
  alter column role drop default,
  alter column role type public.app_role using (
    case role::text
      when 'moderator' then 'MODERATOR'::public.app_role
      when 'admin' then 'ADMINISTRATOR'::public.app_role
      else 'USER'::public.app_role
    end
  ),
  alter column role set default 'USER'::public.app_role,
  add column normalized_username varchar(24),
  add column email text,
  add column status public.account_status not null default 'ACTIVE',
  add column suspended_until timestamptz,
  add column last_login_at timestamptz;

update public.user_profiles profile
set
  normalized_username = lower(profile.username),
  email = auth_user.email
from auth.users auth_user
where auth_user.id = profile.id;

do $$
begin
  if exists (
    select 1 from public.user_profiles
    where normalized_username is null or email is null
  ) then
    raise exception using
      errcode = 'not_null_violation',
      message = 'IDENTITY_MIGRATION_BLOCKED: every existing profile must reference an Auth user with an email';
  end if;
end;
$$;

alter table public.user_profiles
  alter column normalized_username set not null,
  alter column email set not null,
  add constraint user_profiles_username_format check (
    char_length(username) between 3 and 24
    and username ~ '^[A-Za-z0-9_][A-Za-z0-9_-]*[A-Za-z0-9_]$'
  ),
  add constraint user_profiles_username_normalized check (normalized_username = lower(username)),
  add constraint user_profiles_display_name_length check (
    display_name is null or char_length(display_name) <= 50
  ),
  add constraint user_profiles_bio_length check (bio is null or char_length(bio) <= 500),
  add constraint user_profiles_suspension_consistency check (
    status = 'SUSPENDED' or suspended_until is null
  );

create unique index user_profiles_normalized_username_key
  on public.user_profiles (normalized_username);
create unique index user_profiles_email_lower_key on public.user_profiles (lower(email));
create index user_profiles_role_idx on public.user_profiles (role);
create index user_profiles_status_idx on public.user_profiles (status);
create index user_profiles_created_at_idx on public.user_profiles (created_at desc);

create or replace function public.normalize_user_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.username := btrim(new.username);
  if char_length(new.username) not between 3 and 24
    or new.username !~ '^[A-Za-z0-9_][A-Za-z0-9_-]*[A-Za-z0-9_]$'
  then
    raise exception using
      errcode = 'check_violation',
      message = 'USERNAME_INVALID: username must contain 3-24 letters, digits, underscores or hyphens and cannot start or end with a hyphen';
  end if;
  new.normalized_username := lower(new.username);
  return new;
end;
$$;

create trigger user_profiles_normalize
before insert or update of username on public.user_profiles
for each row execute function public.normalize_user_profile();

create or replace function public.protect_user_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.id and auth.role() = 'authenticated' then
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
    new.status := old.status;
    new.suspended_until := old.suspended_until;
    new.created_at := old.created_at;
    new.last_login_at := old.last_login_at;
  end if;
  return new;
end;
$$;

create trigger user_profiles_protect_fields
before update on public.user_profiles
for each row execute function public.protect_user_profile_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if new.email is null then
    raise exception using
      errcode = 'not_null_violation',
      message = 'EMAIL_REQUIRED: an email address is required';
  end if;
  if char_length(requested_username) not between 3 and 24
    or requested_username !~ '^[A-Za-z0-9_][A-Za-z0-9_-]*[A-Za-z0-9_]$'
  then
    raise exception using
      errcode = 'check_violation',
      message = 'USERNAME_INVALID: choose a valid Safir username';
  end if;

  insert into public.user_profiles (
    id,
    username,
    normalized_username,
    email,
    display_name,
    role,
    status
  ) values (
    new.id,
    requested_username,
    lower(requested_username),
    new.email,
    requested_username,
    'USER',
    'ACTIVE'
  );
  return new;
exception
  when unique_violation then
    raise exception using
      errcode = 'unique_violation',
      message = 'USERNAME_ALREADY_EXISTS: this username or email is already registered';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    if new.email is null then
      raise exception using
        errcode = 'not_null_violation',
        message = 'EMAIL_REQUIRED: Safir Pocket accounts require an email address';
    end if;
    update public.user_profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_auth_user_email();

-- Safe repair helper for Auth users created before the profile trigger. A dry run is the default.
create or replace function public.repair_missing_user_profiles(apply_changes boolean default false)
returns table (user_id uuid, username text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  requested_username text;
begin
  for candidate in
    select auth_user.id, auth_user.email, auth_user.raw_user_meta_data
    from auth.users auth_user
    left join public.user_profiles profile on profile.id = auth_user.id
    where profile.id is null
    order by auth_user.created_at
  loop
    requested_username := btrim(coalesce(candidate.raw_user_meta_data ->> 'username', ''));
    user_id := candidate.id;
    username := requested_username;
    if candidate.email is null then
      outcome := 'SKIPPED_EMAIL_MISSING';
    elsif char_length(requested_username) not between 3 and 24
      or requested_username !~ '^[A-Za-z0-9_][A-Za-z0-9_-]*[A-Za-z0-9_]$'
    then
      outcome := 'SKIPPED_USERNAME_INVALID';
    elsif exists (
      select 1 from public.user_profiles
      where normalized_username = lower(requested_username) or lower(email) = lower(candidate.email)
    ) then
      outcome := 'SKIPPED_IDENTITY_CONFLICT';
    elsif apply_changes then
      insert into public.user_profiles (
        id, username, normalized_username, email, display_name, role, status
      ) values (
        candidate.id,
        requested_username,
        lower(requested_username),
        candidate.email,
        requested_username,
        'USER',
        'ACTIVE'
      );
      outcome := 'CREATED';
    else
      outcome := 'READY';
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function public.repair_missing_user_profiles(boolean) from public, anon, authenticated;
grant execute on function public.repair_missing_user_profiles(boolean) to service_role;

create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid()
      and role in ('MODERATOR', 'ADMINISTRATOR')
      and status = 'ACTIVE'
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
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'ADMINISTRATOR' and status = 'ACTIVE'
  );
$$;

create table public.user_moderation_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  target_user_id uuid not null references public.user_profiles(id) on delete restrict,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  action public.moderation_action not null,
  previous_status public.account_status,
  new_status public.account_status,
  previous_role public.app_role,
  new_role public.app_role,
  reason text not null,
  internal_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moderation_reason_length check (char_length(reason) between 3 and 500),
  constraint moderation_note_length check (internal_note is null or char_length(internal_note) <= 2000)
);
create index moderation_target_created_idx
  on public.user_moderation_actions (target_user_id, created_at desc);
create index moderation_actor_created_idx
  on public.user_moderation_actions (actor_user_id, created_at desc);

create table public.admin_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now(),
  constraint admin_audit_entity_type_length check (char_length(entity_type) between 1 and 80),
  constraint admin_audit_action_length check (char_length(action) between 1 and 100),
  constraint admin_audit_request_id_length check (request_id is null or char_length(request_id) <= 128)
);
create index admin_audit_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_actor_idx on public.admin_audit_logs (actor_user_id, created_at desc);
create index admin_audit_entity_idx on public.admin_audit_logs (entity_type, entity_id, created_at desc);

create table public.card_rarities (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(80) not null,
  slug varchar(100) not null unique,
  description text,
  display_color varchar(7),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint card_rarities_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint card_rarities_color_format check (
    display_color is null or display_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);
create unique index card_rarities_name_lower_key on public.card_rarities (lower(name));
create index card_rarities_active_sort_idx on public.card_rarities (is_active, sort_order, name);

create table public.card_seasons (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(100) not null,
  slug varchar(120) not null unique,
  code varchar(24),
  description text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint card_seasons_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint card_seasons_dates_valid check (
    end_date is null or start_date is null or end_date > start_date
  )
);
create unique index card_seasons_code_lower_key on public.card_seasons (lower(code)) where code is not null;
create index card_seasons_active_sort_idx on public.card_seasons (is_active, sort_order, name);

create table public.card_types (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(80) not null,
  slug varchar(100) not null unique,
  description text,
  display_color varchar(7),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint card_types_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint card_types_color_format check (
    display_color is null or display_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);
create unique index card_types_name_lower_key on public.card_types (lower(name));
create index card_types_active_sort_idx on public.card_types (is_active, sort_order, name);

-- Existing sets become card seasons with the same UUID. Ranked seasons remain independent.
insert into public.card_seasons (
  id, name, slug, code, description, start_date, is_active, sort_order, created_at, updated_at
)
select
  id,
  name,
  slug,
  code,
  description,
  release_date,
  status <> 'archived',
  display_order,
  created_at,
  updated_at
from public.card_sets;

with source as (
  select distinct on (lower(btrim(rarity)))
    btrim(rarity) as name,
    lower(btrim(rarity)) as normalized_name,
    trim(both '-' from regexp_replace(lower(btrim(rarity)), '[^a-z0-9]+', '-', 'g')) as base_slug
  from public.cards
  order by lower(btrim(rarity)), btrim(rarity)
), ranked as (
  select *, row_number() over (partition by base_slug order by normalized_name) as slug_rank
  from source
)
insert into public.card_rarities (name, slug, sort_order)
select
  name,
  case
    when base_slug = '' then 'rarity-' || substr(md5(normalized_name), 1, 8)
    when slug_rank = 1 then base_slug
    else base_slug || '-' || substr(md5(normalized_name), 1, 8)
  end,
  row_number() over (order by name)::integer
from ranked;

with source as (
  select distinct on (lower(btrim(card_type)))
    btrim(card_type) as name,
    lower(btrim(card_type)) as normalized_name,
    trim(both '-' from regexp_replace(lower(btrim(card_type)), '[^a-z0-9]+', '-', 'g')) as base_slug
  from public.cards
  order by lower(btrim(card_type)), btrim(card_type)
), ranked as (
  select *, row_number() over (partition by base_slug order by normalized_name) as slug_rank
  from source
)
insert into public.card_types (name, slug, sort_order)
select
  name,
  case
    when base_slug = '' then 'type-' || substr(md5(normalized_name), 1, 8)
    when slug_rank = 1 then base_slug
    else base_slug || '-' || substr(md5(normalized_name), 1, 8)
  end,
  row_number() over (order by name)::integer
from ranked;

create table public.catalog_migration_issues (
  id uuid primary key default extensions.gen_random_uuid(),
  migration_name text not null,
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  source_value text,
  issue_code text not null,
  created_at timestamptz not null default now()
);

insert into public.catalog_migration_issues (
  migration_name, entity_type, entity_id, field_name, source_value, issue_code
)
select
  '20260717200000_identity_moderation_admin_catalog',
  'CARD',
  card.id,
  'collection_number',
  card.collection_number,
  case
    when card.collection_number !~ '^[0-9]{1,18}$' then 'NON_NUMERIC_CARD_NUMBER'
    else 'DUPLICATE_NUMERIC_CARD_NUMBER'
  end
from public.cards card
where card.collection_number !~ '^[0-9]{1,18}$'
  or exists (
    select 1
    from public.cards duplicate
    where duplicate.set_id = card.set_id
      and duplicate.id <> card.id
      and duplicate.collection_number ~ '^[0-9]{1,18}$'
      and card.collection_number ~ '^[0-9]{1,18}$'
      and duplicate.collection_number::bigint = card.collection_number::bigint
  );

alter table public.cards
  alter column set_id drop not null,
  add column number bigint,
  add column attack bigint not null default 0,
  add column defense bigint not null default 0,
  add column value bigint not null default 0,
  add column image_url text,
  add column is_commander boolean not null default false,
  add column rarity_id uuid references public.card_rarities(id) on delete restrict,
  add column season_id uuid references public.card_seasons(id) on delete restrict,
  add column is_active boolean not null default true,
  add column deleted_at timestamptz;

with parsed as (
  select
    card.id,
    card.set_id,
    case
      when card.collection_number ~ '^[0-9]{1,18}$' then card.collection_number::bigint
      else null
    end as parsed_number
  from public.cards card
), numbered as (
  select
    id,
    parsed_number,
    count(*) over (partition by set_id, parsed_number) as duplicate_count,
    coalesce(max(parsed_number) over (partition by set_id), 0) as max_number,
    row_number() over (partition by set_id order by id) as fallback_rank
  from parsed
)
update public.cards card
set number = case
  when numbered.parsed_number is not null and numbered.duplicate_count = 1
    then numbered.parsed_number
  else numbered.max_number + numbered.fallback_rank
end
from numbered
where numbered.id = card.id;

update public.cards card
set
  season_id = card.set_id,
  rarity_id = rarity.id,
  attack = case
    when coalesce(card.stats ->> 'attack', card.stats ->> 'power', '') ~ '^[0-9]+$'
      then coalesce(card.stats ->> 'attack', card.stats ->> 'power')::bigint
    else 0
  end,
  defense = case
    when coalesce(card.stats ->> 'defense', '') ~ '^[0-9]+$'
      then (card.stats ->> 'defense')::bigint
    else 0
  end,
  value = coalesce(card.cost, 0),
  image_url = case when card.artwork_path ~ '^https://' then card.artwork_path else null end,
  is_commander = case
    when lower(coalesce(card.metadata ->> 'isCommander', '')) in ('true', 'false')
      then (card.metadata ->> 'isCommander')::boolean
    else false
  end,
  is_active = card.status = 'published',
  deleted_at = case when card.status = 'archived' then card.updated_at else null end
from public.card_rarities rarity
where lower(rarity.name) = lower(btrim(card.rarity));

alter table public.cards
  alter column number set not null,
  alter column rarity_id set not null,
  alter column season_id set not null,
  add constraint cards_number_nonnegative check (number >= 0),
  add constraint cards_attack_nonnegative check (attack >= 0),
  add constraint cards_defense_nonnegative check (defense >= 0),
  add constraint cards_value_nonnegative check (value >= 0),
  add constraint cards_description_length check (
    description is null or char_length(description) <= 5000
  ),
  add constraint cards_image_url_https check (image_url is null or image_url ~ '^https://'),
  add constraint cards_season_number_key unique (season_id, number);

create index cards_admin_catalog_idx
  on public.cards (deleted_at, is_active, season_id, rarity_id, updated_at desc);

create table public.card_type_links (
  card_id uuid not null references public.cards(id) on delete cascade,
  type_id uuid not null references public.card_types(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (card_id, type_id)
);
create index card_type_links_type_idx on public.card_type_links (type_id, card_id);

insert into public.card_type_links (card_id, type_id, sort_order)
select card.id, card_type.id, 0
from public.cards card
join public.card_types card_type on lower(card_type.name) = lower(btrim(card.card_type));

create trigger card_rarities_set_updated_at
before update on public.card_rarities
for each row execute function public.set_updated_at();
create trigger card_seasons_set_updated_at
before update on public.card_seasons
for each row execute function public.set_updated_at();
create trigger card_types_set_updated_at
before update on public.card_types
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.user_moderation_actions enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.card_rarities enable row level security;
alter table public.card_seasons enable row level security;
alter table public.card_types enable row level security;
alter table public.card_type_links enable row level security;
alter table public.catalog_migration_issues enable row level security;

drop policy if exists profiles_public_read on public.user_profiles;
drop policy if exists profiles_owner_update on public.user_profiles;
create policy user_profiles_owner_read on public.user_profiles for select to authenticated
  using (id = auth.uid());
create policy user_profiles_owner_update on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists cards_published_read on public.cards;
create policy cards_published_read on public.cards for select
  using (
    (status = 'published' and is_active and deleted_at is null)
    or public.is_privileged()
  );
create policy card_rarities_public_read on public.card_rarities for select
  using ((is_active and deleted_at is null) or public.is_privileged());
create policy card_seasons_public_read on public.card_seasons for select
  using ((is_active and deleted_at is null) or public.is_privileged());
create policy card_types_public_read on public.card_types for select
  using ((is_active and deleted_at is null) or public.is_privileged());
create policy card_type_links_public_read on public.card_type_links for select
  using (exists (
    select 1 from public.cards
    where cards.id = card_type_links.card_id
      and ((cards.status = 'published' and cards.is_active and cards.deleted_at is null)
        or public.is_privileged())
  ));

revoke all on public.user_profiles from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (username, display_name, avatar_url, bio) on public.user_profiles to authenticated;

revoke all on public.user_moderation_actions, public.admin_audit_logs,
  public.catalog_migration_issues from anon, authenticated;
revoke insert, update, delete on public.card_rarities, public.card_seasons,
  public.card_types, public.card_type_links from anon, authenticated;
grant select on public.card_rarities, public.card_seasons, public.card_types,
  public.card_type_links to anon, authenticated;

commit;
