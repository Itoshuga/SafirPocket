create table public.card_data_operations (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  operation_type text not null check (operation_type in ('IMPORT', 'EXPORT')),
  file_format text not null check (file_format in ('JSON', 'CSV')),
  import_mode text check (import_mode is null or import_mode in ('CREATE_ONLY', 'UPSERT', 'UPDATE_ONLY')),
  file_name varchar(255),
  file_hash char(64) check (file_hash is null or file_hash ~ '^[a-f0-9]{64}$'),
  total_rows integer not null default 0 check (total_rows >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  status text not null check (status in ('PREVIEWED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED')),
  error_summary jsonb not null default '[]'::jsonb check (jsonb_typeof(error_summary) = 'array'),
  preview_payload jsonb,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_data_operations_mode_check check (
    (operation_type = 'IMPORT' and import_mode is not null)
    or (operation_type = 'EXPORT' and import_mode is null)
  ),
  constraint card_data_operations_preview_check check (
    preview_payload is null or operation_type = 'IMPORT'
  )
);

create index card_data_operations_actor_idx
  on public.card_data_operations (actor_user_id, created_at desc);
create index card_data_operations_type_idx
  on public.card_data_operations (operation_type, created_at desc);
create index card_data_operations_status_idx
  on public.card_data_operations (status, created_at desc);
create index card_data_operations_created_idx
  on public.card_data_operations (created_at desc);
create index card_data_operations_preview_expiry_idx
  on public.card_data_operations (expires_at)
  where status = 'PREVIEWED';

create trigger card_data_operations_set_updated_at
before update on public.card_data_operations
for each row execute function public.set_updated_at();

alter table public.card_data_operations enable row level security;

-- Import/export payloads, hashes and reports are server-only administrative data.
revoke all on public.card_data_operations from anon, authenticated;

comment on table public.card_data_operations is
  'Server-only history for card imports/exports and short-lived import previews.';
comment on column public.card_data_operations.preview_payload is
  'Temporary normalized preview payload cleared after execution or expiration.';
