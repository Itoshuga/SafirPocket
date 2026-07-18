begin;

do $$
begin
  create type public.warning_severity as enum ('LOW', 'MEDIUM', 'HIGH');
exception
  when duplicate_object then null;
end
$$;

alter table public.user_profiles
  add column if not exists must_change_password boolean not null default false;

create unique index if not exists card_seasons_name_lower_key
  on public.card_seasons (lower(name));

create table if not exists public.user_warnings (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  issued_by_user_id uuid references public.user_profiles(id) on delete set null,
  reason text not null,
  internal_note text,
  severity public.warning_severity not null,
  is_active boolean not null default true,
  acknowledged_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_warnings_reason_length check (char_length(btrim(reason)) between 3 and 500),
  constraint user_warnings_internal_note_length check (
    internal_note is null or char_length(internal_note) <= 2000
  ),
  constraint user_warnings_revocation_consistency check (
    (is_active and revoked_at is null and revoked_by_user_id is null)
    or (not is_active and revoked_at is not null)
  )
);

create index if not exists user_warnings_user_id_idx
  on public.user_warnings (user_id);
create index if not exists user_warnings_issued_by_user_id_idx
  on public.user_warnings (issued_by_user_id);
create index if not exists user_warnings_is_active_idx
  on public.user_warnings (is_active);
create index if not exists user_warnings_created_at_idx
  on public.user_warnings (created_at desc);
create index if not exists user_warnings_user_status_created_idx
  on public.user_warnings (user_id, is_active, created_at desc);

drop trigger if exists user_warnings_set_updated_at on public.user_warnings;
create trigger user_warnings_set_updated_at
before update on public.user_warnings
for each row execute function public.set_updated_at();

alter table public.user_warnings enable row level security;
revoke all on public.user_warnings from anon, authenticated;

comment on table public.user_warnings is
  'Avertissements de modération immuables; une révocation désactive la ligne sans la supprimer.';
comment on column public.user_profiles.must_change_password is
  'Indique qu’un mot de passe temporaire a été défini par un administrateur.';

commit;
