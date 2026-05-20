# Architecture

## What was built

A web tool for LILA BLACK level designers to explore player movement, combat
and loot across three maps from production telemetry. It has three parts:

1. **A data pipeline** (`scripts/`) that reads the raw Apache Parquet telemetry,
   normalizes it, applies the world→minimap coordinate transform, and emits
   optimized static JSON.
2. **A canvas visualization** (`app/`, `components/`, `lib/`) — a Next.js app
   that renders player journeys, event markers and heatmaps over the minimaps,
   with filters and a playback timeline.
3. **An insights pass** (`scripts/generate-insights.ts`) that computes
   data-backed observations (see `INSIGHTS.md`).

## Why Next.js

The app is fully static — it reads pre-generated JSON and image assets, with no
server runtime. Next.js gives a first-class TypeScript + React setup, a trivial
`next build` → static export, and one-command deploys to Vercel/Netlify. The
App Router keeps the single page minimal; all interactivity is client-side.
Picking Next.js also means the preprocessing scripts and the UI share one
TypeScript project and one set of `lib/` types — the generated JSON has a single
source-of-truth schema (`lib/data-types.ts`).

## Data flow

```
player_data/February_NN/*.nakama-0      raw Apache Parquet (1 file = 1 player in 1 match)
        │
        │  scripts/preprocess.ts  — hyparquet read → normalize → world→minimap transform
        ▼
public/data/manifest.json               maps, dates, 796 match summaries, defaults
public/data/matches/<slug>.json          per match: player tracks + events
public/data/heatmaps/<map>-<kind>.json    map-wide aggregated 64×64 grids
public/maps/<map>.webp                    minimaps resized to 1024×1024
        │
        │  scripts/generate-insights.ts  — reads the JSON above
        ▼
public/data/insights.json                three data-backed insights
        │
        │  fetch() at runtime (lib/store.ts, Zustand)
        ▼
Next.js client app
        │
        ▼
MapViewer — 3 stacked <canvas> layers (minimap · heatmap · animated overlay),
            one requestAnimationFrame loop for playback + filters + pan/zoom
```

The frontend never parses Parquet. The manifest loads once (~424 KB); a match
file loads only when selected (~10 KB median); heatmaps load on demand.

## Coordinate mapping

The horizontal plane of the 3D world is **(x, z)**. The `y` column is elevation
and is intentionally dropped. The world→minimap transform is taken verbatim from
the dataset README and applied once, at preprocess time:

```
u = (x - originX) / scale          # world → UV in [0,1]
v = (z - originZ) / scale
minimapX = u * 1024                # UV → image pixels
minimapY = (1 - v) * 1024          # Y flipped: image origin is top-left
```

| Map           | scale | originX | originZ |
|---------------|-------|---------|---------|
| AmbroseValley | 900   | −370    | −473    |
| GrandRift     | 581   | −290    | −290    |
| Lockdown      | 1000  | −500    | −500    |

`scale`/`origin` come from the README; the derived world rectangle is
`x ∈ [origin, origin+scale]`. Implementation: `lib/coordinates.ts`
(`worldToMinimap`), map metadata: `lib/map-config.ts`.

**Verification.** `npm run inspect:data` confirmed **100% of all 89,104 points**
fall inside the documented per-map bounds. End-to-end spot check on
AmbroseValley: world `x = -174.4` → `minimapX = 222.6` (matches the formula).

**Resolution note.** The README documents the minimaps as 1024×1024 and its
formula multiplies UV by 1024, but the *actual* source images are 4320², 2160×
2158 and 9000². Preprocessing resizes every minimap to a square **1024×1024**
WebP (24 MB of source PNG/JPG → 212 KB). This makes the documented coordinate
space exact and keeps the canvas resolution-independent — `minimapX/minimapY`
are stored in 1024-space and the renderer scales them to the displayed size.

## Assumptions

These were verified against the data (`scripts/inspect-data.ts`); ambiguous
points are handled defensively.

- **`ts` is epoch *seconds*, not milliseconds.** The Parquet column is annotated
  `TIMESTAMP_MILLIS`, but the integer values only land in Feb 2026 — and match
  durations only become the documented "several minutes" — when read as
  *seconds*. The README's "milliseconds / time within the match" description is
  inaccurate. The pipeline reads the raw integer as epoch seconds; each match's
  `t = 0` is its earliest sample, and per-event/point `t` is the offset from it.
- **Bot detection.** A numeric `user_id` is a bot; a UUID is a human (per the
  README). Cross-checked: bot files contain only `BotPosition` events.
- **Events have no victim/attacker.** The schema is only
  `user_id, match_id, map_id, x, y, z, ts, event` — there is no second party.
  A `Kill`/`BotKill` row means "this file's owner killed someone (somewhere)";
  `GameEvent.playerId` is therefore the file owner, and victim IDs are unknown.
- **All discrete events originate from human files** — bots emit only
  `BotPosition`. Consequently the entity filter set to "Bots" shows no event
  markers, which is correct rather than a bug.
- **Heatmaps are map-wide.** They aggregate every match on a map across all
  dates, because a single match (median ~1 human) is far too sparse for a
  meaningful density field. They intentionally ignore the match/date/entity
  filters and act as a map-analysis layer. `traffic` = all position samples,
  `kills` = Kill+BotKill, `deaths` = Killed+BotKilled+KilledByStorm,
  `loot` = Loot.
- **Storm deaths** are their own marker category but fold into the `deaths`
  heatmap.
- Rows with non-finite coordinates/timestamps are dropped; files that decode to
  zero usable rows are skipped.

## Tradeoffs

| Decision | Alternatives considered | Why chosen | Tradeoff |
|----------|------------------------|------------|----------|
| Preprocess Parquet → static JSON | Parse Parquet in the browser | Fast UI, trivial static deploy, no runtime | A build step; generated artifacts committed to the repo |
| `hyparquet` (pure-JS reader) | DuckDB / Arrow native bindings | Zero native deps — runs identically on macOS, Linux, CI | Slower than DuckDB (irrelevant at ~8 MB of data) |
| Canvas renderer | SVG / DOM markers | Smoothly handles 73k journey points + 16k events | Hand-written hit-testing for hover |
| 3 stacked canvas layers | Single canvas | Only the overlay redraws per frame; background/heatmap cached | Three elements to size on resize |
| Map-wide pre-aggregated heatmaps | Per-match client-side heatmap | A single match is too sparse to read; map-wide shows real patterns | Heatmaps don't respond to match/date/entity filters |
| Zustand store | Prop drilling / Context | Clean playback + filter state, selective subscriptions | One small dependency |
| Custom UI components | shadcn/ui | No dependency churn, full control of the dark theme | Hand-rolled controls (small surface) |
| Static JSON hosting | A backend API | One-command Vercel/Netlify deploy | 424 KB manifest loaded upfront (gzips small) |

## Performance notes

- A single `requestAnimationFrame` loop in `MapViewer` advances playback and
  redraws the overlay. It reads state imperatively (store `getState()` + refs),
  so the component does **not** re-render per frame. Redraws are skipped when
  nothing changed (`dirty` flag + last-drawn-time check).
- Per-match JSON uses short keys (`t,x,z,mx,my`) on the high-frequency
  `JourneyPoint` type to keep files small (~10 KB median).
- Playback interpolates linearly between samples (position is sampled roughly
  every 6–7 s); a binary search locates the bracketing samples.
