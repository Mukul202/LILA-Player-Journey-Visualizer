"use client";

/**
 * Left sidebar: every control a level designer uses to scope the view —
 * map / date / match selection, entity and event filters, heatmap layer and
 * display options.
 */

import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { EVENT_CATEGORIES, type HeatmapKind } from "@/lib/data-types";
import { CATEGORY_LABEL } from "@/lib/colors";
import { datesForMap, matchesFor, type EntityMode } from "@/lib/filters";
import { formatDate, matchLabel } from "@/lib/format";
import {
  Button,
  CheckRow,
  Field,
  Panel,
  SectionLabel,
  Segmented,
  Select,
  Slider,
  Toggle,
} from "./controls";
import { CategoryGlyph } from "./glyphs";
import { IconReset } from "./icons";

function Group({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="border-b border-edge-soft px-3 py-3 last:border-0">
      <SectionLabel right={right}>{title}</SectionLabel>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

const HEATMAP_OPTIONS: { value: HeatmapKind | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "traffic", label: "Traffic — movement density" },
  { value: "kills", label: "Kill zones" },
  { value: "deaths", label: "Death zones" },
  { value: "loot", label: "Loot hotspots" },
];

export function FilterPanel() {
  const manifest = useStore((s) => s.manifest);
  const mapId = useStore((s) => s.mapId);
  const date = useStore((s) => s.date);
  const matchId = useStore((s) => s.matchId);
  const entity = useStore((s) => s.entity);
  const categories = useStore((s) => s.categories);
  const heatmapKind = useStore((s) => s.heatmapKind);
  const heatmapOpacity = useStore((s) => s.heatmapOpacity);
  const trackOpacity = useStore((s) => s.trackOpacity);
  const richOnly = useStore((s) => s.richOnly);

  const selectMap = useStore((s) => s.selectMap);
  const selectDate = useStore((s) => s.selectDate);
  const selectMatch = useStore((s) => s.selectMatch);
  const setEntity = useStore((s) => s.setEntity);
  const toggleCategory = useStore((s) => s.toggleCategory);
  const setHeatmapKind = useStore((s) => s.setHeatmapKind);
  const setHeatmapOpacity = useStore((s) => s.setHeatmapOpacity);
  const setTrackOpacity = useStore((s) => s.setTrackOpacity);
  const setRichOnly = useStore((s) => s.setRichOnly);
  const resetFilters = useStore((s) => s.resetFilters);

  if (!manifest) return null;

  const mapOptions = manifest.maps.map((m) => ({
    value: m.id,
    label: m.name,
  }));
  const dateOptions = datesForMap(manifest, mapId).map((d) => ({
    value: d,
    label: formatDate(d),
  }));
  const matchList = matchesFor(manifest, mapId, date, richOnly);
  const matchOptions = matchList.map((m) => ({
    value: m.matchId,
    label: matchLabel(m),
  }));
  if (!matchList.some((m) => m.matchId === matchId)) {
    const current = manifest.matches.find((m) => m.matchId === matchId);
    if (current) {
      matchOptions.unshift({
        value: current.matchId,
        label: `${matchLabel(current)} — current`,
      });
    }
  }

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">
          Filters
        </h2>
        <Button variant="ghost" onClick={resetFilters} title="Reset all filters">
          <IconReset size={13} />
          Reset
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Group title="Match selection">
          <Field label="Map">
            <Select value={mapId} onChange={selectMap} options={mapOptions} />
          </Field>
          <Field label="Date">
            <Select value={date} onChange={selectDate} options={dateOptions} />
          </Field>
          <Field
            label="Match"
            hint={`${matchList.length} match${
              matchList.length === 1 ? "" : "es"
            } for this map & date`}
          >
            <Select
              value={matchId}
              onChange={selectMatch}
              options={matchOptions}
            />
          </Field>
          <label className="flex items-center justify-between rounded-md bg-panel-raised px-2 py-1.5">
            <span className="text-xs text-ink-dim">
              Multi-entity matches only
            </span>
            <Toggle
              checked={richOnly}
              onChange={setRichOnly}
              label="Multi-entity matches only"
            />
          </label>
        </Group>

        <Group title="Entities">
          <Segmented<EntityMode>
            value={entity}
            onChange={setEntity}
            options={[
              { value: "all", label: "All" },
              { value: "humans", label: "Humans" },
              { value: "bots", label: "Bots" },
            ]}
          />
        </Group>

        <Group title="Event markers">
          {EVENT_CATEGORIES.map((c) => (
            <CheckRow
              key={c}
              checked={categories[c]}
              onChange={() => toggleCategory(c)}
              label={CATEGORY_LABEL[c]}
              glyph={<CategoryGlyph category={c} size={15} />}
            />
          ))}
        </Group>

        <Group title="Heatmap overlay">
          <Field label="Layer">
            <Select
              value={heatmapKind}
              onChange={(v) => setHeatmapKind(v as HeatmapKind | "none")}
              options={HEATMAP_OPTIONS}
            />
          </Field>
          <Slider
            label="Heatmap opacity"
            value={heatmapOpacity}
            min={0.1}
            max={1}
            step={0.05}
            disabled={heatmapKind === "none"}
            onChange={setHeatmapOpacity}
            display={`${Math.round(heatmapOpacity * 100)}%`}
          />
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Heatmaps aggregate every match on this map — they show map-wide
            patterns and ignore the match/date selection.
          </p>
        </Group>

        <Group title="Display">
          <Slider
            label="Path opacity"
            value={trackOpacity}
            min={0.1}
            max={1}
            step={0.05}
            onChange={setTrackOpacity}
            display={`${Math.round(trackOpacity * 100)}%`}
          />
        </Group>
      </div>
    </Panel>
  );
}
