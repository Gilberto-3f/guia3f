"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { setCookie } from "cookies-next";
import { ChevronDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { getPostAuthRedirectPath } from "@/lib/postAuthRedirect";
import GuiaAuthShell from "@/components/GuiaAuthShell";

const VERDE = "#00D443";

const emailOuUsuarioRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Login");
  const tCommon = useTranslations("Common");
  const [loginId, setLoginId] = useState("");
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [bootSessao, setBootSessao] = useState(true);
  const [idiomaAberto, setIdiomaAberto] = useState(false);
  const idiomaRef = useRef<HTMLDivElement>(null);

  const opcoesIdioma = [
    { value: "pt" as const, bandeira: "🇧🇷", rotulo: "Português" },
    { value: "en" as const, bandeira: "🇺🇸", rotulo: "English" },
    { value: "es" as const, bandeira: "🇪🇸", rotulo: "Español" },
  ];

  const idiomaAtual = opcoesIdioma.find((o) => o.value === locale) ?? opcoesIdioma[0];

  useEffect(() => {
    let ativo = true;
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!ativo) return;
      if (session?.user?.id) {
        const path = await getPostAuthRedirectPath(supabase, session.user.id);
        router.replace(path);
        return;
      }
      setBootSessao(false);
    };
    void run();
    return () => {
      ativo = false;
    };
  }, [router]);

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (idiomaRef.current && !idiomaRef.current.contains(e.target as Node)) {
        setIdiomaAberto(false);
      }
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroSenha("");
    const id = loginId.trim().toLowerCase();
    if (!emailOuUsuarioRegex.test(id)) {
      setErroSenha(t("invalidEmail"));
      return;
    }
    setCarregando(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: id,
        password: senha,
      });
      if (authError) {
        setErroSenha(authError.message);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const path = await getPostAuthRedirectPath(supabase, uid);
        router.replace(path);
      }
    } catch {
      setErroSenha(t("genericError"));
    } finally {
      setCarregando(false);
    }
  };

  const inputClass =
    "w-full max-w-80 rounded-full border border-gray-300 px-4 py-2 text-base text-[#001f3f] placeholder:text-[#001f3f]/60 outline-none focus:ring-2 focus:ring-[#0097b2]";

  const mudarIdioma = (value: string) => {
    setCookie("NEXT_LOCALE", value, { path: "/" });
    setIdiomaAberto(false);
    router.refresh();
  };

  const labelIdioma =
    locale === "pt" ? "Idioma" : locale === "es" ? "Idioma" : "Language";

  if (bootSessao) {
    return (
      <GuiaAuthShell largeHeaderLogo>
        <p className="text-center text-[#001f3f]">{tCommon("loading")}</p>
      </GuiaAuthShell>
    );
  }

  return (
    <GuiaAuthShell largeHeaderLogo>
      <div ref={idiomaRef} className="relative mb-6 flex justify-center">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[#001f3f] outline-none"
          aria-expanded={idiomaAberto}
          aria-haspopup="listbox"
          aria-label={labelIdioma}
          onClick={() => setIdiomaAberto((v) => !v)}
        >
          <span className="text-xl" aria-hidden>
            {idiomaAtual.bandeira}
          </span>
          <span className="text-sm">{idiomaAtual.rotulo}</span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        </button>
        {idiomaAberto ? (
          <ul
            className="absolute left-1/2 top-full z-10 mt-1 min-w-[10rem] -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-1 shadow-md"
            role="listbox"
          >
            {opcoesIdioma.map((op) => (
              <li key={op.value} role="option" aria-selected={locale === op.value}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#001f3f] hover:bg-gray-50"
                  onClick={() => mudarIdioma(op.value)}
                >
                  <span aria-hidden>{op.bandeira}</span>
                  {op.rotulo}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-80 flex-col items-center gap-2">
        <input
          id="loginId"
          name="loginId"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder={t("email")}
          aria-label={t("email")}
          className={inputClass}
        />

        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder={t("password")}
          aria-label={t("password")}
          className={inputClass}
        />

        <div className="w-full pt-1 text-center">
          <Link href="/recuperar-senha" className="text-sm italic text-[#0097b2] hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>

        {erroSenha ? <p className="text-center text-sm text-red-600">{erroSenha}</p> : null}

        <button
          type="submit"
          disabled={carregando}
          className="mt-1 w-32 rounded-full py-2 text-sm font-bold uppercase text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
          style={{ backgroundColor: VERDE }}
        >
          {carregando ? tCommon("loading") : t("loginButton")}
        </button>
      </form>

      <div className="my-8 h-px w-full bg-gray-300" aria-hidden="true" />

      <div className="space-y-4 text-center text-sm leading-relaxed text-[#001f3f]">
        <h2 className="text-lg font-bold text-[#0097b2]">{t("marketingHeadline")}</h2>
        <p>{t("marketingBody1")}</p>
        <p>{t("marketingBody2")}</p>
        <div className="mx-auto mt-2 grid max-w-sm grid-cols-2 gap-x-8 gap-y-1 text-left text-sm">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold text-[#0097b2]">→</span>
            {t("benefitMobility")}
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold text-[#0097b2]">→</span>
            {t("benefitGuide")}
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold text-[#0097b2]">→</span>
            {t("benefitDiscounts")}
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold text-[#0097b2]">→</span>
            {t("benefitSecurity")}
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold text-[#0097b2]">→</span>
            {t("benefitPracticality")}
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold text-[#0097b2]">→</span>
            {t("benefitPartnerships")}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push("/registro")}
        className="mx-auto mt-8 block w-36 rounded-full bg-[#00D443] py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#00b838]"
      >
        {t("createAccount")}
      </button>

      <div className="mt-8 flex justify-center gap-2 text-2xl leading-none" aria-hidden="true">
        <span title="Brasil">🇧🇷</span>
        <span title="Paraguai">🇵🇾</span>
        <span title="Argentina">🇦🇷</span>
      </div>
    </GuiaAuthShell>
  );
}
