"use client";

/**
 * Right panel: a summary of the selected match plus a clickable player roster.
 * Clicking a player isolates ("focuses") them across the whole view.
 */

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/data-types";
import { CATEGORY_LABEL } from "@/lib/colors";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { Panel, SectionLabel, Spinner, Stat } from "./controls";
import { CategoryGlyph } from "./glyphs";

export function MatchStats() {
  const match = useStore((s) => s.match);
  const matchStatus = useStore((s) => s.matchStatus);
  const manifest = useStore((s) => s.manifest);
  const focusPlayerId = useStore((s) => s.focusPlayerId);
  const setFocusPlayer = useStore((s) => s.setFocusPlayer);

  const counts = useMemo(() => {
    const c: Record<EventCategory, number> = { kill: 0, death: 0, storm: 0, loot: 0 };
    if (match) for (const e of match.events) c[e.category] += 1;
    return c;
  }, [match]);

  if (matchStatus === "loading" || !match) {
    return (
      <Panel className="flex h-40 items-center justify-center">
        {matchStatus === "error" ? (
          <p className="text-sm text-ev-kill">Failed to load match.</p>
        ) : (
          <Spinner />
        )}
      </Panel>
    );
  }

  const mapName =
    manifest?.maps.find((m) => m.id === match.mapId)?.name ?? match.mapId;
  const humans = match.players.filter((p) => !p.isBot);
  const bots = match.players.filter((p) => p.isBot);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Panel className="p-3">
        <SectionLabel>Selected match</SectionLabel>
        <div className="mb-2">
          <div className="font-mono text-xs text-ink-dim">
            {match.matchId.replace(".nakama-0", "")}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-ink">
            {mapName}
            <span className="text-ink-faint"> · {formatDate(match.date)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Duration" value={formatDuration(match.durationSeconds)} />
          <Stat label="Events" value={formatNumber(match.events.length)} />
          <Stat label="Humans" value={String(humans.length)} accent="#22d3ee" />
          <Stat label="Bots" value={String(bots.length)} accent="#8b97a8" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {EVENT_CATEGORIES.map((c) => (
            <div
              key={c}
              className="flex items-center gap-1.5 rounded-md border border-edge-soft bg-panel-raised px-2 py-1"
            >
              <CategoryGlyph category={c} size={13} />
              <span className="flex-1 text-[11px] text-ink-dim">
                {CATEGORY_LABEL[c]}
              </span>
              <span className="tabular text-xs font-semibold text-ink">
                {counts[c]}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-1 flex-col p-3">
        <SectionLabel
          right={
            focusPlayerId ? (
              <button
                type="button"
                onClick={() => setFocusPlayer(null)}
                className="text-[11px] font-medium text-brand hover:underline"
              >
                Show all
              </button>
            ) : (
              <span className="text-[11px] text-ink-faint">
                {match.players.length} total
              </span>
            )
          }
        >
          Player roster
        </SectionLabel>
        <p className="mb-2 text-[11px] text-ink-faint">
          Click to isolate a single journey.
        </p>
        <div className="-mr-1 flex flex-col gap-0.5 overflow-y-auto pr-1">
          {match.players.map((p) => {
            const active = focusPlayerId === p.playerId;
            return (
              <button
                key={p.playerId}
                type="button"
                onClick={() =>
                  setFocusPlayer(active ? null : p.playerId)
                }
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                  active
                    ? "border-brand-dim bg-brand/10"
                    : "border-transparent hover:bg-panel-hover"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.isBot ? "#8b97a8" : "#22d3ee" }}
                />
                <span className="flex-1 truncate text-xs text-ink">
                  {p.label}
                </span>
                <span className="tabular text-[10px] text-ink-faint">
                  {p.points.length} pts
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
