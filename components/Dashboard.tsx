"use client";

/**
 * Top-level dashboard: loads the manifest, wires global keyboard shortcuts and
 * lays out the header, filter sidebar, map canvas, match panel and timeline.
 */

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button, Spinner } from "./controls";
import { FilterPanel } from "./FilterPanel";
import { Header } from "./Header";
import { MapViewer } from "./MapViewer";
import { MatchStats } from "./MatchStats";
import { Timeline } from "./Timeline";
import { IconTarget } from "./icons";

export function Dashboard() {
  const manifestStatus = useStore((s) => s.manifestStatus);
  const loadManifest = useStore((s) => s.loadManifest);
  const togglePlay = useStore((s) => s.togglePlay);
  const setCurrentTime = useStore((s) => s.setCurrentTime);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  /* keyboard: space = play/pause, arrows = seek +/- 5s */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        setCurrentTime(useStore.getState().currentTime - 5);
      } else if (e.code === "ArrowRight") {
        setCurrentTime(useStore.getState().currentTime + 5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, setCurrentTime]);

  if (manifestStatus === "loading" || manifestStatus === "idle") {
    return (
      <div className="grid h-screen place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={28} />
          <p className="text-sm text-ink-dim">Loading production telemetry…</p>
        </div>
      </div>
    );
  }

  if (manifestStatus === "error") {
    return (
      <div className="grid h-screen place-items-center bg-bg">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-ev-kill/15 text-ev-kill">
            <IconTarget size={24} />
          </div>
          <h2 className="text-base font-semibold text-ink">
            Could not load telemetry
          </h2>
          <p className="text-sm text-ink-dim">
            The data manifest failed to load. Make sure preprocessing has run
            (<code className="text-ink">npm run preprocess:data</code>) so the
            files exist under <code className="text-ink">public/data</code>.
          </p>
          <Button variant="primary" onClick={() => void loadManifest()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <Header />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <aside className="w-[262px] shrink-0">
          <FilterPanel />
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1">
          <MapViewer />
        </main>
        <aside className="hidden w-[300px] shrink-0 lg:flex">
          <div className="flex h-full w-full flex-col">
            <MatchStats />
          </div>
        </aside>
      </div>
      <Timeline />
    </div>
  );
}
