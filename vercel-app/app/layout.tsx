import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const THEME_INIT = `(function(){try{var k="indirim_takip_theme";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

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
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/assets/icon.svg" />
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
