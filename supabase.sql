-- Run once in your own Supabase SQL Editor. Never put a service_role key in the app.
create table if not exists public.handwrite_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint handwrite_payload_size check (octet_length(payload::text) <= 31457280)
);
alter table public.handwrite_backups enable row level security;
create policy "Owners read their backup" on public.handwrite_backups for select to authenticated using (auth.uid() = user_id);
create policy "Owners insert their backup" on public.handwrite_backups for insert to authenticated with check (auth.uid() = user_id);
create policy "Owners update their backup" on public.handwrite_backups for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.handwrite_backups to authenticated;
