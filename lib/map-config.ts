/**
 * Static map metadata for LILA BLACK, taken directly from the dataset README.
 *
 * The game world is 3D. The horizontal plane the minimap represents is (x, z);
 * the `y` column is elevation/height and is intentionally NOT used for 2D plotting.
 *
 * World -> minimap conversion (see lib/coordinates.ts):
 *   u = (x - originX) / scale
 *   v = (z - originZ) / scale
 *   pixelX = u * imageSize
 *   pixelY = (1 - v) * imageSize        // y flipped: image origin is top-left
 */

export interface MapConfig {
  /** Matches the `map_id` column in the telemetry. */
  id: string;
  /** Human-friendly display name. */
  name: string;
  /** World units spanned by the map along each axis. */
  scale: number;
  /** World X at the left edge of the minimap. */
  originX: number;
  /** World Z at the bottom edge of the minimap. */
  originZ: number;
  /** Source minimap file inside player_data/minimaps. */
  minimapSource: string;
  /** Short blurb shown in the UI. */
  blurb: string;
}

export const MAP_CONFIGS: Record<string, MapConfig> = {
  AmbroseValley: {
    id: "AmbroseValley",
    name: "Ambrose Valley",
    scale: 900,
    originX: -370,
    originZ: -473,
    minimapSource: "AmbroseValley_Minimap.png",
    blurb: "Primary / most-played map.",
  },
  GrandRift: {
    id: "GrandRift",
    name: "Grand Rift",
    scale: 581,
    originX: -290,
    originZ: -290,
    minimapSource: "GrandRift_Minimap.png",
    blurb: "Secondary map.",
  },
  Lockdown: {
    id: "Lockdown",
    name: "Lockdown",
    scale: 1000,
    originX: -500,
    originZ: -500,
    minimapSource: "Lockdown_Minimap.jpg",
    blurb: "Smaller close-quarters map.",
  },
};

export const MAP_IDS = Object.keys(MAP_CONFIGS);

/**
 * Side length of the square minimap PNGs served to the client.
 *
 * The README documents the minimaps as 1024x1024 and its coordinate formula
 * multiplies UV by 1024. The raw source images are actually much larger
 * (4320px, 2160px, 9000px) and not always perfectly square, so the
 * preprocessing step resizes every minimap to this fixed square size. That
 * keeps the documented coordinate space exact and keeps payloads small.
 */
export const MINIMAP_SIZE = 1024;

export function getMapConfig(mapId: string): MapConfig | undefined {
  return MAP_CONFIGS[mapId];
}
