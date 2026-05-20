"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { IconBolt, IconTarget } from "./icons";
import { InsightsModal } from "./InsightsModal";

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="tabular text-sm font-semibold text-ink">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
    </div>
  );
}

export function Header() {
  const manifest = useStore((s) => s.manifest);
  const totals = manifest?.totals;
  const [showInsights, setShowInsights] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-brand/15 text-brand">
            <IconTarget size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-ink">
                Player Journey Visualizer
              </h1>
              <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                LILA BLACK
              </span>
            </div>
            <p className="text-[11px] text-ink-faint">
              {manifest?.dataset ?? "Loading production telemetry…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {totals ? (
            <div className="hidden items-center gap-6 md:flex">
              <HeaderStat label="Matches" value={formatNumber(totals.matches)} />
              <HeaderStat
                label="Players"
                value={formatNumber(totals.humanPlayers)}
              />
              <HeaderStat label="Bots" value={formatNumber(totals.bots)} />
              <HeaderStat
                label="Telemetry rows"
                value={formatNumber(totals.rows)}
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowInsights(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-brand-dim bg-brand/15 px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/25"
          >
            <IconBolt size={13} />
            Insights
          </button>
        </div>
      </header>

      <InsightsModal
        open={showInsights}
        onClose={() => setShowInsights(false)}
      />
    </>
  );
}
