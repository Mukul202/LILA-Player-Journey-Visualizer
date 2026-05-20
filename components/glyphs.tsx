/** SVG renditions of the canvas event markers, for the legend and filters. */

import type { EventCategory } from "@/lib/data-types";
import { CATEGORY_COLOR } from "@/lib/colors";

const STORM_STAR =
  "M12 3 L14.55 9.45 L21 12 L14.55 14.55 L12 21 L9.45 14.55 L3 12 L9.45 9.45 Z";

export function CategoryGlyph({
  category,
  size = 16,
}: {
  category: EventCategory;
  size?: number;
}) {
  const color = CATEGORY_COLOR[category];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {category === "kill" && (
        <path
          d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5"
          stroke={color}
          strokeWidth={3.2}
          strokeLinecap="round"
        />
      )}
      {category === "death" && (
        <>
          <circle
            cx="12"
            cy="12"
            r="6.4"
            fill="none"
            stroke={color}
            strokeWidth={2.6}
          />
          <circle cx="12" cy="12" r="2.1" fill={color} />
        </>
      )}
      {category === "storm" && <path d={STORM_STAR} fill={color} />}
      {category === "loot" && (
        <path d="M12 3L21 12L12 21L3 12Z" fill={color} />
      )}
    </svg>
  );
}

/** A short line swatch showing the human (solid) / bot (dashed) path style. */
export function PathSwatch({ isBot }: { isBot: boolean }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
      <line
        x1="1"
        y1="5"
        x2="21"
        y2="5"
        stroke={isBot ? "#8b97a8" : "#22d3ee"}
        strokeWidth={isBot ? 2 : 2.6}
        strokeLinecap="round"
        strokeDasharray={isBot ? "4 3" : undefined}
      />
    </svg>
  );
}
