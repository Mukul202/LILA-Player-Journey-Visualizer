/**
 * scripts/preprocess.ts  ·  `npm run preprocess:data`
 *
 * Phase 2 - turn the raw parquet telemetry into optimized static JSON the
 * Next.js app consumes directly (no parquet parsing in the browser):
 *
 *   player_data/February_NN/*.nakama-0   (raw parquet, 1 file = 1 player/match)
 *        |
 *        v   read + decode + normalize + world->minimap transform
 *   public/data/manifest.json            (maps, dates, match summaries)
 *   public/data/matches/<slug>.json      (one file per match: tracks + events)
 *   public/data/heatmaps/<map>-<kind>.json   (map-wide aggregated grids)
 *   public/maps/<map>.webp               (minimaps resized to 1024x1024)
 *
 * Key normalization decisions (verified in inspect-data, see ARCHITECTURE.md):
 *  - `ts` is read as epoch SECONDS; per-match relative time `t` = ts - matchMin.
 *  - The horizontal plane is (x, z); `y` (elevation) is dropped.
 *  - Bots are identified by a numeric `user_id` (humans have UUIDs).
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

import {
  MAP_CONFIGS,
  MINIMAP_SIZE,
  getMapConfig,
} from "../lib/map-config";
import {
  worldToMinimap,
  worldBoundsFromConfig,
  round,
  clamp,
} from "../lib/coordinates";
import {
  EVENT_CATEGORY,
  HEATMAP_KINDS,
  type DataManifest,
  type EventCategory,
  type EventName,
  type GameEvent,
  type HeatmapGrid,
  type HeatmapKind,
  type JourneyPoint,
  type MapManifest,
  type MatchData,
  type MatchSummary,
  type PlayerTrack,
} from "../lib/data-types";
import {
  MINIMAP_DIR,
  decodeText,
  findParquetFiles,
  isBotUserId,
  readParquetRows,
  toNumber,
  tsToEpochSeconds,
  type ParquetFileRef,
} from "./lib/parquet";

/* --------------------------------- paths --------------------------------- */

const PUBLIC_DIR = join(process.cwd(), "public");
const DATA_DIR = join(PUBLIC_DIR, "data");
const MATCHES_DIR = join(DATA_DIR, "matches");
const HEATMAPS_DIR = join(DATA_DIR, "heatmaps");
const MAPS_OUT_DIR = join(PUBLIC_DIR, "maps");

/** Heatmap grid resolution: HEATMAP_GRID x HEATMAP_GRID cells over the minimap. */
const HEATMAP_GRID = 64;
const HEATMAP_CELL = MINIMAP_SIZE / HEATMAP_GRID;

const READ_BATCH = 32;

/* ------------------------------- raw types ------------------------------- */

interface RawSample {
  t: number; // epoch seconds
  x: number;
  z: number;
}
interface RawEvent extends RawSample {
  event: EventName;
}
interface RawFile {
  playerId: string;
  isBot: boolean;
  matchId: string;
  mapId: string;
  date: string;
  positions: RawSample[];
  events: RawEvent[];
}

/* ------------------------------- utilities ------------------------------- */

const log = (msg: string) => console.log(msg);

async function resetDir(dir: string) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

/** Make a match_id safe to use as a file name (it contains dots/dashes). */
function matchSlug(matchId: string): string {
  return matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function playerLabel(playerId: string, isBot: boolean): string {
  return isBot ? `Bot ${playerId}` : `Human ${playerId.slice(0, 6)}`;
}

async function writeJson(path: string, data: unknown, pretty = false) {
  await writeFile(path, JSON.stringify(data, null, pretty ? 2 : 0));
}

/* ----------------------------- read one file ----------------------------- */

async function readRawFile(ref: ParquetFileRef): Promise<RawFile | null> {
  const rows = await readParquetRows(ref.path);
  if (rows.length === 0) return null;

  const playerId = decodeText(rows[0].user_id);
  const isBot = isBotUserId(playerId);
  const mapId = decodeText(rows[0].map_id);
  const matchId = decodeText(rows[0].match_id);

  const positions: RawSample[] = [];
  const events: RawEvent[] = [];

  for (const r of rows) {
    const event = decodeText(r.event) as EventName;
    const x = toNumber(r.x);
    const z = toNumber(r.z);
    const t = tsToEpochSeconds(r.ts);
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(t)) {
      continue; // drop malformed rows defensively
    }
    if (event === "Position" || event === "BotPosition") {
      positions.push({ t, x, z });
    } else if (EVENT_CATEGORY[event]) {
      events.push({ t, x, z, event });
    }
    // unknown event names are ignored (none expected per inspect-data)
  }

  if (positions.length === 0 && events.length === 0) return null;
  return { playerId, isBot, matchId, mapId, date: ref.date, positions, events };
}

/* ------------------------------- heatmaps -------------------------------- */

type MapGrids = Record<HeatmapKind, Float64Array>;

function newMapGrids(): MapGrids {
  return {
    traffic: new Float64Array(HEATMAP_GRID * HEATMAP_GRID),
    kills: new Float64Array(HEATMAP_GRID * HEATMAP_GRID),
    deaths: new Float64Array(HEATMAP_GRID * HEATMAP_GRID),
    loot: new Float64Array(HEATMAP_GRID * HEATMAP_GRID),
  };
}

/** Add one minimap-space sample (mx,my in [0,1024]) into a heatmap grid. */
function bin(grid: Float64Array, mx: number, my: number) {
  const col = clamp(Math.floor(mx / HEATMAP_CELL), 0, HEATMAP_GRID - 1);
  const row = clamp(Math.floor(my / HEATMAP_CELL), 0, HEATMAP_GRID - 1);
  grid[row * HEATMAP_GRID + col] += 1;
}

function serializeHeatmap(
  mapId: string,
  kind: HeatmapKind,
  grid: Float64Array,
): HeatmapGrid {
  const cells: number[] = [];
  let max = 0;
  let total = 0;
  for (let row = 0; row < HEATMAP_GRID; row++) {
    for (let col = 0; col < HEATMAP_GRID; col++) {
      const count = grid[row * HEATMAP_GRID + col];
      if (count > 0) {
        cells.push(col, row, count);
        total += count;
        if (count > max) max = count;
      }
    }
  }
  return { mapId, kind, grid: HEATMAP_GRID, cellSize: HEATMAP_CELL, max, total, cells };
}

/* ------------------------------ build a match ----------------------------- */

interface BuiltMatch {
  data: MatchData;
  summary: MatchSummary;
}

function buildMatch(matchId: string, files: RawFile[]): BuiltMatch | null {
  const mapId = files[0].mapId;
  const cfg = getMapConfig(mapId);
  if (!cfg) {
    log(`  ! skipping match ${matchId}: unknown map "${mapId}"`);
    return null;
  }
  const target = {
    imageWidth: MINIMAP_SIZE,
    imageHeight: MINIMAP_SIZE,
    worldBounds: worldBoundsFromConfig(cfg),
  };

  // Match start/end = min/max timestamp across every sample in every file.
  let minT = Infinity;
  let maxT = -Infinity;
  for (const f of files) {
    for (const p of f.positions) {
      if (p.t < minT) minT = p.t;
      if (p.t > maxT) maxT = p.t;
    }
    for (const e of f.events) {
      if (e.t < minT) minT = e.t;
      if (e.t > maxT) maxT = e.t;
    }
  }
  if (!Number.isFinite(minT)) return null;

  // Player tracks (humans first, then bots, each stable by id).
  const ordered = [...files].sort((a, b) => {
    if (a.isBot !== b.isBot) return a.isBot ? 1 : -1;
    return a.playerId.localeCompare(b.playerId);
  });

  const players: PlayerTrack[] = [];
  const events: GameEvent[] = [];
  const eventCounts: Record<EventCategory, number> = {
    kill: 0,
    death: 0,
    storm: 0,
    loot: 0,
  };
  let pointCount = 0;

  for (const f of ordered) {
    const points: JourneyPoint[] = f.positions
      .slice()
      .sort((a, b) => a.t - b.t)
      .map((p): JourneyPoint => {
        const m = worldToMinimap(p.x, p.z, target);
        return {
          t: round(p.t - minT, 1),
          x: round(p.x, 1),
          z: round(p.z, 1),
          mx: round(m.x, 1),
          my: round(m.y, 1),
        };
      });
    pointCount += points.length;
    players.push({
      playerId: f.playerId,
      isBot: f.isBot,
      label: playerLabel(f.playerId, f.isBot),
      firstT: points.length ? points[0].t : 0,
      lastT: points.length ? points[points.length - 1].t : 0,
      points,
    });

    for (const e of f.events) {
      const category = EVENT_CATEGORY[e.event];
      const m = worldToMinimap(e.x, e.z, target);
      events.push({
        id: "", // assigned after global sort
        event: e.event,
        category,
        t: round(e.t - minT, 1),
        x: round(e.x, 1),
        z: round(e.z, 1),
        mx: round(m.x, 1),
        my: round(m.y, 1),
        playerId: f.playerId,
        isBot: f.isBot,
      });
      eventCounts[category] += 1;
    }
  }

  events.sort((a, b) => a.t - b.t);
  events.forEach((e, i) => (e.id = `e${i}`));

  const playerCount = files.filter((f) => !f.isBot).length;
  const botCount = files.filter((f) => f.isBot).length;
  const durationSeconds = round(maxT - minT, 1);
  const date = files[0].date;

  const data: MatchData = {
    matchId,
    mapId,
    date,
    startTime: minT * 1000,
    endTime: maxT * 1000,
    durationSeconds,
    players,
    events,
  };

  const activityScore =
    playerCount * 1000 +
    botCount * 120 +
    eventCounts.kill * 60 +
    eventCounts.death * 60 +
    eventCounts.storm * 80 +
    eventCounts.loot * 4 +
    pointCount;

  const summary: MatchSummary = {
    matchId,
    file: `matches/${matchSlug(matchId)}.json`,
    mapId,
    date,
    startTime: data.startTime,
    endTime: data.endTime,
    durationSeconds,
    playerCount,
    botCount,
    pointCount,
    eventCounts,
    totalEvents: events.length,
    activityScore,
  };

  return { data, summary };
}

/* ---------------------------------- main --------------------------------- */

async function main() {
  const startedAt = Date.now();
  log("=".repeat(70));
  log("  PHASE 2 · PREPROCESSING");
  log("=".repeat(70));

  const files = await findParquetFiles();
  log(`Found ${files.length.toLocaleString()} parquet files.`);

  // ---- read all files --------------------------------------------------
  const rawFiles: RawFile[] = [];
  let totalRows = 0;
  for (let i = 0; i < files.length; i += READ_BATCH) {
    const batch = files.slice(i, i + READ_BATCH);
    const results = await Promise.all(batch.map(readRawFile));
    for (const rf of results) {
      if (rf) {
        rawFiles.push(rf);
        totalRows += rf.positions.length + rf.events.length;
      }
    }
    process.stdout.write(`\r  reading … ${Math.min(i + READ_BATCH, files.length)}/${files.length}`);
  }
  log(`\n  read ${rawFiles.length} non-empty files, ${totalRows.toLocaleString()} rows.`);

  // ---- group files by match -------------------------------------------
  const byMatch = new Map<string, RawFile[]>();
  for (const rf of rawFiles) {
    const list = byMatch.get(rf.matchId);
    if (list) list.push(rf);
    else byMatch.set(rf.matchId, [rf]);
  }
  log(`  grouped into ${byMatch.size} matches.`);

  // ---- build matches, accumulate heatmaps -----------------------------
  await resetDir(MATCHES_DIR);
  await resetDir(HEATMAPS_DIR);

  const heatmaps = new Map<string, MapGrids>();
  const mapSampleCount = new Map<string, number>();
  const summaries: MatchSummary[] = [];
  const eventTypesSeen = new Set<EventName>();
  let journeyPoints = 0;
  let discreteEvents = 0;
  const humanIds = new Set<string>();
  const botIds = new Set<string>();

  const writeQueue: Promise<void>[] = [];

  for (const [matchId, matchFiles] of byMatch) {
    const built = buildMatch(matchId, matchFiles);
    if (!built) continue;
    const { data, summary } = built;
    summaries.push(summary);

    // map-level heatmap accumulation
    let grids = heatmaps.get(data.mapId);
    if (!grids) {
      grids = newMapGrids();
      heatmaps.set(data.mapId, grids);
    }
    for (const track of data.players) {
      for (const p of track.points) bin(grids.traffic, p.mx, p.my);
      if (track.isBot) botIds.add(track.playerId);
      else humanIds.add(track.playerId);
    }
    for (const ev of data.events) {
      eventTypesSeen.add(ev.event);
      if (ev.category === "kill") bin(grids.kills, ev.mx, ev.my);
      else if (ev.category === "death" || ev.category === "storm")
        bin(grids.deaths, ev.mx, ev.my);
      else if (ev.category === "loot") bin(grids.loot, ev.mx, ev.my);
    }
    // Position/BotPosition aren't stored as events; record them as seen.
    eventTypesSeen.add("Position");
    eventTypesSeen.add("BotPosition");

    journeyPoints += summary.pointCount;
    discreteEvents += summary.totalEvents;
    mapSampleCount.set(
      data.mapId,
      (mapSampleCount.get(data.mapId) ?? 0) + summary.pointCount + summary.totalEvents,
    );

    writeQueue.push(
      writeJson(join(MATCHES_DIR, `${matchSlug(matchId)}.json`), data),
    );
    if (writeQueue.length >= 64) {
      await Promise.all(writeQueue.splice(0));
    }
  }
  await Promise.all(writeQueue);
  log(`  wrote ${summaries.length} match files.`);

  // ---- sort matches by activity, pick defaults ------------------------
  summaries.sort((a, b) => b.activityScore - a.activityScore);
  const best = summaries[0];

  // ---- heatmap files ---------------------------------------------------
  let heatmapFiles = 0;
  for (const [mapId, grids] of heatmaps) {
    for (const kind of HEATMAP_KINDS) {
      const hm = serializeHeatmap(mapId, kind, grids[kind]);
      await writeJson(join(HEATMAPS_DIR, `${mapId}-${kind}.json`), hm);
      heatmapFiles++;
    }
  }
  log(`  wrote ${heatmapFiles} heatmap files.`);

  // ---- minimaps --------------------------------------------------------
  await mkdir(MAPS_OUT_DIR, { recursive: true });
  for (const cfg of Object.values(MAP_CONFIGS)) {
    const src = join(MINIMAP_DIR, cfg.minimapSource);
    if (!existsSync(src)) {
      log(`  ! minimap source missing: ${cfg.minimapSource}`);
      continue;
    }
    const dest = join(MAPS_OUT_DIR, `${cfg.id}.webp`);
    await sharp(src)
      .resize(MINIMAP_SIZE, MINIMAP_SIZE, { fit: "fill" })
      .webp({ quality: 82 })
      .toFile(dest);
    log(`  resized minimap -> ${cfg.id}.webp`);
  }

  // ---- manifest --------------------------------------------------------
  const datesSeen = [...new Set(summaries.map((s) => s.date))].sort();
  const maps: MapManifest[] = Object.values(MAP_CONFIGS)
    .filter((cfg) => summaries.some((s) => s.mapId === cfg.id))
    .map((cfg): MapManifest => {
      const bounds = worldBoundsFromConfig(cfg);
      return {
        id: cfg.id,
        name: cfg.name,
        blurb: cfg.blurb,
        imageUrl: `/maps/${cfg.id}.webp`,
        imageWidth: MINIMAP_SIZE,
        imageHeight: MINIMAP_SIZE,
        scale: cfg.scale,
        originX: cfg.originX,
        originZ: cfg.originZ,
        worldBounds: bounds,
        coordinateNotes:
          `u=(x-(${cfg.originX}))/${cfg.scale}, v=(z-(${cfg.originZ}))/${cfg.scale}; ` +
          `pixelX=u*${MINIMAP_SIZE}, pixelY=(1-v)*${MINIMAP_SIZE}`,
        matchCount: summaries.filter((s) => s.mapId === cfg.id).length,
        sampleCount: mapSampleCount.get(cfg.id) ?? 0,
      };
    });

  const manifest: DataManifest = {
    generatedAt: new Date().toISOString(),
    dataset: "LILA BLACK · production telemetry · Feb 10-14, 2026",
    maps,
    dates: datesSeen,
    matches: summaries,
    eventTypes: [...eventTypesSeen].sort() as EventName[],
    heatmapKinds: HEATMAP_KINDS,
    totals: {
      files: rawFiles.length,
      rows: totalRows,
      matches: summaries.length,
      humanPlayers: humanIds.size,
      bots: botIds.size,
      journeyPoints,
      discreteEvents,
    },
    defaults: {
      mapId: best.mapId,
      date: best.date,
      matchId: best.matchId,
    },
  };
  await writeJson(join(DATA_DIR, "manifest.json"), manifest, true);

  // ---- summary ---------------------------------------------------------
  log("-".repeat(70));
  log(`  matches            : ${summaries.length}`);
  log(`  journey points     : ${journeyPoints.toLocaleString()}`);
  log(`  discrete events    : ${discreteEvents.toLocaleString()}`);
  log(`  maps               : ${maps.map((m) => m.id).join(", ")}`);
  log(`  dates              : ${datesSeen.join(", ")}`);
  log(`  default match      : ${best.matchId}`);
  log(`    -> ${best.mapId} / ${best.date} / ${best.playerCount} players, ${best.botCount} bots, ${best.totalEvents} events`);
  log(`  output             : public/data/{manifest.json, matches/, heatmaps/}, public/maps/`);
  log(`  done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  log("=".repeat(70));
}

main().catch((err) => {
  console.error("\npreprocess failed:", err);
  process.exit(1);
});
