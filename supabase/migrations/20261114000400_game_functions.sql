-- 4/4  Game logic. Everything is validated here, so the browser can't cheat:
-- turn order, empty cells, winners, resigns, timeouts, and stats.

-- ---------- helpers ----------

-- Returns the winning cells (0-based) or null.
create or replace function public.ttt_winning_line(p_board text)
returns smallint[]
language plpgsql
immutable
as $$
declare
  v_lines int[] := array[
    1,2,3, 4,5,6, 7,8,9,
    1,4,7, 2,5,8, 3,6,9,
    1,5,9, 3,5,7
  ];
  i int;
  a int; b int; c int;
begin
  for i in 0..7 loop
    a := v_lines[i * 3 + 1];
    b := v_lines[i * 3 + 2];
    c := v_lines[i * 3 + 3];
    if substr(p_board, a, 1) <> '-'
       and substr(p_board, a, 1) = substr(p_board, b, 1)
       and substr(p_board, b, 1) = substr(p_board, c, 1) then
      return array[a - 1, b - 1, c - 1]::smallint[];
    end if;
  end loop;
  return null;
end;
$$;

-- Ends a game and updates both players' stats exactly once. Internal only.
create or replace function public.finish_game(
  p_game_id uuid,
  p_winner  text,
  p_reason  text,
  p_line    smallint[]
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g        public.games;
  v_winner uuid;
  v_loser  uuid;
begin
  update public.games
     set status = 'finished',
         winner = p_winner,
         end_reason = p_reason,
         winning_line = p_line,
         updated_at = now(),
         last_move_at = now()
   where id = p_game_id and status = 'active'
   returning * into g;

  if not found then
    raise exception 'game_not_active' using errcode = 'P0001';
  end if;

  if p_winner = 'draw' then
    update public.player_stats
       set draws = draws + 1, points = points + 1, updated_at = now()
     where user_id in (g.x_player, g.o_player);
  else
    v_winner := case when p_winner = 'X' then g.x_player else g.o_player end;
    v_loser  := case when p_winner = 'X' then g.o_player else g.x_player end;

    update public.player_stats
       set wins = wins + 1, points = points + 3, updated_at = now()
     where user_id = v_winner;

    update public.player_stats
       set losses = losses + 1, updated_at = now()
     where user_id = v_loser;
  end if;

  return g;
end;
$$;

revoke all on function public.finish_game(uuid, text, text, smallint[]) from public, anon, authenticated;

-- ---------- matchmaking ----------

-- Returns the caller's current game if they have one, otherwise joins the oldest
-- waiting game, otherwise creates a new waiting game (caller plays X).
create or replace function public.find_or_create_game()
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g     public.games;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- one matchmaking call per user at a time
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  -- drop abandoned lobbies
  delete from public.games
   where status = 'waiting' and created_at < now() - interval '5 minutes';

  select * into g
    from public.games
   where status in ('waiting', 'active')
     and v_uid in (x_player, o_player)
   order by created_at desc
   limit 1;
  if found then
    return g;
  end if;

  select * into g
    from public.games
   where status = 'waiting' and x_player <> v_uid
   order by created_at
   limit 1
   for update skip locked;

  if found then
    update public.games
       set o_player = v_uid,
           status = 'active',
           last_move_at = now(),
           updated_at = now()
     where id = g.id
     returning * into g;
    return g;
  end if;

  insert into public.games (x_player) values (v_uid) returning * into g;
  return g;
end;
$$;

create or replace function public.cancel_waiting_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.games
   where id = p_game_id
     and x_player = auth.uid()
     and status = 'waiting';
end;
$$;

-- ---------- moves ----------

create or replace function public.make_move(p_game_id uuid, p_cell integer)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  g       public.games;
  v_mark  text;
  v_board text;
  v_line  smallint[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found or v_uid not in (g.x_player, coalesce(g.o_player, g.x_player)) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if g.status <> 'active' then
    raise exception 'game_not_active' using errcode = 'P0001';
  end if;

  v_mark := case when v_uid = g.x_player then 'X' else 'O' end;
  if v_mark <> g.turn then
    raise exception 'not_your_turn' using errcode = 'P0001';
  end if;
  if p_cell is null or p_cell < 0 or p_cell > 8 then
    raise exception 'invalid_cell' using errcode = 'P0001';
  end if;
  if substr(g.board, p_cell + 1, 1) <> '-' then
    raise exception 'cell_taken' using errcode = 'P0001';
  end if;

  v_board := overlay(g.board placing v_mark from p_cell + 1 for 1);
  v_line  := public.ttt_winning_line(v_board);

  update public.games
     set board = v_board,
         turn = case when v_mark = 'X' then 'O' else 'X' end,
         last_move_at = now(),
         updated_at = now()
   where id = g.id
   returning * into g;

  if v_line is not null then
    return public.finish_game(g.id, v_mark, 'line', v_line);
  elsif position('-' in v_board) = 0 then
    return public.finish_game(g.id, 'draw', 'full', null);
  end if;

  return g;
end;
$$;

-- ---------- leaving a game ----------

create or replace function public.resign_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  g      public.games;
  v_mark text;
begin
  select * into g from public.games where id = p_game_id for update;
  if not found or v_uid not in (g.x_player, coalesce(g.o_player, g.x_player)) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if g.status <> 'active' then
    raise exception 'game_not_active' using errcode = 'P0001';
  end if;

  v_mark := case when v_uid = g.x_player then 'X' else 'O' end;
  return public.finish_game(g.id, case when v_mark = 'X' then 'O' else 'X' end, 'resign', null);
end;
$$;

-- The player who is waiting can claim the win if the opponent hasn't moved for 60 seconds.
create or replace function public.claim_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  g      public.games;
  v_mark text;
begin
  select * into g from public.games where id = p_game_id for update;
  if not found or v_uid not in (g.x_player, coalesce(g.o_player, g.x_player)) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if g.status <> 'active' then
    raise exception 'game_not_active' using errcode = 'P0001';
  end if;

  v_mark := case when v_uid = g.x_player then 'X' else 'O' end;
  if v_mark = g.turn then
    raise exception 'not_waiting_for_opponent' using errcode = 'P0001';
  end if;
  if now() - g.last_move_at < interval '60 seconds' then
    raise exception 'too_early' using errcode = 'P0001';
  end if;

  return public.finish_game(g.id, v_mark, 'timeout', null);
end;
$$;

-- ---------- permissions ----------
-- Supabase grants EXECUTE to anon by default; lock the game functions to signed-in users.

revoke all on function public.find_or_create_game()          from public, anon;
revoke all on function public.cancel_waiting_game(uuid)      from public, anon;
revoke all on function public.make_move(uuid, integer)       from public, anon;
revoke all on function public.resign_game(uuid)              from public, anon;
revoke all on function public.claim_timeout(uuid)            from public, anon;

grant execute on function public.find_or_create_game()       to authenticated;
grant execute on function public.cancel_waiting_game(uuid)   to authenticated;
grant execute on function public.make_move(uuid, integer)    to authenticated;
grant execute on function public.resign_game(uuid)           to authenticated;
grant execute on function public.claim_timeout(uuid)         to authenticated;