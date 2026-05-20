import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LILA BLACK · Player Journey Visualizer",
  description:
    "Explore player movement, combat and loot events across LILA BLACK maps from production telemetry.",
};

export const viewport: Viewport = {
  themeColor: "#080b11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
