-- User profiles + signup trigger.
--
-- The original Bleek-Lloyd prod set up `profiles` and `handle_new_user()`
-- out-of-band (no migration ever created them), so every later migration
-- that references them — the persona_config admin-write policy, the
-- harden_functions revoke — assumed they already existed. This migration
-- creates them properly so the chain is reproducible on a fresh project.
--
-- `profiles` is the per-user row keyed to auth.users; `is_admin` gates the
-- /admin persona editor (the only authenticated-write surface). A trigger
-- on auth.users creates the row automatically at signup.

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: a user may read and update only their own row. No policy grants a
-- way to set is_admin from the client — it is server/dashboard-only — so a
-- user cannot escalate themselves to admin. The edge functions read via the
-- service-role key, which bypasses RLS.
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- Signup trigger: create a profiles row for every new auth user. SECURITY
-- DEFINER so it can write past RLS; search_path pinned to public so the
-- unqualified table reference can't be hijacked. EXECUTE is revoked from
-- the API roles (harden_functions) — the trigger still fires regardless,
-- since trigger execution doesn't check the caller's EXECUTE privilege.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
