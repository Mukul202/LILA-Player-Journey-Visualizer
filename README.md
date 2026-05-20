# LILA BLACK — Player Journey Visualizer

An interactive web tool for **LILA BLACK** level designers to explore player
movement, combat and loot across production maps. It turns 5 days of raw
gameplay telemetry into a map-first visualization with filters, playback and
heatmaps.

> Built for the *Player Journey Visualization* assignment. Dataset: 1,243
> Apache Parquet files · 89,104 telemetry rows · 796 matches · 3 maps,
> Feb 10–14 2026.

## Live Demo

**`https://lila-player-journey-visualizer-tawny.vercel.app`**

---

## What the tool does

- **Map-first canvas** — player journeys drawn over the actual game minimaps,
  with the world→minimap coordinate transform from the dataset README.
- **Humans vs bots** — humans render as solid cyan paths, bots as dashed slate;
  live playheads mark each player's current position.
- **Event markers** — distinct glyphs for kills, deaths, storm deaths and loot,
  with hover tooltips (event type, time, player, world & minimap coordinates).
- **Filters** — by map, date and match; by entity (humans / bots / all); by
  event category; plus a multi-entity-matches-only filter and per-player focus.
- **Timeline playback** — play/pause, scrub, 0.5×–10× speed, and three trail
  modes (full path / progressive reveal / sliding window).
- **Heatmaps** — map-wide aggregated overlays for traffic, kill zones, death
  zones and loot hotspots, with an opacity control.
- **Pan & zoom** — scroll to zoom, drag to pan; the journey data scales with it.
- **Insights** — three data-backed observations surfaced in-app and in
  [`INSIGHTS.md`](./INSIGHTS.md).

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS 3** — dark analytics theme; custom UI components (no UI library)
- **Zustand** — application state (selection, filters, playback)
- **HTML Canvas 2D** — layered renderer for journeys, markers and heatmaps
- **hyparquet** — pure-JS Apache Parquet reader (preprocessing; no native deps)
- **sharp** — minimap image resizing (preprocessing)
- **tsx** — runs the TypeScript pipeline scripts

## Project layout

```
.
├── app/                    Next.js App Router (layout, page, global CSS)
├── components/             React components (Dashboard, MapViewer, Timeline, …)
├── lib/                    shared logic — coordinates, render, playback,
│                           filters, heatmap, Zustand store, data-types
├── scripts/
│   ├── lib/parquet.ts      hyparquet reader + decoding helpers
│   ├── inspect-data.ts     `npm run inspect:data`
│   ├── preprocess.ts       `npm run preprocess:data`
│   └── generate-insights.ts `npm run generate:insights`
├── player_data/            raw assignment data (Parquet files + minimaps)
├── public/
│   ├── data/               generated JSON (manifest, matches/, heatmaps/, insights.json)
│   └── maps/               generated minimap WebP images
├── ARCHITECTURE.md         design, data flow, coordinate mapping, tradeoffs
├── INSIGHTS.md             three data-backed level-design insights
└── README.md
```

## Setup

Requires **Node.js 20+** (developed on Node 22).

```bash
npm install
```

The raw assignment data is expected at **`player_data/`** in the repo root
(date folders `February_10 … February_14` plus `player_data/minimaps/`). It is
already included in this repository.

## Data preprocessing

The app reads pre-generated static JSON — it never parses Parquet in the
browser. The generated artifacts (`public/data/`, `public/maps/`) are committed,
so **the app runs without this step**. To regenerate them from the raw Parquet:

```bash
npm run inspect:data       # (optional) inspect schema, coordinates, timestamps
npm run preprocess:data    # Parquet → public/data + resized minimaps
npm run generate:insights  # compute public/data/insights.json
```

Or both generation steps at once:

```bash
npm run data               # preprocess:data + generate:insights
```

`preprocess:data` reads every file under `player_data/`, normalizes the rows,
applies the coordinate transform, writes one JSON per match plus a manifest and
heatmap grids, and resizes the minimaps into `public/maps/`. It runs in ~1 s.

## Run locally

```bash
npm run dev          # http://localhost:3000
```

## Build

```bash
npm run build        # production build
npm run start        # serve the production build at http://localhost:3000
```

The build is fully static and emits no TypeScript errors.

## Deployment

The app is a static Next.js site — no server runtime, no environment variables.

1. Push this repository to GitHub.
2. Import it into **Vercel** (or Netlify / Railway). The framework
   (Next.js) and build command (`next build`) are detected automatically.
3. Deploy. Because `public/data/` and `public/maps/` are committed, the
   deployed site works immediately — no build-time data step is required.
4. Paste the resulting URL into the **Live Demo** section above.

Only the `public/` output is needed at runtime; `player_data/` (the raw
Parquet) is required solely to *regenerate* artifacts.

## Known limitations

- **Desktop-first.** The layout targets desktop/laptop widths; the right-hand
  match panel is hidden below the `lg` breakpoint.
- **Heatmaps are map-wide.** They aggregate every match on a map and do not
  respond to the match/date/entity filters — by design, since a single match is
  too sparse for a meaningful density field (see `ARCHITECTURE.md`).
- **No victim/attacker data.** The telemetry schema has no second party to an
  event, so a kill marker identifies the acting player only, not the victim.
- **Multi-human matches are rare.** 99.7% of matches have fewer than two humans
  (see `INSIGHTS.md`); playback still visualizes the bot population.
- **Piecewise-linear paths.** Position is sampled every ~6–7 s; playback
  interpolates linearly between samples.
- No automated test suite (out of scope for the assignment).

## Data handling notes

A few decisions worth flagging (full detail in [`ARCHITECTURE.md`](./ARCHITECTURE.md)):

- The `ts` column is annotated `TIMESTAMP_MILLIS` but its values are actually
  **epoch seconds** — verified during inspection. Time is normalized per match.
- The horizontal plane is **(x, z)**; the `y` column is elevation and is unused.
- Bots are identified by a numeric `user_id` (humans have UUIDs).
- Minimaps ship as large images (up to 9000²) and are resized to 1024×1024
  WebP during preprocessing, matching the documented coordinate space.
