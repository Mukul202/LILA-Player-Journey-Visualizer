/**
 * Pure playback math: interpolating a player's position at an arbitrary time,
 * deriving trail segments, and windowing events. No React, no canvas.
 */

import type { GameEvent, PlayerTrack } from "./data-types";

/** How much of each player's path to draw relative to the playhead. */
export type TrailMode = "full" | "progressive" | "window";

export interface PlayheadPosition {
  mx: number;
  my: number;
  /** currentTime is past the track's last sample — player is inactive. */
  stale: boolean;
  /** currentTime is before the track's first sample — player not yet seen. */
  pending: boolean;
}

export interface TrailPoint {
  mx: number;
  my: number;
}

/**
 * Interpolated minimap position of a player at time `t` (seconds from match
 * start). Linear interpolation between the two surrounding samples. Returns
 * null only when the track has no samples at all.
 */
export function getPlayheadPosition(
  track: PlayerTrack,
  t: number,
): PlayheadPosition | null {
  const pts = track.points;
  if (pts.length === 0) return null;

  const first = pts[0];
  if (t <= first.t) {
    return { mx: first.mx, my: first.my, stale: false, pending: t < first.t };
  }
  const last = pts[pts.length - 1];
  if (t >= last.t) {
    return { mx: last.mx, my: last.my, stale: t > last.t, pending: false };
  }

  // Binary search for the segment [lo, hi] containing t.
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const span = b.t - a.t;
  const f = span > 0 ? (t - a.t) / span : 0;
  return {
    mx: a.mx + (b.mx - a.mx) * f,
    my: a.my + (b.my - a.my) * f,
    stale: false,
    pending: false,
  };
}

/**
 * The polyline to draw for a track's trail at time `t`:
 *  - full:        the entire recorded path
 *  - progressive: from match start up to `t`
 *  - window:      only the last `windowSeconds` up to `t`
 * For progressive/window the trail ends exactly at the interpolated current
 * position so it visually connects to the playhead.
 */
export function getTrailPoints(
  track: PlayerTrack,
  t: number,
  mode: TrailMode,
  windowSeconds: number,
): TrailPoint[] {
  const pts = track.points;
  if (pts.length === 0) return [];
  if (mode === "full") return pts.map((p) => ({ mx: p.mx, my: p.my }));

  const from = mode === "window" ? t - windowSeconds : -Infinity;
  const trail: TrailPoint[] = [];
  for (const p of pts) {
    if (p.t >= from && p.t <= t) trail.push({ mx: p.mx, my: p.my });
  }
  const head = getPlayheadPosition(track, t);
  if (head && !head.pending) {
    const tail = trail[trail.length - 1];
    if (!tail || tail.mx !== head.mx || tail.my !== head.my) {
      trail.push({ mx: head.mx, my: head.my });
    }
  }
  return trail;
}

/**
 * Events to display for the current trail mode. `full` shows every event;
 * `progressive`/`window` reveal events as the playhead reaches them.
 * `events` is assumed pre-sorted by `t` (preprocess guarantees this).
 */
export function getVisibleEvents(
  events: GameEvent[],
  t: number,
  mode: TrailMode,
  windowSeconds: number,
): GameEvent[] {
  if (mode === "full") return events;
  const from = mode === "window" ? t - windowSeconds : -Infinity;
  const out: GameEvent[] = [];
  for (const e of events) {
    if (e.t > t) break;
    if (e.t >= from) out.push(e);
  }
  return out;
}

/** Whether a track has samples bracketing time `t`. */
export function isTrackActive(track: PlayerTrack, t: number): boolean {
  return (
    track.points.length > 0 && t >= track.firstT && t <= track.lastT
  );
}

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10] as const;
