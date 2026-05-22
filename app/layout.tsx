import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

/** Incrementar quando overrides do tour/PWA em public/globals.css mudarem. */
const GLOBAL_CSS_VERSION = "2";

export const metadata: Metadata = {
  applicationName: "Guia 3F",
  title: "Guia 3F",
  description: "Guia turístico da Tríplice Fronteira",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Guia 3F",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0097b2",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt" suppressHydrationWarning className={`${inter.className} h-full antialiased`}>
      <head>
        <link rel="stylesheet" href={`/globals.css?v=${GLOBAL_CSS_VERSION}`} />
      </head>
      <body suppressHydrationWarning className="min-h-full">
        {children}
      </body>
    </html>
  );
}
