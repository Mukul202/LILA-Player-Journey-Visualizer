"use client";

import { EVENT_CATEGORIES } from "@/lib/data-types";
import { CATEGORY_LABEL } from "@/lib/colors";
import { CategoryGlyph, PathSwatch } from "./glyphs";

/** Compact, non-interactive legend that floats over the map. */
export function Legend() {
  return (
    <div className="pointer-events-none select-none rounded-lg border border-edge bg-panel/90 px-3 py-2.5 shadow-panel backdrop-blur-sm">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Legend
      </div>
      <div className="mb-2 flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <PathSwatch isBot={false} />
          <span className="text-[11px] text-ink-dim">Human</span>
        </span>
        <span className="flex items-center gap-1.5">
          <PathSwatch isBot />
          <span className="text-[11px] text-ink-dim">Bot</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {EVENT_CATEGORIES.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <CategoryGlyph category={c} size={14} />
            <span className="text-[11px] text-ink-dim">{CATEGORY_LABEL[c]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
