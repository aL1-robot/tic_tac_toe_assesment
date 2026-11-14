# Tic Tide Tac Toe

Classic tic-tac-toe with a beach-and-tide look. X always starts, three in a row wins, and a full board with no line is a draw. Choose same-screen two-player, an easy bot, a perfect-play hard bot, or online matchmaking.

## Local setup

Requirements: Node.js 20.9+ and Docker (for the local Supabase stack).

```sh
npm install
cp .env.example .env.local
supabase start
```

Copy the local API URL and anon key printed by `supabase status` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `NEXT_PUBLIC_ACCOUNT_EMAIL_DOMAIN` to a domain you control (for example, `accounts.example.com`); it is used only to create synthetic sign-in addresses, and no mail is sent.

Apply the migrations and run the app:

```sh
supabase db reset
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app uses the local database migrations in `supabase/migrations/`; reset recreates the local database and applies them in order.

## Supabase Auth settings

In the Supabase project’s **Authentication** settings:

- Email confirmations: **off**
- Allow new users to sign up: **on**
- Minimum password length: **6**

Accounts are presented as username and password. Internally, the app lowercases the username and forms `<username>@<NEXT_PUBLIC_ACCOUNT_EMAIL_DOMAIN>`. The domain must be controlled by the project owner. The browser only uses the public anon key; never put a service-role key in client code or `NEXT_PUBLIC_*` variables.

## Deploy

Create a hosted Supabase project and a Vercel project for this repository. Set the three environment variables in Vercel to the hosted Supabase URL, anon key, and owner-controlled synthetic-email domain. Configure the Auth settings above, then apply the schema to the hosted project:

```sh
supabase link --project-ref <project-ref>
supabase db push
```

Deploy the Next.js app from Vercel. For a hosted database, generate updated TypeScript definitions after schema changes with:

```sh
supabase gen types typescript --linked > lib/supabase/database.types.ts
```

The checked-in definitions cover the four migrations in this repository.

## Architecture

The App Router page is a thin server component. Its client game UI owns local rounds, bot turns, dialogs, and the shared beach-themed board. Pure rules and both bot strategies are in `lib/game/`, independent of React and Supabase. Local and bot rounds never call game RPCs or write online statistics.

Supabase Auth uses `@supabase/ssr` cookie sessions, refreshed in the Next.js 16 `proxy.ts`. The database creates profiles on signup. Online matchmaking, moves, resignation, timeout claims, and cancellations go through the security-definer RPCs; the client subscribes to the matched game row for updates. The public lobby uses Supabase Realtime Presence (no player-count table). The leaderboard reads the database view and refreshes on `player_stats` changes.

The selected mode is retained per browser tab so an online match can resume after a reload; accounts and scores are never stored in browser storage.

Run the project checks with `npm run lint`, `npm run typecheck`, and `npm test`. To regenerate the schema definitions for the local stack, run `supabase gen types typescript --local > lib/supabase/database.types.ts`.

## Known limits

- Two accounts controlled by the same person can farm points; there is no anti-collusion yet.
- Abandoned active games stay open until a player resigns or claims a timeout.
