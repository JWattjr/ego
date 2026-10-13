import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: { default: "Ego — good things nearby", template: "%s · Ego" },
  description:
    "A USDC wallet with fun ways to get paid: hunt drops on the map, claim bounties with a code, catch event drops. Programmable money on Arc.",
  applicationName: "Ego",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ego" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8fb",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
