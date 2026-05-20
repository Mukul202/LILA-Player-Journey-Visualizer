"use client";

/**
 * The map canvas: a stack of three <canvas> layers (minimap background,
 * heatmap, animated overlay) plus pan/zoom, hover tooltips and the legend.
 *
 * Only the overlay redraws per frame, driven by a single requestAnimationFrame
 * loop that also advances playback (`tick`). The loop reads state imperatively
 * via the store + refs, so this component does NOT re-render every frame.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { MINIMAP_SIZE } from "@/lib/map-config";
import type { GameEvent } from "@/lib/data-types";
import { CATEGORY_LABEL } from "@/lib/colors";
import { visibleEvents, visibleTracks } from "@/lib/filters";
import { drawHeatmap } from "@/lib/heatmap";
import {
  hitTestEvents,
  renderOverlay,
  type OverlayParams,
} from "@/lib/render";
import {
  clampView,
  fitView,
  imageToScreen,
  zoomAround,
  type View,
} from "@/lib/view";
import { formatClock, formatEventName } from "@/lib/format";
import { IconButton, Spinner } from "./controls";
import { CategoryGlyph } from "./glyphs";
import { Legend } from "./Legend";
import { IconRecenter, IconZoomIn, IconZoomOut } from "./icons";

const IMAGE_SIZE = MINIMAP_SIZE;

export function MapViewer() {
  const match = useStore((s) => s.match);
  const matchStatus = useStore((s) => s.matchStatus);
  const manifest = useStore((s) => s.manifest);
  const mapId = useStore((s) => s.mapId);
  const entity = useStore((s) => s.entity);
  const categories = useStore((s) => s.categories);
  const focusPlayerId = useStore((s) => s.focusPlayerId);
  const trailMode = useStore((s) => s.trailMode);
  const windowSeconds = useStore((s) => s.windowSeconds);
  const trackOpacity = useStore((s) => s.trackOpacity);
  const heatmap = useStore((s) => s.heatmap);
  const heatmapKind = useStore((s) => s.heatmapKind);
  const heatmapOpacity = useStore((s) => s.heatmapOpacity);
  const heatmapStatus = useStore((s) => s.heatmapStatus);

  const containerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const paramsRef = useRef<OverlayParams | null>(null);
  const drawnEventsRef = useRef<GameEvent[]>([]);
  const dirtyRef = useRef(true);
  const lastTimeRef = useRef(-1);
  const viewRef = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const sizeRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0, y: 0 });

  const [size, setSize] = useState(0);
  const [view, setView] = useState<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [hovered, setHovered] = useState<GameEvent | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const mapManifest = manifest?.maps.find((m) => m.id === mapId);
  const imageUrl = mapManifest?.imageUrl;

  const tracks = useMemo(
    () =>
      match
        ? visibleTracks(match, { entity, categories, focusPlayerId })
        : [],
    [match, entity, categories, focusPlayerId],
  );
  const events = useMemo(
    () =>
      match
        ? visibleEvents(match, { entity, categories, focusPlayerId })
        : [],
    [match, entity, categories, focusPlayerId],
  );

  /* ---- container measurement ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entriesList) => {
      const r = entriesList[0].contentRect;
      const next = Math.max(0, Math.floor(Math.min(r.width, r.height)));
      setSize(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- fit view on resize / map change ---- */
  useEffect(() => {
    if (size > 0) setView(fitView(size, IMAGE_SIZE));
  }, [size, mapId]);

  /* ---- load the minimap image ---- */
  useEffect(() => {
    if (!imageUrl) return;
    setImageReady(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageReady(true);
    };
    img.src = imageUrl;
    return () => {
      img.onload = null;
    };
  }, [imageUrl]);

  /* ---- (re)size the canvas layers for the current DPR ---- */
  useEffect(() => {
    if (size <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    for (const ref of [bgRef, heatRef, overlayRef]) {
      const c = ref.current;
      if (!c) continue;
      c.width = Math.round(size * dpr);
      c.height = Math.round(size * dpr);
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    dirtyRef.current = true;
  }, [size]);

  /* ---- draw minimap background ---- */
  useEffect(() => {
    const c = bgRef.current;
    if (!c || size <= 0) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0a0e15";
    ctx.fillRect(0, 0, size, size);
    const img = imgRef.current;
    if (img && imageReady) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        img,
        view.offsetX,
        view.offsetY,
        IMAGE_SIZE * view.scale,
        IMAGE_SIZE * view.scale,
      );
    }
  }, [size, view, imageReady]);

  /* ---- draw heatmap layer ---- */
  useEffect(() => {
    const c = heatRef.current;
    if (!c || size <= 0) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    if (
      heatmap &&
      heatmapKind !== "none" &&
      heatmap.kind === heatmapKind &&
      heatmap.mapId === mapId
    ) {
      drawHeatmap(ctx, heatmap, heatmapKind, heatmapOpacity, view, IMAGE_SIZE);
    }
  }, [size, view, heatmap, heatmapKind, heatmapOpacity, mapId]);

  /* ---- keep overlay render params fresh ---- */
  useEffect(() => {
    paramsRef.current = {
      width: size,
      height: size,
      view,
      tracks,
      events,
      time: 0,
      trailMode,
      windowSeconds,
      trackOpacity,
      focusPlayerId,
      hoveredEventId: hovered?.id ?? null,
    };
    dirtyRef.current = true;
  }, [
    size,
    view,
    tracks,
    events,
    trailMode,
    windowSeconds,
    trackOpacity,
    focusPlayerId,
    hovered,
  ]);

  /* ---- single animation loop: advance playback + draw overlay ---- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      useStore.getState().tick(dt);

      const p = paramsRef.current;
      const ctx = overlayRef.current?.getContext("2d");
      if (p && ctx && p.width > 0) {
        const time = useStore.getState().currentTime;
        if (dirtyRef.current || time !== lastTimeRef.current) {
          drawnEventsRef.current = renderOverlay(ctx, { ...p, time });
          lastTimeRef.current = time;
          dirtyRef.current = false;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---- wheel zoom (non-passive so it can preventDefault) ---- */
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sz = sizeRef.current;
      if (sz <= 0) return;
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setView((v) =>
        zoomAround(
          v,
          factor,
          e.clientX - rect.left,
          e.clientY - rect.top,
          sz,
          IMAGE_SIZE,
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---- pointer pan + hover hit-testing ---- */
  function onPointerDown(e: React.PointerEvent) {
    overlayRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag.active) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (dx !== 0 || dy !== 0) {
        setView((v) =>
          clampView(
            { ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy },
            sizeRef.current,
            IMAGE_SIZE,
          ),
        );
        if (hovered) setHovered(null);
      }
      return;
    }
    const canvas = overlayRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTestEvents(
      drawnEventsRef.current,
      e.clientX - rect.left,
      e.clientY - rect.top,
      viewRef.current,
    );
    setHovered((prev) => (hit?.id === (prev?.id ?? null) ? prev : hit));
  }
  function onPointerUp(e: React.PointerEvent) {
    dragRef.current.active = false;
    overlayRef.current?.releasePointerCapture(e.pointerId);
  }

  const zoomBy = (factor: number) => {
    const sz = sizeRef.current;
    if (sz > 0) {
      setView((v) => zoomAround(v, factor, sz / 2, sz / 2, sz, IMAGE_SIZE));
    }
  };

  const loading = matchStatus === "loading" || matchStatus === "idle";
  const error = matchStatus === "error";
  const tip = hovered ? imageToScreen(hovered.mx, hovered.my, view) : null;
  const hoveredPlayer =
    hovered && match
      ? match.players.find((p) => p.playerId === hovered.playerId)
      : undefined;

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-bg p-3"
    >
      <div
        ref={stackRef}
        className="relative shrink-0 overflow-hidden rounded-lg border border-edge"
        style={{ width: size || 1, height: size || 1 }}
      >
        <canvas ref={bgRef} className="absolute inset-0" />
        <canvas
          ref={heatRef}
          className="pointer-events-none absolute inset-0"
        />
        <canvas
          ref={overlayRef}
          className={`absolute inset-0 touch-none ${
            hovered ? "cursor-pointer" : "cursor-grab"
          } active:cursor-grabbing`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHovered(null)}
        />

        {/* legend */}
        <div className="absolute right-3 top-3 z-10">
          <Legend />
        </div>

        {/* heatmap-loading hint */}
        {heatmapStatus === "loading" ? (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border border-edge bg-panel/90 px-2.5 py-1.5 text-[11px] text-ink-dim backdrop-blur-sm">
            <Spinner size={12} /> Loading heatmap…
          </div>
        ) : null}

        {/* zoom controls */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <IconButton title="Zoom in" onClick={() => zoomBy(1.4)} className="h-8 w-8">
            <IconZoomIn size={15} />
          </IconButton>
          <IconButton
            title="Zoom out"
            onClick={() => zoomBy(1 / 1.4)}
            className="h-8 w-8"
          >
            <IconZoomOut size={15} />
          </IconButton>
          <IconButton
            title="Reset view"
            onClick={() => size > 0 && setView(fitView(size, IMAGE_SIZE))}
            className="h-8 w-8"
          >
            <IconRecenter size={15} />
          </IconButton>
        </div>

        {/* interaction hint */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-panel/70 px-2 py-1 text-[10px] text-ink-faint backdrop-blur-sm">
          scroll to zoom · drag to pan
        </div>

        {/* event tooltip */}
        {hovered && tip ? (
          <div
            className="pointer-events-none absolute z-20 w-52 animate-fade-in rounded-lg border border-edge bg-panel/95 p-2.5 shadow-panel backdrop-blur-sm"
            style={{
              left: Math.min(Math.max(tip.x + 14, 6), Math.max(6, size - 214)),
              top: Math.min(Math.max(tip.y - 10, 6), Math.max(6, size - 150)),
            }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <CategoryGlyph category={hovered.category} size={15} />
              <span className="text-sm font-semibold text-ink">
                {formatEventName(hovered.event)}
              </span>
            </div>
            <dl className="space-y-0.5 text-[11px]">
              <TipRow label="Category" value={CATEGORY_LABEL[hovered.category]} />
              <TipRow label="Time" value={`${formatClock(hovered.t)} into match`} />
              <TipRow
                label="Player"
                value={hoveredPlayer?.label ?? hovered.playerId.slice(0, 10)}
              />
              <TipRow
                label="World x,z"
                value={`${hovered.x.toFixed(1)}, ${hovered.z.toFixed(1)}`}
              />
              <TipRow
                label="Minimap"
                value={`${Math.round(hovered.mx)}, ${Math.round(hovered.my)}`}
              />
            </dl>
          </div>
        ) : null}

        {/* loading / error overlays */}
        {loading ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-bg/70">
            <div className="flex flex-col items-center gap-2">
              <Spinner />
              <span className="text-xs text-ink-dim">Loading match…</span>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-bg/80">
            <span className="text-sm text-ev-kill">Failed to load match.</span>
          </div>
        ) : null}
        {!loading && !error && match && tracks.length === 0 ? (
          <div className="absolute inset-0 z-20 grid place-items-center">
            <span className="rounded-md border border-edge bg-panel/90 px-3 py-2 text-xs text-ink-dim">
              No journeys match the current filters.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="tabular text-right text-ink-dim">{value}</dd>
    </div>
  );
}
