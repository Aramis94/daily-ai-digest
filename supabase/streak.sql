-- Napi szokás. Egyszer futtasd a Supabase SQL szerkesztőben.
-- A user csak a saját sorát látja. A cron a service role kulccsal megkerüli ezt.

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  did_view_digest boolean not null default false,
  did_complete_lesson boolean not null default false,
  frozen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

alter table public.user_activity enable row level security;

drop policy if exists "activity_select_own" on public.user_activity;
create policy "activity_select_own" on public.user_activity
  for select using (auth.uid() = user_id);

drop policy if exists "activity_insert_own" on public.user_activity;
create policy "activity_insert_own" on public.user_activity
  for insert with check (auth.uid() = user_id);

drop policy if exists "activity_update_own" on public.user_activity;
create policy "activity_update_own" on public.user_activity
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
