import type { ReactNode } from "react";

/** Raiz mínima: html/body ficam em `app/[locale]/layout.tsx` (next-intl + [locale]). */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
