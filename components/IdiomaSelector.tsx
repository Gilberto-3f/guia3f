"use client";

import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { setCookie } from "cookies-next";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

const idiomas = [
  { code: "pt", nome: "Português", bandeira: "🇧🇷" },
  { code: "en", nome: "English", bandeira: "🇺🇸" },
  { code: "es", nome: "Español", bandeira: "🇪🇸" },
];

export default function IdiomaSelector() {
  const router = useRouter();
  const currentLocale = useLocale();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberto]);

  const mudarIdioma = (code: string) => {
    setCookie("NEXT_LOCALE", code, { path: "/" });
    setAberto(false);
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-gray-700"
      >
        <Globe size={16} aria-hidden />
        <span>{idiomas.find((i) => i.code === currentLocale)?.bandeira}</span>
      </button>
      {aberto ? (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-lg border bg-white shadow-lg"
        >
          {idiomas.map((idioma) => (
            <button
              key={idioma.code}
              type="button"
              role="option"
              aria-selected={currentLocale === idioma.code}
              onClick={() => mudarIdioma(idioma.code)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                currentLocale === idioma.code ? "text-[#0097b2]" : "text-gray-700"
              }`}
            >
              <span aria-hidden>{idioma.bandeira}</span>
              <span>{idioma.nome}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
