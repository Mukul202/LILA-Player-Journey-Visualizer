/**
 * The map viewport transform: a uniform scale plus a pan offset that maps
 * minimap image space (0..imageSize) to on-screen CSS pixels. Shared by the
 * canvas renderer, the heatmap renderer and MapViewer's pan/zoom handlers.
 */

export interface View {
  /** image-space pixels -> CSS pixels multiplier. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Pt {
  x: number;
  y: number;
}

export function imageToScreen(mx: number, my: number, v: View): Pt {
  return { x: mx * v.scale + v.offsetX, y: my * v.scale + v.offsetY };
}

export function screenToImage(sx: number, sy: number, v: View): Pt {
  return { x: (sx - v.offsetX) / v.scale, y: (sy - v.offsetY) / v.scale };
}

/** A view that exactly fits a square image into a square CSS box. */
export function fitView(cssSize: number, imageSize: number): View {
  return { scale: cssSize / imageSize, offsetX: 0, offsetY: 0 };
}

export const MAX_ZOOM = 8;

/**
 * Clamp a view so the image cannot be zoomed out past "fit" or panned
 * entirely off-screen.
 */
export function clampView(v: View, cssSize: number, imageSize: number): View {
  const minScale = cssSize / imageSize;
  const scale = Math.min(minScale * MAX_ZOOM, Math.max(minScale, v.scale));
  const span = imageSize * scale;
  // Allowed offset range keeps the image covering the box.
  const lo = cssSize - span;
  const offsetX = Math.min(0, Math.max(lo, v.offsetX));
  const offsetY = Math.min(0, Math.max(lo, v.offsetY));
  return { scale, offsetX, offsetY };
}

/** Zoom by `factor` around a focal screen point (e.g. the cursor). */
export function zoomAround(
  v: View,
  factor: number,
  focusX: number,
  focusY: number,
  cssSize: number,
  imageSize: number,
): View {
  const img = screenToImage(focusX, focusY, v);
  const scale = v.scale * factor;
  const next: View = {
    scale,
    offsetX: focusX - img.x * scale,
    offsetY: focusY - img.y * scale,
  };
  return clampView(next, cssSize, imageSize);
}
