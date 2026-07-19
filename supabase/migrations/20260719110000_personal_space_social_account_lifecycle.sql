-- Personal space, privacy, social graph and voluntary account lifecycle.
-- Existing users and application data are preserved; preferences are backfilled idempotently.

begin;

create type public.profile_visibility as enum ('PUBLIC', 'PRIVATE');
create type public.friend_request_status as enum (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED'
);

alter table public.user_profiles
  add column username_changed_at timestamptz,
  add column is_deactivated boolean not null default false,
  add column deactivated_at timestamptz,
  add column deletion_requested_at timestamptz,
  add column deletion_scheduled_for timestamptz,
  add column deletion_cancelled_at timestamptz,
  add column deletion_processed_at timestamptz,
  add column deletion_reason text,
  add constraint user_profiles_deactivation_consistency check (
    (is_deactivated and deactivated_at is not null)
    or (not is_deactivated and deactivated_at is null)
  ),
  add constraint user_profiles_deletion_schedule_consistency check (
    deletion_requested_at is null
    or (
      deletion_scheduled_for is not null
      and deletion_scheduled_for >= deletion_requested_at
    )
  ),
  add constraint user_profiles_deletion_reason_length check (
    deletion_reason is null or char_length(deletion_reason) <= 500
  );

-- Final deletion retains a pseudonymous application row for integrity-sensitive histories.
-- New Auth users are still linked through the on_auth_user_created trigger.
alter table public.user_profiles drop constraint if exists profiles_id_fkey;

create index user_profiles_discovery_idx
  on public.user_profiles (is_deactivated, status, normalized_username);
create index user_profiles_due_deletion_idx
  on public.user_profiles (deletion_scheduled_for)
  where deletion_requested_at is not null
    and deletion_cancelled_at is null
    and deletion_processed_at is null;

create table public.user_preferences (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  profile_visibility public.profile_visibility not null default 'PUBLIC',
  allow_friend_requests boolean not null default true,
  appear_in_user_search boolean not null default true,
  show_online_status boolean not null default false,
  show_collection_stats boolean not null default true,
  show_game_stats boolean not null default true,
  email_notifications boolean not null default true,
  friend_request_notifications boolean not null default true,
  friend_acceptance_notifications boolean not null default true,
  game_invite_notifications boolean not null default true,
  game_news_notifications boolean not null default true,
  marketing_emails boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.user_profiles(id) on delete cascade,
  receiver_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status public.friend_request_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (sender_user_id <> receiver_user_id),
  constraint friend_requests_response_consistency check (
    (status = 'PENDING' and responded_at is null)
    or (status <> 'PENDING' and responded_at is not null)
  )
);

create unique index friend_requests_pending_pair_key
  on public.friend_requests (
    least(sender_user_id, receiver_user_id),
    greatest(sender_user_id, receiver_user_id)
  )
  where status = 'PENDING';
create index friend_requests_receiver_status_idx
  on public.friend_requests (receiver_user_id, status, created_at desc);
create index friend_requests_sender_status_idx
  on public.friend_requests (sender_user_id, status, created_at desc);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references public.user_profiles(id) on delete cascade,
  user_two_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_canonical_order check (user_one_id < user_two_id),
  constraint friendships_pair_key unique (user_one_id, user_two_id)
);

create index friendships_user_one_idx on public.friendships (user_one_id, created_at desc);
create index friendships_user_two_idx on public.friendships (user_two_id, created_at desc);

create table public.user_blocks (
  blocker_user_id uuid not null references public.user_profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_no_self check (blocker_user_id <> blocked_user_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_user_id, created_at desc);

create table public.user_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint user_security_events_type_length check (
    char_length(event_type) between 3 and 80
  ),
  constraint user_security_events_ip_hash_length check (
    ip_hash is null or char_length(ip_hash) <= 128
  ),
  constraint user_security_events_user_agent_length check (
    user_agent is null or char_length(user_agent) <= 500
  )
);

create index user_security_events_user_created_idx
  on public.user_security_events (user_id, created_at desc);
create index user_security_events_type_created_idx
  on public.user_security_events (event_type, created_at desc);

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create trigger friend_requests_set_updated_at
before update on public.friend_requests
for each row execute function public.set_updated_at();

insert into public.user_preferences (user_id)
select id from public.user_profiles
on conflict (user_id) do nothing;

create or replace function public.ensure_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger user_profiles_create_preferences
after insert on public.user_profiles
for each row execute function public.ensure_user_preferences();

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
    new.must_change_password := old.must_change_password;
    new.username_changed_at := old.username_changed_at;
    new.is_deactivated := old.is_deactivated;
    new.deactivated_at := old.deactivated_at;
    new.deletion_requested_at := old.deletion_requested_at;
    new.deletion_scheduled_for := old.deletion_scheduled_for;
    new.deletion_cancelled_at := old.deletion_cancelled_at;
    new.deletion_processed_at := old.deletion_processed_at;
    new.deletion_reason := old.deletion_reason;
    new.created_at := old.created_at;
    new.last_login_at := old.last_login_at;
  end if;
  return new;
end;
$$;

alter table public.user_preferences enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_security_events enable row level security;

create policy user_preferences_owner_read on public.user_preferences
for select to authenticated using (user_id = auth.uid());
create policy user_preferences_owner_update on public.user_preferences
for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy friend_requests_participant_read on public.friend_requests
for select to authenticated
using (sender_user_id = auth.uid() or receiver_user_id = auth.uid());

create policy friendships_participant_read on public.friendships
for select to authenticated
using (user_one_id = auth.uid() or user_two_id = auth.uid());

create policy user_blocks_owner_read on public.user_blocks
for select to authenticated using (blocker_user_id = auth.uid());

create policy user_security_events_owner_read on public.user_security_events
for select to authenticated using (user_id = auth.uid());

revoke all on public.user_preferences, public.friend_requests, public.friendships,
  public.user_blocks, public.user_security_events from anon, authenticated;
grant select, update on public.user_preferences to authenticated;
grant select on public.friend_requests, public.friendships, public.user_blocks,
  public.user_security_events to authenticated;

-- Profile changes are authoritative through NestJS so username cooldown and lifecycle rules
-- cannot be bypassed through the public PostgREST connection.
revoke update on public.user_profiles from authenticated;

comment on table public.user_preferences is
  'Server-backed privacy and notification choices. Mandatory security messages are not optional.';
comment on column public.user_profiles.is_deactivated is
  'Voluntary deactivation, independent from administrative suspension or ban.';
comment on column public.user_profiles.deletion_scheduled_for is
  'End of the account deletion grace period; final processing is performed by a secured server job.';
comment on table public.user_security_events is
  'Security audit without passwords, tokens, raw IP addresses or other secrets.';

commit;
