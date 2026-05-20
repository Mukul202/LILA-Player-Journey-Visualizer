"use client";

/**
 * Bottom playback bar: transport controls, a scrubber with per-event ticks,
 * a clock, speed selection and trail-mode controls.
 *
 * Subscribes to `currentTime`, so it re-renders every animation frame during
 * playback. The event ticks are memoized on `match` so that stays cheap.
 */

import { useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_COLOR } from "@/lib/colors";
import { formatClock } from "@/lib/format";
import { PLAYBACK_SPEEDS, type TrailMode } from "@/lib/playback";
import { IconButton, Segmented, Slider } from "./controls";
import { IconPause, IconPlay, IconRewind } from "./icons";

function Scrubber() {
  const match = useStore((s) => s.match);
  const currentTime = useStore((s) => s.currentTime);
  const setCurrentTime = useStore((s) => s.setCurrentTime);
  const pause = useStore((s) => s.pause);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = match?.durationSeconds ?? 0;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const ticks = useMemo(() => {
    if (!match || match.durationSeconds <= 0) return null;
    return match.events.map((e) => (
      <span
        key={e.id}
        className="pointer-events-none absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full"
        style={{
          left: `${(e.t / match.durationSeconds) * 100}%`,
          background: CATEGORY_COLOR[e.category],
          opacity: 0.7,
        }}
      />
    ));
  }, [match]);

  function seekToClientX(clientX: number) {
    const el = trackRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setCurrentTime(f * duration);
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (duration <= 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pause();
          seekToClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            seekToClientX(e.clientX);
          }
        }}
        className="group relative h-6 flex-1 cursor-pointer"
      >
        {/* track */}
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-panel-raised" />
        {/* progress */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand/45"
          style={{ width: `${pct}%` }}
        />
        {/* event ticks */}
        {ticks}
        {/* thumb */}
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-brand shadow-glow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="tabular shrink-0 text-xs text-ink-dim">
        <span className="font-semibold text-ink">{formatClock(currentTime)}</span>
        <span className="text-ink-faint"> / {formatClock(duration)}</span>
      </div>
    </div>
  );
}

export function Timeline() {
  const match = useStore((s) => s.match);
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const trailMode = useStore((s) => s.trailMode);
  const windowSeconds = useStore((s) => s.windowSeconds);
  const togglePlay = useStore((s) => s.togglePlay);
  const setSpeed = useStore((s) => s.setSpeed);
  const setCurrentTime = useStore((s) => s.setCurrentTime);
  const setTrailMode = useStore((s) => s.setTrailMode);
  const setWindowSeconds = useStore((s) => s.setWindowSeconds);

  const ready = !!match && match.durationSeconds > 0;

  return (
    <div className="shrink-0 border-t border-edge bg-panel px-4 py-2.5">
      <div className="flex items-center gap-3">
        <IconButton
          title={isPlaying ? "Pause" : "Play"}
          onClick={togglePlay}
          disabled={!ready}
          active={isPlaying}
          className="h-9 w-9"
        >
          {isPlaying ? <IconPause size={16} /> : <IconPlay size={16} />}
        </IconButton>
        <IconButton
          title="Restart"
          onClick={() => setCurrentTime(0)}
          disabled={!ready}
          className="h-9 w-9"
        >
          <IconRewind size={15} />
        </IconButton>
        <Scrubber />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Speed
          </span>
          <div className="w-[200px]">
            <Segmented<string>
              value={String(speed)}
              onChange={(v) => setSpeed(Number(v))}
              options={PLAYBACK_SPEEDS.map((s) => ({
                value: String(s),
                label: `${s}×`,
              }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            Trail
          </span>
          <div className="w-[230px]">
            <Segmented<TrailMode>
              value={trailMode}
              onChange={setTrailMode}
              options={[
                { value: "full", label: "Full" },
                { value: "progressive", label: "Progressive" },
                { value: "window", label: "Window" },
              ]}
            />
          </div>
        </div>

        {trailMode === "window" ? (
          <div className="w-[180px]">
            <Slider
              label="Trail window"
              value={windowSeconds}
              min={10}
              max={240}
              step={5}
              onChange={setWindowSeconds}
              display={`${windowSeconds}s`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
