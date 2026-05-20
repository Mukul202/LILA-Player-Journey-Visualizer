/**
 * Canvas / UI color constants. Kept in one place so the canvas renderer and
 * the React legend stay in sync. Tailwind chrome colors live in
 * tailwind.config.ts; these are the data-visualization colors.
 */

import type { EventCategory } from "./data-types";

export const COLORS = {
  /** Human player paths and playheads. */
  human: "#22d3ee", // cyan
  humanGlow: "rgba(34, 211, 238, 0.35)",
  /** Bot paths and playheads. */
  bot: "#8b97a8", // muted slate
  botGlow: "rgba(139, 151, 168, 0.25)",
  /** Discrete event markers. */
  kill: "#f87171", // red
  death: "#e2e8f0", // near-white
  storm: "#e879f9", // fuchsia
  loot: "#fbbf24", // amber
  /** Misc. */
  playhead: "#ffffff",
  brand: "#a78bfa", // violet — "LILA"
  grid: "rgba(148, 163, 184, 0.12)",
} as const;

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  kill: COLORS.kill,
  death: COLORS.death,
  storm: COLORS.storm,
  loot: COLORS.loot,
};

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  kill: "Kills",
  death: "Deaths",
  storm: "Storm deaths",
  loot: "Loot",
};

/** Marker glyph used per category in the legend and on the canvas. */
export const CATEGORY_GLYPH: Record<EventCategory, "cross" | "skull" | "bolt" | "diamond"> = {
  kill: "cross",
  death: "skull",
  storm: "bolt",
  loot: "diamond",
};
