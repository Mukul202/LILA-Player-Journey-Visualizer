/**
 * Small, pure display formatters shared across the UI.
 */

import type { EventName, MatchSummary } from "./data-types";

/** Seconds -> "m:ss" (e.g. 729 -> "12:09"). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

/** Seconds -> compact human duration (e.g. 729 -> "12m 09s"). */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}

/** ISO date -> short label (e.g. "2026-02-10" -> "Feb 10"). */
export function formatDate(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [, m, d] = iso.split("-");
  const month = months[Number(m) - 1] ?? m;
  return `${month} ${Number(d)}`;
}

/** Raw event name -> spaced label (e.g. "BotKill" -> "Bot Kill"). */
export function formatEventName(event: EventName): string {
  return event.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Compact integer formatting with thousands separators. */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Short, stable match label for dropdowns. */
export function matchLabel(summary: MatchSummary): string {
  const id = summary.matchId.slice(0, 8);
  const entities = summary.playerCount + summary.botCount;
  return `${id} · ${entities} ${entities === 1 ? "entity" : "entities"} · ${summary.totalEvents} events`;
}

/** First 8 chars of a match id, for compact display. */
export function shortMatchId(matchId: string): string {
  return matchId.slice(0, 8);
}
