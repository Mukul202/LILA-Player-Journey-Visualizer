"use client";

/**
 * Modal that surfaces the three data-backed insights from
 * public/data/insights.json (produced by `npm run generate:insights`).
 */

import { useEffect, useState, type ReactNode } from "react";
import type { Insight, InsightsReport } from "@/lib/data-types";
import { Spinner } from "./controls";
import { IconBolt, IconClose } from "./icons";

/** Render text with `backtick` spans as inline code. */
function richText(text: string): ReactNode {
  return text.split("`").map((part, i) =>
    i % 2 === 1 ? (
      <code
        key={i}
        className="rounded bg-panel-raised px-1 py-0.5 text-[0.92em] text-brand"
      >
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <article className="rounded-lg border border-edge bg-panel-raised p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand/15 text-sm font-bold text-brand">
          {insight.id}
        </span>
        <h3 className="text-base font-semibold text-ink">{insight.title}</h3>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-ink-dim">
        {richText(insight.caughtMyEye)}
      </p>

      <Block label="Evidence">
        <ul className="space-y-1.5">
          {insight.evidence.map((e, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-dim">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
              <span className="leading-relaxed">{richText(e)}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block label="Recommendation">
        <p className="text-sm leading-relaxed text-ink-dim">
          {richText(insight.recommendation)}
        </p>
      </Block>

      <Block label="Metrics likely affected">
        <div className="flex flex-wrap gap-1.5">
          {insight.metricsAffected.map((m) => (
            <span
              key={m}
              className="rounded-full border border-edge bg-panel px-2 py-0.5 text-[11px] text-ink-dim"
            >
              {m}
            </span>
          ))}
        </div>
      </Block>

      <Block label="Why it matters">
        <p className="text-sm leading-relaxed text-ink-dim">
          {richText(insight.whyItMatters)}
        </p>
      </Block>
    </article>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-edge-soft pt-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </div>
      {children}
    </div>
  );
}

export function InsightsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!open || report || status === "loading") return;
    setStatus("loading");
    fetch("/data/insights.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: InsightsReport) => {
        setReport(d);
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }, [open, report, status]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Data insights"
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand/15 text-brand">
              <IconBolt size={15} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Data-backed insights
              </h2>
              <p className="text-[11px] text-ink-faint">
                Computed from the telemetry — see INSIGHTS.md
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-ink-dim transition-colors hover:bg-panel-hover hover:text-ink"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {status === "loading" ? (
            <div className="grid h-40 place-items-center">
              <Spinner />
            </div>
          ) : status === "error" ? (
            <p className="py-12 text-center text-sm text-ev-kill">
              Could not load insights. Run{" "}
              <code className="text-ink">npm run generate:insights</code>.
            </p>
          ) : report ? (
            <div className="space-y-3">
              {report.insights.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
