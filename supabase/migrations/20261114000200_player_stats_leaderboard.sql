-- 2/4  Stats + leaderboard. Only online games change these numbers, and only the
-- database functions in migration 4 can write them (no client insert/update policies).

create table public.player_stats (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  wins        integer not null default 0 check (wins >= 0),
  losses      integer not null default 0 check (losses >= 0),
  draws       integer not null default 0 check (draws >= 0),
  points      integer not null default 0 check (points >= 0),   -- win 3, draw 1, loss 0
  updated_at  timestamptz not null default now()
);

create index player_stats_rank_idx on public.player_stats (points desc, wins desc);

alter table public.player_stats enable row level security;

create policy "stats are readable by everyone"
  on public.player_stats for select
  to anon, authenticated
  using (true);

-- Every new profile gets a zeroed stats row.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Top 100 players who have played at least one online game.
create or replace view public.leaderboard
with (security_invoker = true) as
select
  p.id        as user_id,
  p.username::text as username,
  s.wins,
  s.draws,
  s.losses,
  s.points,
  rank() over (order by s.points desc, s.wins desc) as rank
from public.player_stats s
join public.profiles p on p.id = s.user_id
where (s.wins + s.draws + s.losses) > 0
order by s.points desc, s.wins desc, p.username
limit 100;

grant select on public.leaderboard to anon, authenticated;

-- Live leaderboard updates in the client.
alter publication supabase_realtime add table public.player_stats;