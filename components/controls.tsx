"use client";

/**
 * Lightweight, theme-matched UI primitives. Built by hand (no component
 * library) — the surface area is small and this keeps full control over the
 * dark analytics aesthetic. Native <select> is used for dropdowns so keyboard
 * and screen-reader behaviour comes for free.
 */

import type { ReactNode } from "react";

/* --------------------------------- panel --------------------------------- */

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-edge bg-panel shadow-panel ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {children}
      </h3>
      {right}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-dim">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/* -------------------------------- select --------------------------------- */

export function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      className="select w-full cursor-pointer rounded-md border border-edge bg-panel-raised py-1.5 pl-2.5 pr-8 text-sm text-ink outline-none transition-colors hover:border-edge focus:border-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------- segmented ------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="flex gap-0.5 rounded-md border border-edge bg-panel-raised p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-brand text-bg"
                : "text-ink-dim hover:bg-panel-hover hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- toggle -------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-brand" : "bg-panel-hover"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ------------------------------- check row ------------------------------- */

export function CheckRow({
  checked,
  onChange,
  label,
  swatch,
  glyph,
  count,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  swatch?: string;
  glyph?: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-hover ${
        checked ? "" : "opacity-45"
      }`}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
          checked ? "border-brand bg-brand" : "border-edge bg-panel-raised"
        }`}
      >
        {checked ? (
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2.5 6.5L5 9l4.5-5"
              fill="none"
              stroke="#080b11"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {glyph ? (
        <span className="grid h-4 w-4 shrink-0 place-items-center">{glyph}</span>
      ) : swatch ? (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: swatch }}
        />
      ) : null}
      <span className="flex-1 text-sm text-ink">{label}</span>
      {count !== undefined ? (
        <span className="tabular text-[11px] text-ink-faint">{count}</span>
      ) : null}
    </button>
  );
}

/* --------------------------------- slider -------------------------------- */

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: string;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-dim">{label}</span>
        <span className="tabular text-[11px] text-ink-faint">
          {display ?? value}
        </span>
      </div>
      <input
        type="range"
        className="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* --------------------------------- button -------------------------------- */

type ButtonVariant = "primary" | "ghost" | "subtle";

export function Button({
  children,
  onClick,
  variant = "subtle",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-brand text-bg hover:bg-brand/90",
    ghost: "text-ink-dim hover:bg-panel-hover hover:text-ink",
    subtle:
      "border border-edge bg-panel-raised text-ink-dim hover:border-edge hover:bg-panel-hover hover:text-ink",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  active,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-brand-dim bg-brand/15 text-brand"
          : "border-edge bg-panel-raised text-ink-dim hover:bg-panel-hover hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------ misc display ----------------------------- */

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="animate-spin-slow rounded-full border-2 border-edge border-t-brand"
      style={{ width: size, height: size }}
    />
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-edge-soft bg-panel-raised px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div
        className="tabular mt-0.5 text-base font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
