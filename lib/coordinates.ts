/**
 * World <-> minimap coordinate conversion.
 *
 * The transform is defined by the LILA BLACK dataset README:
 *
 *   Step 1 - world coords to UV (0..1):
 *     u = (x - originX) / scale
 *     v = (z - originZ) / scale
 *
 *   Step 2 - UV to image pixels:
 *     pixelX = u * imageWidth
 *     pixelY = (1 - v) * imageHeight   // y is flipped: image origin is top-left,
 *                                      //   world origin is bottom-left
 *
 * Only the (x, z) world columns are used. The `y` column is elevation.
 *
 * `worldBounds` is the axis-aligned world rectangle the minimap covers, i.e.
 *   minX = originX, maxX = originX + scale
 *   minZ = originZ, maxZ = originZ + scale
 */

import type { MapConfig } from "./map-config";

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MinimapTarget {
  imageWidth: number;
  imageHeight: number;
  worldBounds: WorldBounds;
}

export interface Point2D {
  x: number;
  y: number;
}

/** Derive the world rectangle a map covers from its scale + origin. */
export function worldBoundsFromConfig(config: MapConfig): WorldBounds {
  return {
    minX: config.originX,
    maxX: config.originX + config.scale,
    minZ: config.originZ,
    maxZ: config.originZ + config.scale,
  };
}

/**
 * Convert a world (x, z) position into minimap image pixel coordinates.
 * The result is in the image's pixel space (origin top-left, y grows down).
 * Values may fall outside [0, imageSize] if the position is off-map; callers
 * decide whether to clamp (markers) or clip (paths).
 */
export function worldToMinimap(
  worldX: number,
  worldZ: number,
  target: MinimapTarget,
): Point2D {
  const { minX, maxX, minZ, maxZ } = target.worldBounds;
  const u = (worldX - minX) / (maxX - minX);
  const v = (worldZ - minZ) / (maxZ - minZ);
  return {
    x: u * target.imageWidth,
    y: (1 - v) * target.imageHeight,
  };
}

/** True if a world position lies inside the map's documented bounds. */
export function isWithinWorldBounds(
  worldX: number,
  worldZ: number,
  bounds: WorldBounds,
): boolean {
  return (
    worldX >= bounds.minX &&
    worldX <= bounds.maxX &&
    worldZ >= bounds.minZ &&
    worldZ <= bounds.maxZ
  );
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Round to a fixed number of decimals to keep generated JSON compact. */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
