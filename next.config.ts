import type { NextConfig } from "next";

/**
 * The app is fully static: it reads pre-generated JSON artifacts from
 * `public/data` and minimap PNGs from `public/maps`. No server runtime,
 * API routes or image optimization is required, which keeps the Vercel /
 * Netlify deploy trivial.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Minimaps are pre-resized during preprocessing, so we serve them as-is
  // instead of running them through the Next.js image optimizer.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
