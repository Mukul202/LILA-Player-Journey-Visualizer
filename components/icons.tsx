/** Minimal inline SVG icon set. All icons inherit `currentColor`. */

interface IconProps {
  className?: string;
  size?: number;
}

function svg(
  paths: React.ReactNode,
  { className, size = 16 }: IconProps,
  filled = false,
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export const IconPlay = (p: IconProps) =>
  svg(<path d="M8 5v14l11-7z" />, p, true);

export const IconPause = (p: IconProps) =>
  svg(
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>,
    p,
    true,
  );

export const IconRewind = (p: IconProps) =>
  svg(
    <>
      <path d="M19 5v14L8 12z" />
      <rect x="4" y="5" width="2.4" height="14" rx="1" />
    </>,
    p,
    true,
  );

export const IconReset = (p: IconProps) =>
  svg(
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>,
    p,
  );

export const IconZoomIn = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </>,
    p,
  );

export const IconZoomOut = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </>,
    p,
  );

export const IconRecenter = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </>,
    p,
  );

export const IconLayers = (p: IconProps) =>
  svg(
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>,
    p,
  );

export const IconRoute = (p: IconProps) =>
  svg(
    <>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H14a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h5.5" />
    </>,
    p,
  );

export const IconTarget = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
    </>,
    p,
  );

export const IconSearch = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
    p,
  );

export const IconClose = (p: IconProps) =>
  svg(<path d="M6 6l12 12M18 6L6 18" />, p);

export const IconChevronRight = (p: IconProps) =>
  svg(<path d="M9 6l6 6-6 6" />, p);

export const IconClock = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>,
    p,
  );

export const IconBolt = (p: IconProps) =>
  svg(<path d="M13 2L4 14h6l-1 8 9-12h-6z" />, p, true);
