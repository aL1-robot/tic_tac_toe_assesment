-- 1/4  Profiles: one row per account, holds the public username.
-- Accounts use Supabase Auth with a synthetic email (username@<your domain>),
-- so players only ever see "username + password".

create extension if not exists citext with schema extensions;

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    extensions.citext not null unique,
  created_at  timestamptz not null default now(),
  constraint username_format check (username::text ~ '^[A-Za-z0-9_-]{3,16}$')
);

alter table public.profiles enable row level security;

-- Usernames are public (leaderboard, opponent names). Nobody edits them from the client.
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Create the profile automatically when an auth user is created.
-- The client passes the username in sign-up options: { data: { username } }.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up form check a name before creating the account.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[A-Za-z0-9_-]{3,16}$'
     and not exists (
       select 1 from public.profiles
       where username = p_username::extensions.citext
     );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;