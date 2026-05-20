/**
 * Node-only helpers for discovering and reading the raw LILA BLACK telemetry.
 *
 * The dataset is a tree of Apache Parquet files (no `.parquet` extension) under
 * `player_data/February_NN/`. Each file is one player's journey in one match.
 *
 * Parquet reading uses `hyparquet` — a dependency-free, pure-JS parquet reader,
 * which avoids the native-build fragility of DuckDB / arrow bindings and runs
 * the same on macOS, Linux and CI.
 *
 * This module is imported only by scripts (never by the Next.js app).
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

/** Repo-root folder holding the extracted assignment data. */
export const RAW_DATA_DIR = join(process.cwd(), "player_data");
export const MINIMAP_DIR = join(RAW_DATA_DIR, "minimaps");

/** Date folders are named like `February_10`. */
const DATE_FOLDER_RE = /^February_\d{2}$/;

/** A UUID `user_id` is a human; a short numeric `user_id` is a bot (per README). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParquetFileRef {
  /** Absolute path to the file. */
  path: string;
  /** Base file name. */
  fileName: string;
  /** Date folder, e.g. `February_10`. */
  dateFolder: string;
  /** ISO date derived from the folder, e.g. `2026-02-10`. */
  date: string;
}

/** Convert a `February_10` folder name into an ISO date string. */
export function dateFolderToISO(folder: string): string {
  const day = folder.split("_")[1] ?? "01";
  return `2026-02-${day.padStart(2, "0")}`;
}

/** Recursively discover every parquet telemetry file, sorted for determinism. */
export async function findParquetFiles(): Promise<ParquetFileRef[]> {
  const refs: ParquetFileRef[] = [];
  const entries = await readdir(RAW_DATA_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !DATE_FOLDER_RE.test(entry.name)) continue;
    const dir = join(RAW_DATA_DIR, entry.name);
    const files = await readdir(dir);
    for (const fileName of files) {
      if (fileName.startsWith(".")) continue; // skip .DS_Store etc.
      refs.push({
        path: join(dir, fileName),
        fileName,
        dateFolder: entry.name,
        date: dateFolderToISO(entry.name),
      });
    }
  }
  refs.sort((a, b) => a.path.localeCompare(b.path));
  return refs;
}

/** Read every row of a parquet file as plain objects keyed by column name. */
export async function readParquetRows(
  path: string,
): Promise<Record<string, unknown>[]> {
  const file = await asyncBufferFromFile(path);
  const rows = await parquetReadObjects({ file, compressors, utf8: true });
  return rows as Record<string, unknown>[];
}

/** Read the parquet schema (column definitions) of a single file. */
export async function readParquetSchema(path: string) {
  const { parquetMetadataAsync } = await import("hyparquet");
  const file = await asyncBufferFromFile(path);
  const metadata = await parquetMetadataAsync(file);
  return metadata.schema;
}

/* ----------------------------- value coercion ---------------------------- */

const textDecoder = new TextDecoder();

/** Decode a possibly-binary parquet value into a string. */
export function decodeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return textDecoder.decode(value);
  if (Array.isArray(value)) {
    return textDecoder.decode(Uint8Array.from(value as number[]));
  }
  return String(value);
}

/** Coerce a parquet numeric value (number | bigint | string) to a number. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value == null) return NaN;
  return Number(value);
}

/**
 * Read the `ts` column as Unix epoch SECONDS.
 *
 * Important: the parquet column is annotated `TIMESTAMP_MILLIS`, but the raw
 * INT64 values are actually epoch *seconds* (verified in inspect-data: the
 * values land in Feb 2026 only when read as seconds, and match durations then
 * come out as the documented "several minutes"). hyparquet trusts the MILLIS
 * annotation and returns a `Date` built from the raw integer, so `getTime()`
 * recovers that raw integer unchanged — i.e. the epoch-seconds value we want.
 */
export function tsToEpochSeconds(value: unknown): number {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime(); // raw int == epoch seconds
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value);
}

/** Classify a `user_id`: UUID -> human, short numeric id -> bot. */
export function isBotUserId(userId: string): boolean {
  return !UUID_RE.test(userId.trim());
}
