# Collection Value Tracker

A local-first web app for tracking the value of a retro video game collection.
Browse a game catalog sourced from [TheGamesDB](https://thegamesdb.net/), mark
which games and conditions you own, and get price estimates from
[eBay](https://www.ebay.com/) sold listings. The dashboard shows your total
value, a value-over-time chart, and which games moved most since the last
refresh.

All data lives in a local SQLite file. Nothing is sent anywhere except the
TheGamesDB and eBay APIs.

## Requirements

- **Node.js** 20.19+ or 22.12+ (required by Vite 8).
- **npm** (ships with Node).
- **A C/C++ toolchain** — `better-sqlite3` is a native module and compiles on
  install (Xcode Command Line Tools on macOS, build-essential on Linux, the
  Visual Studio Build Tools on Windows).
- **API credentials** (see below) — a [TheGamesDB](https://thegamesdb.net/) API
  key and an [eBay developer](https://developer.ebay.com/) application. The app
  runs without them, but the catalog sync and price refresh will not work.

## Setup

```sh
npm install
cp .env.example .env   # then fill in your credentials
```

Edit `.env`:

| Variable | Purpose |
|---|---|
| `THEGAMESDB_API_KEY` | TheGamesDB API key — used to sync the game catalog |
| `EBAY_APP_ID` | eBay application (client) ID — used for price estimates |
| `EBAY_CLIENT_SECRET` | eBay application certificate (client secret) |
| `DB_PATH` | Optional — SQLite file location (default `data/collection.db`) |

The SQLite database and its schema are created automatically on first run — no
manual migration step.

## Running

```sh
npm run dev      # start the dev server (http://localhost:5173)
```

Open the app, go to **Settings** to sync the catalog and refresh prices, then
use **Browse** to add games to your collection.

## Other commands

```sh
npm test         # run the test suite (Vitest)
npm run check    # type-check (svelte-check)
npm run build    # production build
npm run preview  # preview the production build
```

## Tech stack

SvelteKit 2 / Svelte 5, TypeScript, SQLite via better-sqlite3 + Drizzle ORM.
