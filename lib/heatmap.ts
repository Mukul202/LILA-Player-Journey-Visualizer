/**
 * Heatmap rendering.
 *
 * The preprocessing step produces a sparse 64x64 count grid per (map, kind).
 * Rendering technique: paint the grid 1px-per-cell into a tiny offscreen
 * canvas, colorized through a per-kind gradient LUT, then draw it scaled up
 * with bilinear smoothing + a blur filter. The upscale + blur turns the
 * blocky grid into a smooth heat field. This runs only when the heatmap or
 * viewport changes — never per animation frame.
 */

import type { HeatmapGrid, HeatmapKind } from "./data-types";
import type { View } from "./view";

/** Gradient stops: [position 0..1, [r, g, b, a]]. */
type Ramp = [number, [number, number, number, number]][];

const RAMPS: Record<HeatmapKind, Ramp> = {
  traffic: [
    [0.0, [20, 40, 90, 0]],
    [0.15, [20, 70, 150, 90]],
    [0.4, [10, 150, 185, 170]],
    [0.65, [120, 205, 95, 210]],
    [0.85, [250, 200, 60, 236]],
    [1.0, [245, 90, 80, 255]],
  ],
  kills: [
    [0.0, [80, 15, 15, 0]],
    [0.2, [150, 30, 30, 120]],
    [0.5, [226, 55, 45, 205]],
    [0.78, [250, 120, 60, 236]],
    [1.0, [255, 235, 150, 255]],
  ],
  deaths: [
    [0.0, [30, 40, 62, 0]],
    [0.2, [72, 92, 124, 110]],
    [0.5, [140, 162, 192, 195]],
    [0.8, [212, 222, 236, 236]],
    [1.0, [255, 255, 255, 255]],
  ],
  loot: [
    [0.0, [70, 45, 8, 0]],
    [0.2, [172, 112, 22, 120]],
    [0.5, [236, 162, 36, 208]],
    [0.8, [250, 206, 82, 238]],
    [1.0, [255, 248, 212, 255]],
  ],
};

const lutCache = new Map<HeatmapKind, Uint8ClampedArray>();

/** Build (and cache) a 256-entry RGBA lookup table for a heatmap kind. */
function getLUT(kind: HeatmapKind): Uint8ClampedArray {
  const cached = lutCache.get(kind);
  if (cached) return cached;

  const ramp = RAMPS[kind];
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];
    for (let s = 0; s < ramp.length - 1; s++) {
      if (t >= ramp[s][0] && t <= ramp[s + 1][0]) {
        lo = ramp[s];
        hi = ramp[s + 1];
        break;
      }
    }
    const span = hi[0] - lo[0] || 1;
    const f = (t - lo[0]) / span;
    for (let c = 0; c < 4; c++) {
      lut[i * 4 + c] = lo[1][c] + (hi[1][c] - lo[1][c]) * f;
    }
  }
  lutCache.set(kind, lut);
  return lut;
}

export interface HeatmapStat {
  hotCells: number;
  total: number;
  peak: number;
}

/**
 * Draw a heatmap grid onto a 2D context already scaled to CSS pixels.
 * `view` maps image space to CSS pixels; `imageSize` is the minimap side.
 */
export function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  grid: HeatmapGrid,
  kind: HeatmapKind,
  opacity: number,
  view: View,
  imageSize: number,
): void {
  const n = grid.grid;
  if (n <= 0 || grid.cells.length === 0) return;

  const tiny = document.createElement("canvas");
  tiny.width = n;
  tiny.height = n;
  const tctx = tiny.getContext("2d");
  if (!tctx) return;

  const lut = getLUT(kind);
  const max = grid.max || 1;

  for (let i = 0; i < grid.cells.length; i += 3) {
    const col = grid.cells[i];
    const row = grid.cells[i + 1];
    const count = grid.cells[i + 2];
    // Gamma lift so low-traffic cells remain visible against hotspots.
    const v = Math.pow(count / max, 0.55);
    const idx = Math.min(255, Math.max(0, Math.round(v * 255))) * 4;
    tctx.fillStyle = `rgba(${lut[idx]},${lut[idx + 1]},${lut[idx + 2]},${lut[idx + 3] / 255})`;
    tctx.fillRect(col, row, 1, 1);
  }

  const span = imageSize * view.scale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "blur(7px)";
  ctx.drawImage(tiny, view.offsetX, view.offsetY, span, span);
  ctx.restore();
}
