-- Collection privacy is independent from profile privacy.
-- Existing users keep a public collection and explicit display defaults.

begin;

do $$
begin
  create type public.collection_visibility as enum ('PUBLIC', 'FRIENDS', 'PRIVATE');
exception
  when duplicate_object then null;
end
$$;

alter table public.user_preferences
  add column if not exists collection_visibility public.collection_visibility not null default 'PUBLIC',
  add column if not exists show_card_quantities boolean not null default true,
  add column if not exists show_collection_completion boolean not null default true;

comment on column public.user_preferences.collection_visibility is
  'Audience allowed to browse the user collection through the authoritative API.';
comment on column public.user_preferences.show_card_quantities is
  'Allows authorized visitors to see exact card quantities; locked quantities remain private.';
comment on column public.user_preferences.show_collection_completion is
  'Allows authorized visitors to see global collection completion.';

commit;
