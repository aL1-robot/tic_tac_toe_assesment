-- 3/4  Online games. Clients can only READ their own games; every change goes
-- through the functions in migration 4.

create type public.game_status as enum ('waiting', 'active', 'finished');

create table public.games (
  id            uuid primary key default gen_random_uuid(),
  x_player      uuid not null references public.profiles (id) on delete cascade,
  o_player      uuid references public.profiles (id) on delete cascade,
  -- 9 characters, cells 0..8 left-to-right, top-to-bottom: 'X', 'O' or '-'
  board         text not null default '---------' check (board ~ '^[XO-]{9}$'),
  turn          text not null default 'X' check (turn in ('X', 'O')),
  status        public.game_status not null default 'waiting',
  winner        text check (winner in ('X', 'O', 'draw')),
  winning_line  smallint[],
  end_reason    text check (end_reason in ('line', 'full', 'resign', 'timeout')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_move_at  timestamptz not null default now(),
  constraint different_players check (o_player is null or o_player <> x_player)
);

create index games_waiting_idx on public.games (created_at) where status = 'waiting';
create index games_x_player_idx on public.games (x_player);
create index games_o_player_idx on public.games (o_player);

alter table public.games enable row level security;

-- Players see only their own games. No insert/update/delete policies on purpose.
create policy "players can read their own games"
  on public.games for select
  to authenticated
  using (auth.uid() = x_player or auth.uid() = o_player);

-- Realtime: both players get board updates as they happen.
alter publication supabase_realtime add table public.games;