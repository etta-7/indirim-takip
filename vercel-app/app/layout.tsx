import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "İndirim Takip",
  description: "Trendyol, Hepsiburada, Akakçe, Cimri fiyat takibi",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "İndirim Takip" },
};

export const viewport: Viewport = {
  themeColor: "#0f4c3a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/assets/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/assets/icon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
