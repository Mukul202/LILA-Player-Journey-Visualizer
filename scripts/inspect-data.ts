/**
 * scripts/inspect-data.ts  ·  `npm run inspect:data`
 *
 * Phase 1 - data discovery. Reads the raw parquet telemetry and prints:
 *   - discovered files and date folders
 *   - the parquet schema (columns + physical/logical types)
 *   - the raw JavaScript types each column decodes to
 *   - sample human and bot rows
 *   - global aggregates: maps, event types, players, matches
 *   - coordinate ranges per map, validated against the README map config
 *   - timestamp behaviour, validated per match
 *
 * Nothing is written to disk — this script only inspects and reports, so the
 * preprocessing step can be built against verified facts rather than guesses.
 */

import { MAP_CONFIGS } from "../lib/map-config";
import { worldBoundsFromConfig, isWithinWorldBounds } from "../lib/coordinates";
import {
  findParquetFiles,
  readParquetRows,
  readParquetSchema,
  decodeText,
  toNumber,
  tsToEpochSeconds,
  isBotUserId,
} from "./lib/parquet";

const num = (n: number) => n.toLocaleString("en-US");
const line = (s = "") => console.log(s);
const header = (s: string) => {
  line();
  line(`${"=".repeat(74)}`);
  line(`  ${s}`);
  line(`${"=".repeat(74)}`);
};

interface MapStats {
  rows: number;
  files: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  inBounds: number;
  outOfBounds: number;
}

interface MatchStats {
  tsMin: number;
  tsMax: number;
  rows: number;
  userIds: Set<string>;
}

function emptyMapStats(): MapStats {
  return {
    rows: 0,
    files: 0,
    xMin: Infinity,
    xMax: -Infinity,
    yMin: Infinity,
    yMax: -Infinity,
    zMin: Infinity,
    zMax: -Infinity,
    inBounds: 0,
    outOfBounds: 0,
  };
}

async function main() {
  header("PHASE 1 · DATA DISCOVERY");

  const files = await findParquetFiles();
  if (files.length === 0) {
    line("No parquet files found under player_data/. Aborting.");
    process.exit(1);
  }

  // ---- files per date folder -------------------------------------------
  const byFolder = new Map<string, number>();
  for (const f of files) {
    byFolder.set(f.dateFolder, (byFolder.get(f.dateFolder) ?? 0) + 1);
  }
  line(`Discovered ${num(files.length)} parquet files across ${byFolder.size} date folders:`);
  for (const [folder, count] of [...byFolder].sort()) {
    line(`  ${folder.padEnd(16)} ${num(count).padStart(6)} files`);
  }

  // ---- schema of the first file ----------------------------------------
  header("PARQUET SCHEMA (first file)");
  line(`File: ${files[0].fileName}`);
  const schema = await readParquetSchema(files[0].path);
  for (const el of schema) {
    if (el.num_children) {
      line(`  <root> "${el.name}" (${el.num_children} columns)`);
      continue;
    }
    const parts = [
      `physical=${el.type ?? "?"}`,
      el.converted_type ? `converted=${el.converted_type}` : null,
      el.logical_type ? `logical=${JSON.stringify(el.logical_type)}` : null,
      el.repetition_type ? `rep=${el.repetition_type}` : null,
    ].filter(Boolean);
    line(`  - ${el.name.padEnd(10)} ${parts.join("  ")}`);
  }

  // ---- raw decoded JS types of a sample row ----------------------------
  header("DECODED JAVASCRIPT TYPES (sample row)");
  const firstRows = await readParquetRows(files[0].path);
  const sample = firstRows[0] ?? {};
  for (const [key, value] of Object.entries(sample)) {
    const ctor = value?.constructor?.name ?? "—";
    let preview = String(value);
    if (value instanceof Uint8Array) preview = `[${value.length} bytes] -> "${decodeText(value)}"`;
    if (preview.length > 48) preview = preview.slice(0, 48) + "…";
    line(`  ${key.padEnd(10)} typeof=${(typeof value).padEnd(9)} ctor=${ctor.padEnd(12)} ${preview}`);
  }

  // ---- find one human file and one bot file for sample rows ------------
  header("SAMPLE ROWS");
  const humanFile = files.find((f) => {
    const id = f.fileName.split("_")[0];
    return !isBotUserId(id);
  });
  const botFile = files.find((f) => {
    const id = f.fileName.split("_")[0];
    return isBotUserId(id);
  });
  for (const [label, file] of [
    ["HUMAN", humanFile],
    ["BOT", botFile],
  ] as const) {
    if (!file) continue;
    const rows = await readParquetRows(file.path);
    line(`\n${label} · ${file.fileName} · ${rows.length} rows`);
    const events = rows.map((r) => decodeText(r.event));
    const firstNonPos = rows.find(
      (r) => !decodeText(r.event).toLowerCase().includes("position"),
    );
    for (const r of [rows[0], firstNonPos].filter(Boolean) as Record<string, unknown>[]) {
      line(
        `   user_id=${decodeText(r.user_id)}  map_id=${decodeText(r.map_id)}` +
          `  event=${decodeText(r.event)}`,
      );
      line(
        `   x=${toNumber(r.x).toFixed(2)}  y=${toNumber(r.y).toFixed(2)}` +
          `  z=${toNumber(r.z).toFixed(2)}  ts=${tsToEpochSeconds(r.ts)} (epoch s)` +
          `  match_id=${decodeText(r.match_id)}`,
      );
    }
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e, (counts.get(e) ?? 0) + 1);
    line(`   event breakdown: ${[...counts].map(([e, c]) => `${e}:${c}`).join(", ")}`);
  }

  // ---- full scan -------------------------------------------------------
  header("FULL DATASET SCAN");
  line(`Scanning all ${num(files.length)} files …`);

  const eventCounts = new Map<string, number>();
  const mapStats = new Map<string, MapStats>();
  const matchStats = new Map<string, MatchStats>();
  const humanIds = new Set<string>();
  const botIds = new Set<string>();
  const mapsSeen = new Set<string>();
  let totalRows = 0;
  let humanFiles = 0;
  let botFiles = 0;
  let mixedFiles = 0; // files whose rows disagree on user/match/map
  let tsGlobalMin = Infinity;
  let tsGlobalMax = -Infinity;

  const batchSize = 32;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (f) => ({ f, rows: await readParquetRows(f.path) })),
    );
    for (const { f, rows } of results) {
      if (rows.length === 0) continue;
      totalRows += rows.length;

      const fileUsers = new Set<string>();
      const fileMatches = new Set<string>();
      const fileMaps = new Set<string>();

      for (const r of rows) {
        const userId = decodeText(r.user_id);
        const matchId = decodeText(r.match_id);
        const mapId = decodeText(r.map_id);
        const event = decodeText(r.event);
        const x = toNumber(r.x);
        const y = toNumber(r.y);
        const z = toNumber(r.z);
        const ts = tsToEpochSeconds(r.ts);

        fileUsers.add(userId);
        fileMatches.add(matchId);
        fileMaps.add(mapId);
        mapsSeen.add(mapId);
        eventCounts.set(event, (eventCounts.get(event) ?? 0) + 1);

        if (isBotUserId(userId)) botIds.add(userId);
        else humanIds.add(userId);

        // per-map coordinate stats
        let ms = mapStats.get(mapId);
        if (!ms) {
          ms = emptyMapStats();
          mapStats.set(mapId, ms);
        }
        ms.rows++;
        if (Number.isFinite(x)) {
          ms.xMin = Math.min(ms.xMin, x);
          ms.xMax = Math.max(ms.xMax, x);
        }
        if (Number.isFinite(y)) {
          ms.yMin = Math.min(ms.yMin, y);
          ms.yMax = Math.max(ms.yMax, y);
        }
        if (Number.isFinite(z)) {
          ms.zMin = Math.min(ms.zMin, z);
          ms.zMax = Math.max(ms.zMax, z);
        }
        const cfg = MAP_CONFIGS[mapId];
        if (cfg && Number.isFinite(x) && Number.isFinite(z)) {
          if (isWithinWorldBounds(x, z, worldBoundsFromConfig(cfg))) ms.inBounds++;
          else ms.outOfBounds++;
        }

        // per-match timestamp stats
        let mt = matchStats.get(matchId);
        if (!mt) {
          mt = { tsMin: Infinity, tsMax: -Infinity, rows: 0, userIds: new Set() };
          matchStats.set(matchId, mt);
        }
        mt.rows++;
        mt.userIds.add(userId);
        if (Number.isFinite(ts)) {
          mt.tsMin = Math.min(mt.tsMin, ts);
          mt.tsMax = Math.max(mt.tsMax, ts);
          tsGlobalMin = Math.min(tsGlobalMin, ts);
          tsGlobalMax = Math.max(tsGlobalMax, ts);
        }
      }

      if (fileUsers.size > 1 || fileMatches.size > 1 || fileMaps.size > 1) {
        mixedFiles++;
      }
      const fileUser = [...fileUsers][0] ?? "";
      if (isBotUserId(fileUser)) botFiles++;
      else humanFiles++;
      for (const m of fileMaps) {
        const ms = mapStats.get(m);
        if (ms) ms.files++;
      }
    }
  }

  // ---- report ----------------------------------------------------------
  header("EVENT TYPES");
  for (const [event, count] of [...eventCounts].sort((a, b) => b[1] - a[1])) {
    const pct = ((count / totalRows) * 100).toFixed(1);
    line(`  ${event.padEnd(16)} ${num(count).padStart(8)}  (${pct}%)`);
  }

  header("MAPS & COORDINATE VALIDATION");
  for (const mapId of [...mapsSeen].sort()) {
    const ms = mapStats.get(mapId)!;
    const cfg = MAP_CONFIGS[mapId];
    line(`\n${mapId}  ·  ${num(ms.rows)} rows  ·  ${num(ms.files)} files`);
    line(`  x range: ${ms.xMin.toFixed(1)} … ${ms.xMax.toFixed(1)}`);
    line(`  y range: ${ms.yMin.toFixed(1)} … ${ms.yMax.toFixed(1)}   (elevation - unused for 2D)`);
    line(`  z range: ${ms.zMin.toFixed(1)} … ${ms.zMax.toFixed(1)}`);
    if (cfg) {
      const b = worldBoundsFromConfig(cfg);
      line(`  README bounds: x[${b.minX}, ${b.maxX}]  z[${b.minZ}, ${b.maxZ}]  (scale=${cfg.scale})`);
      const total = ms.inBounds + ms.outOfBounds;
      const pct = total ? ((ms.inBounds / total) * 100).toFixed(1) : "0";
      line(`  in documented bounds: ${num(ms.inBounds)} / ${num(total)}  (${pct}%)`);
    } else {
      line(`  WARNING: no map config for "${mapId}"`);
    }
  }

  header("TIMESTAMP VALIDATION");
  const durations = [...matchStats.values()]
    .map((m) => m.tsMax - m.tsMin) // ts is epoch seconds, so this is already seconds
    .filter((d) => Number.isFinite(d))
    .sort((a, b) => a - b);
  const pctl = (p: number) => durations[Math.floor((durations.length - 1) * p)] ?? 0;
  line(`Global ts range : ${tsGlobalMin} … ${tsGlobalMax}  (raw integer values)`);
  line(`  as epoch secs : ${new Date(tsGlobalMin * 1000).toISOString()} … ${new Date(tsGlobalMax * 1000).toISOString()}`);
  line(`Match duration (max ts - min ts), seconds:`);
  line(`  min ${pctl(0).toFixed(1)}  ·  p25 ${pctl(0.25).toFixed(1)}  ·  median ${pctl(0.5).toFixed(1)}  ·  p75 ${pctl(0.75).toFixed(1)}  ·  p95 ${pctl(0.95).toFixed(1)}  ·  max ${pctl(1).toFixed(1)}`);
  line("Sample matches:");
  for (const [matchId, m] of [...matchStats].slice(0, 6)) {
    line(
      `  ${matchId.slice(0, 28).padEnd(30)} dur=${(m.tsMax - m.tsMin).toFixed(1)}s` +
        `  rows=${m.rows}  players=${m.userIds.size}`,
    );
  }

  header("MATCH COMPOSITION");
  const filesPerMatch = [...matchStats.values()].map((m) => m.userIds.size);
  const distribution = new Map<number, number>();
  for (const c of filesPerMatch) distribution.set(c, (distribution.get(c) ?? 0) + 1);
  line("players (files) per match -> number of matches:");
  for (const [players, count] of [...distribution].sort((a, b) => a[0] - b[0])) {
    line(`  ${String(players).padStart(3)} player(s): ${num(count)} matches`);
  }

  header("SUMMARY");
  line(`  total files        : ${num(files.length)}`);
  line(`  total rows         : ${num(totalRows)}`);
  line(`  human player files : ${num(humanFiles)}`);
  line(`  bot files          : ${num(botFiles)}`);
  line(`  files w/ mixed ids : ${num(mixedFiles)}  (expected 0)`);
  line(`  unique humans      : ${num(humanIds.size)}`);
  line(`  unique bots        : ${num(botIds.size)}`);
  line(`  unique matches     : ${num(matchStats.size)}`);
  line(`  maps               : ${[...mapsSeen].sort().join(", ")}`);
  line(`  event types        : ${[...eventCounts.keys()].sort().join(", ")}`);
  line();
  line("Inspection complete. Findings feed scripts/preprocess.ts.");
}

main().catch((err) => {
  console.error("inspect-data failed:", err);
  process.exit(1);
});
