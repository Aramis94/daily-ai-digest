-- Egyszer kell lefuttatni a Supabase SQL szerkesztőben.
-- Bekapcsolja, hogy egy felhasználó csak a saját profiles és daily_digests sorait lássa, írja és törölje.
-- A napi cron a service role kulccsal fut, az ezeket a szabályokat megkerüli.
-- Own-row access for the app. Service role (cron) bypasses RLS.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Ezt nem hívja a weboldal. Kézzel kell lefuttatni a Supabase SQL szerkesztőben.

-- Saját profil olvasása, létrehozása és módosítása.
alter table public.profiles enable row level security;
alter table public.daily_digests enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Saját digest olvasása, beszúrása és módosítása.
drop policy if exists "digests_select_own" on public.daily_digests;
create policy "digests_select_own" on public.daily_digests
  for select using (auth.uid() = user_id);

drop policy if exists "digests_insert_own" on public.daily_digests;
create policy "digests_insert_own" on public.daily_digests
  for insert with check (auth.uid() = user_id);

drop policy if exists "digests_update_own" on public.daily_digests;
create policy "digests_update_own" on public.daily_digests
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
