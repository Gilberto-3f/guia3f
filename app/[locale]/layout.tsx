import "../globals.css";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import SupabaseCookieSync from "@/components/SupabaseCookieSync";

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
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider messages={messages}>
          <SupabaseCookieSync />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
