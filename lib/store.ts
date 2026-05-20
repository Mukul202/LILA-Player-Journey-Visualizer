/**
 * Global application state (Zustand).
 *
 * Holds the loaded manifest, the current map/date/match selection, view
 * filters, playback state and the active heatmap. Async actions fetch the
 * static JSON artifacts from /data and guard against out-of-order responses.
 *
 * Playback note: `currentTime` lives here and is advanced by `tick()` from a
 * single requestAnimationFrame loop in MapViewer. The canvas redraws
 * imperatively, so it does NOT subscribe to `currentTime`; only the lightweight
 * clock/scrubber components do.
 */

"use client";

import { create } from "zustand";
import type {
  DataManifest,
  EventCategory,
  HeatmapGrid,
  HeatmapKind,
  MatchData,
} from "./data-types";
import {
  ALL_CATEGORIES_ON,
  bestMatchFor,
  bestMatchForMap,
  type EntityMode,
} from "./filters";
import type { TrailMode } from "./playback";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

const DEFAULTS = {
  entity: "all" as EntityMode,
  trackOpacity: 0.85,
  trailMode: "full" as TrailMode,
  windowSeconds: 60,
  speed: 1,
  heatmapOpacity: 0.7,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export interface AppState {
  /* ---- manifest ---- */
  manifest: DataManifest | null;
  manifestStatus: LoadStatus;

  /* ---- selection ---- */
  mapId: string;
  date: string;
  matchId: string;

  /* ---- match data ---- */
  match: MatchData | null;
  matchStatus: LoadStatus;

  /* ---- view filters ---- */
  entity: EntityMode;
  categories: Record<EventCategory, boolean>;
  focusPlayerId: string | null;
  trackOpacity: number;
  richOnly: boolean;

  /* ---- playback ---- */
  isPlaying: boolean;
  speed: number;
  currentTime: number;
  trailMode: TrailMode;
  windowSeconds: number;

  /* ---- heatmap ---- */
  heatmapKind: HeatmapKind | "none";
  heatmapOpacity: number;
  heatmap: HeatmapGrid | null;
  heatmapStatus: LoadStatus;

  /* ---- actions ---- */
  loadManifest: () => Promise<void>;
  selectMap: (mapId: string) => void;
  selectDate: (date: string) => void;
  selectMatch: (matchId: string) => void;
  setEntity: (entity: EntityMode) => void;
  toggleCategory: (category: EventCategory) => void;
  setFocusPlayer: (playerId: string | null) => void;
  setTrackOpacity: (value: number) => void;
  setRichOnly: (value: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  tick: (deltaSeconds: number) => void;
  setSpeed: (speed: number) => void;
  setCurrentTime: (t: number) => void;
  setTrailMode: (mode: TrailMode) => void;
  setWindowSeconds: (seconds: number) => void;
  setHeatmapKind: (kind: HeatmapKind | "none") => void;
  setHeatmapOpacity: (value: number) => void;
  resetFilters: () => void;
}

export const useStore = create<AppState>((set, get) => {
  /** Fetch a heatmap, applying the result only if the selection still holds. */
  async function loadHeatmap(mapId: string, kind: HeatmapKind) {
    set({ heatmapStatus: "loading", heatmap: null });
    try {
      const hm = await fetchJson<HeatmapGrid>(
        `/data/heatmaps/${mapId}-${kind}.json`,
      );
      const s = get();
      if (s.mapId === mapId && s.heatmapKind === kind) {
        set({ heatmap: hm, heatmapStatus: "ready" });
      }
    } catch {
      if (get().heatmapKind === kind) set({ heatmapStatus: "error" });
    }
  }

  /** Fetch a match file, applying the result only if it is still selected. */
  async function loadMatch(matchId: string) {
    const manifest = get().manifest;
    const summary = manifest?.matches.find((m) => m.matchId === matchId);
    if (!summary) {
      set({ matchStatus: "error" });
      return;
    }
    set({
      matchId,
      matchStatus: "loading",
      match: null,
      currentTime: 0,
      isPlaying: false,
      focusPlayerId: null,
    });
    try {
      const data = await fetchJson<MatchData>(`/data/${summary.file}`);
      if (get().matchId === matchId) {
        set({ match: data, matchStatus: "ready" });
      }
    } catch {
      if (get().matchId === matchId) set({ matchStatus: "error" });
    }
  }

  return {
    manifest: null,
    manifestStatus: "idle",
    mapId: "",
    date: "",
    matchId: "",
    match: null,
    matchStatus: "idle",
    entity: DEFAULTS.entity,
    categories: { ...ALL_CATEGORIES_ON },
    focusPlayerId: null,
    trackOpacity: DEFAULTS.trackOpacity,
    richOnly: false,
    isPlaying: false,
    speed: DEFAULTS.speed,
    currentTime: 0,
    trailMode: DEFAULTS.trailMode,
    windowSeconds: DEFAULTS.windowSeconds,
    heatmapKind: "none",
    heatmapOpacity: DEFAULTS.heatmapOpacity,
    heatmap: null,
    heatmapStatus: "idle",

    async loadManifest() {
      if (get().manifestStatus === "loading") return;
      set({ manifestStatus: "loading" });
      try {
        const manifest = await fetchJson<DataManifest>("/data/manifest.json");
        const { mapId, date, matchId } = manifest.defaults;
        set({ manifest, manifestStatus: "ready", mapId, date, matchId });
        void loadMatch(matchId);
      } catch {
        set({ manifestStatus: "error" });
      }
    },

    selectMap(mapId) {
      const { manifest, heatmapKind } = get();
      if (!manifest || mapId === get().mapId) return;
      const best = bestMatchForMap(manifest, mapId);
      set({ mapId, date: best?.date ?? get().date });
      if (heatmapKind !== "none") void loadHeatmap(mapId, heatmapKind);
      if (best) void loadMatch(best.matchId);
    },

    selectDate(date) {
      const { manifest, mapId } = get();
      if (!manifest || date === get().date) return;
      set({ date });
      const best = bestMatchFor(manifest, mapId, date);
      if (best) void loadMatch(best.matchId);
    },

    selectMatch(matchId) {
      if (matchId === get().matchId) return;
      void loadMatch(matchId);
    },

    setEntity(entity) {
      set({ entity });
    },

    toggleCategory(category) {
      set((s) => ({
        categories: { ...s.categories, [category]: !s.categories[category] },
      }));
    },

    setFocusPlayer(playerId) {
      set({ focusPlayerId: playerId });
    },

    setTrackOpacity(value) {
      set({ trackOpacity: Math.min(1, Math.max(0.1, value)) });
    },

    setRichOnly(value) {
      set({ richOnly: value });
    },

    play() {
      const { match, currentTime } = get();
      if (!match) return;
      const atEnd = currentTime >= match.durationSeconds;
      set({ isPlaying: true, currentTime: atEnd ? 0 : currentTime });
    },

    pause() {
      set({ isPlaying: false });
    },

    togglePlay() {
      if (get().isPlaying) get().pause();
      else get().play();
    },

    tick(deltaSeconds) {
      const s = get();
      if (!s.isPlaying || !s.match) return;
      const duration = s.match.durationSeconds;
      const next = s.currentTime + deltaSeconds * s.speed;
      if (next >= duration) set({ currentTime: duration, isPlaying: false });
      else set({ currentTime: next });
    },

    setSpeed(speed) {
      set({ speed });
    },

    setCurrentTime(t) {
      const duration = get().match?.durationSeconds ?? 0;
      set({ currentTime: Math.min(duration, Math.max(0, t)) });
    },

    setTrailMode(mode) {
      set({ trailMode: mode });
    },

    setWindowSeconds(seconds) {
      set({ windowSeconds: Math.max(5, seconds) });
    },

    setHeatmapKind(kind) {
      set({ heatmapKind: kind });
      if (kind === "none") {
        set({ heatmap: null, heatmapStatus: "idle" });
      } else {
        void loadHeatmap(get().mapId, kind);
      }
    },

    setHeatmapOpacity(value) {
      set({ heatmapOpacity: Math.min(1, Math.max(0, value)) });
    },

    resetFilters() {
      set({
        entity: DEFAULTS.entity,
        categories: { ...ALL_CATEGORIES_ON },
        focusPlayerId: null,
        trackOpacity: DEFAULTS.trackOpacity,
        trailMode: DEFAULTS.trailMode,
        windowSeconds: DEFAULTS.windowSeconds,
        speed: DEFAULTS.speed,
        heatmapKind: "none",
        heatmap: null,
        heatmapStatus: "idle",
        heatmapOpacity: DEFAULTS.heatmapOpacity,
        currentTime: 0,
        isPlaying: false,
      });
    },
  };
});
