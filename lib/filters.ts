/**
 * Pure filtering helpers + small manifest queries used by the filter panel
 * and the canvas renderer.
 */

import type {
  DataManifest,
  EventCategory,
  GameEvent,
  MatchData,
  MatchSummary,
  PlayerTrack,
} from "./data-types";

/** Which entities to include in the view. */
export type EntityMode = "all" | "humans" | "bots";

export interface ViewFilters {
  entity: EntityMode;
  /** Per-category marker visibility. */
  categories: Record<EventCategory, boolean>;
  /** When set, restrict the view to a single player. */
  focusPlayerId: string | null;
}

export function matchesEntity(isBot: boolean, mode: EntityMode): boolean {
  if (mode === "all") return true;
  return mode === "humans" ? !isBot : isBot;
}

/** Player tracks visible under the entity + focus filters. */
export function visibleTracks(match: MatchData, f: ViewFilters): PlayerTrack[] {
  return match.players.filter((p) => {
    if (!matchesEntity(p.isBot, f.entity)) return false;
    if (f.focusPlayerId && p.playerId !== f.focusPlayerId) return false;
    return true;
  });
}

/**
 * Event markers visible under the category + entity + focus filters.
 * Note: every discrete event originates from a human's file (bots only emit
 * BotPosition), so entity="bots" intentionally yields no markers.
 */
export function visibleEvents(match: MatchData, f: ViewFilters): GameEvent[] {
  return match.events.filter((e) => {
    if (!f.categories[e.category]) return false;
    if (!matchesEntity(e.isBot, f.entity)) return false;
    if (f.focusPlayerId && e.playerId !== f.focusPlayerId) return false;
    return true;
  });
}

export const ALL_CATEGORIES_ON: Record<EventCategory, boolean> = {
  kill: true,
  death: true,
  storm: true,
  loot: true,
};

/* ---------------------------- manifest queries ---------------------------- */

/** Dates that have at least one match on the given map, chronologically. */
export function datesForMap(manifest: DataManifest, mapId: string): string[] {
  const set = new Set<string>();
  for (const m of manifest.matches) {
    if (m.mapId === mapId) set.add(m.date);
  }
  return [...set].sort();
}

/**
 * Matches for a (map, date) selection, already sorted by activity (manifest
 * order). `richOnly` keeps only matches with more than one entity.
 */
export function matchesFor(
  manifest: DataManifest,
  mapId: string,
  date: string,
  richOnly: boolean,
): MatchSummary[] {
  return manifest.matches.filter((m) => {
    if (m.mapId !== mapId || m.date !== date) return false;
    if (richOnly && m.playerCount + m.botCount < 2) return false;
    return true;
  });
}

/** The highest-activity match on a map (manifest.matches is activity-sorted). */
export function bestMatchForMap(
  manifest: DataManifest,
  mapId: string,
): MatchSummary | undefined {
  return manifest.matches.find((m) => m.mapId === mapId);
}

/** The highest-activity match for a (map, date) pair. */
export function bestMatchFor(
  manifest: DataManifest,
  mapId: string,
  date: string,
): MatchSummary | undefined {
  return manifest.matches.find((m) => m.mapId === mapId && m.date === date);
}
