/**
 * Canvas overlay renderer: player journey trails, live playheads and event
 * markers. Pure drawing — all state is passed in. `renderOverlay` runs once
 * per animation frame; the context is assumed pre-scaled to CSS pixels.
 */

import { COLORS } from "./colors";
import type { EventCategory, GameEvent, PlayerTrack } from "./data-types";
import {
  getPlayheadPosition,
  getTrailPoints,
  getVisibleEvents,
  type TrailMode,
} from "./playback";
import { imageToScreen, type View } from "./view";

export interface OverlayParams {
  width: number;
  height: number;
  view: View;
  /** Tracks already filtered by entity/focus. */
  tracks: PlayerTrack[];
  /** Events already filtered by category/entity/focus (not time-windowed). */
  events: GameEvent[];
  time: number;
  trailMode: TrailMode;
  windowSeconds: number;
  trackOpacity: number;
  focusPlayerId: string | null;
  hoveredEventId: string | null;
}

const CATEGORY_COLOR: Record<EventCategory, string> = {
  kill: COLORS.kill,
  death: COLORS.death,
  storm: COLORS.storm,
  loot: COLORS.loot,
};

/* ------------------------------- journeys -------------------------------- */

function drawTrack(
  ctx: CanvasRenderingContext2D,
  track: PlayerTrack,
  params: OverlayParams,
) {
  const trail = getTrailPoints(
    track,
    params.time,
    params.trailMode,
    params.windowSeconds,
  );
  if (trail.length < 2) return;

  const focused = params.focusPlayerId === track.playerId;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = track.isBot
    ? params.trackOpacity * 0.62
    : params.trackOpacity;
  ctx.strokeStyle = track.isBot ? COLORS.bot : COLORS.human;
  ctx.lineWidth = focused ? 3 : track.isBot ? 1.3 : 2;
  if (track.isBot) ctx.setLineDash([5, 5]);
  if (focused) {
    ctx.shadowColor = track.isBot ? COLORS.botGlow : COLORS.humanGlow;
    ctx.shadowBlur = 10;
  }

  ctx.beginPath();
  for (let i = 0; i < trail.length; i++) {
    const p = imageToScreen(trail[i].mx, trail[i].my, params.view);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------- playheads ------------------------------- */

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  track: PlayerTrack,
  params: OverlayParams,
) {
  const head = getPlayheadPosition(track, params.time);
  if (!head || head.pending) return; // not spawned yet

  const { x, y } = imageToScreen(head.mx, head.my, params.view);
  const focused = params.focusPlayerId === track.playerId;
  const color = track.isBot ? COLORS.bot : COLORS.human;
  const r = focused ? 6.5 : track.isBot ? 3.6 : 5;

  ctx.save();
  if (head.stale) {
    // Inactive — hollow, dim.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Soft halo.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fill();
    // Core dot.
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // White rim.
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = focused ? 2 : 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ----------------------------- event markers ----------------------------- */

function markerGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  category: EventCategory,
  r: number,
) {
  const color = CATEGORY_COLOR[category];
  // Dark halo for contrast against the detailed minimap.
  ctx.fillStyle = "rgba(7,9,13,0.62)";
  ctx.beginPath();
  ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (category) {
    case "kill": {
      // X mark.
      const d = r * 0.92;
      ctx.beginPath();
      ctx.moveTo(x - d, y - d);
      ctx.lineTo(x + d, y + d);
      ctx.moveTo(x + d, y - d);
      ctx.lineTo(x - d, y + d);
      ctx.stroke();
      break;
    }
    case "death": {
      // Hollow ring with a center dot.
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "storm": {
      // 4-point spark.
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4 - Math.PI / 2;
        const rad = k % 2 === 0 ? r * 1.15 : r * 0.4;
        const px = x + Math.cos(ang) * rad;
        const py = y + Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "loot": {
      // Diamond.
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

function drawEventMarker(
  ctx: CanvasRenderingContext2D,
  event: GameEvent,
  params: OverlayParams,
) {
  const { x, y } = imageToScreen(event.mx, event.my, params.view);
  const hovered = params.hoveredEventId === event.id;
  const r = hovered ? 9.5 : 6;

  ctx.save();
  if (hovered) {
    ctx.shadowColor = CATEGORY_COLOR[event.category];
    ctx.shadowBlur = 14;
  }
  markerGlyph(ctx, x, y, event.category, r);
  ctx.restore();
}

/* --------------------------------- main ---------------------------------- */

/**
 * Render the whole overlay for one frame. Returns the events actually drawn
 * (after time-windowing) so the caller can reuse them for hover hit-testing.
 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  params: OverlayParams,
): GameEvent[] {
  ctx.clearRect(0, 0, params.width, params.height);

  // Journeys: bots first, humans on top.
  const bots = params.tracks.filter((t) => t.isBot);
  const humans = params.tracks.filter((t) => !t.isBot);
  for (const t of bots) drawTrack(ctx, t, params);
  for (const t of humans) drawTrack(ctx, t, params);

  // Event markers (time-windowed).
  const drawn = getVisibleEvents(
    params.events,
    params.time,
    params.trailMode,
    params.windowSeconds,
  );
  for (const e of drawn) {
    if (params.hoveredEventId === e.id) continue; // hovered drawn last
    drawEventMarker(ctx, e, params);
  }

  // Playheads on top so live positions are never hidden.
  for (const t of bots) drawPlayhead(ctx, t, params);
  for (const t of humans) drawPlayhead(ctx, t, params);

  // Hovered marker last, above everything.
  const hovered = drawn.find((e) => e.id === params.hoveredEventId);
  if (hovered) drawEventMarker(ctx, hovered, params);

  return drawn;
}

/** Find the visible event closest to a screen point, within `radiusPx`. */
export function hitTestEvents(
  events: GameEvent[],
  screenX: number,
  screenY: number,
  view: View,
  radiusPx = 11,
): GameEvent | null {
  let best: GameEvent | null = null;
  let bestDist = radiusPx * radiusPx;
  for (const e of events) {
    const p = imageToScreen(e.mx, e.my, view);
    const dx = p.x - screenX;
    const dy = p.y - screenY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestDist) {
      bestDist = d2;
      best = e;
    }
  }
  return best;
}
