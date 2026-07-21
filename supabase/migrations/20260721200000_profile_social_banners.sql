-- User-owned social profile banners and their vertical crop position.

begin;

alter table public.user_profiles
  add column if not exists banner_url text,
  add column if not exists banner_position_y smallint not null default 50;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_banner_position_y_range'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_banner_position_y_range
      check (banner_position_y between 0 and 100);
  end if;
end
$$;

comment on column public.user_profiles.banner_url is
  'Storage path of the profile banner owned by this user.';
comment on column public.user_profiles.banner_position_y is
  'Vertical object-position percentage used to crop the profile banner.';

grant update (banner_url, banner_position_y) on public.user_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-banners',
  'profile-banners',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_banners_public_read on storage.objects;
create policy profile_banners_public_read on storage.objects for select
  using (bucket_id = 'profile-banners');

drop policy if exists profile_banners_owner_insert on storage.objects;
create policy profile_banners_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists profile_banners_owner_update on storage.objects;
create policy profile_banners_owner_update on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-banners'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-banners'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists profile_banners_owner_delete on storage.objects;
create policy profile_banners_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-banners'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
