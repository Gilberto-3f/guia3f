import "../globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import IdiomaSelector from "@/components/IdiomaSelector";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Guia 3F",
  description: "Guia da tríplice fronteira",
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
      <body className="relative min-h-full">
        <NextIntlClientProvider messages={messages}>
          <div className="pointer-events-none fixed top-4 right-4 z-[100]">
            <div className="pointer-events-auto">
              <IdiomaSelector />
            </div>
          </div>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
