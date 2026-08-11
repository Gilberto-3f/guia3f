import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { MODO_NOTURNO_BOOT_SCRIPT } from "@/lib/modoNoturno";

const inter = Inter({ subsets: ["latin"] });

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
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt" suppressHydrationWarning className={`${inter.className} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODO_NOTURNO_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="min-h-full">
        {children}
      </body>
    </html>
  );
}
