"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { setCookie } from "cookies-next";
import { useRouter } from "next/navigation";
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
    "w-full rounded-full bg-[#0097b2] text-white placeholder:italic placeholder:text-white/95 outline-none px-6 py-3.5 text-base";

  const mudarIdioma = (value: string) => {
    setCookie("NEXT_LOCALE", value, { path: "/" });
    router.refresh();
  };

  const labelIdioma =
    locale === "pt" ? "Idioma" : locale === "es" ? "Idioma" : "Language";

  if (bootSessao) {
    return (
      <GuiaAuthShell>
        <p className="text-center text-[#001f3f]">{tCommon("loading")}</p>
      </GuiaAuthShell>
    );
  }

  return (
    <GuiaAuthShell>
      <div className="mb-6">
        <label htmlFor="idioma-login" className="mb-2 block text-sm font-medium text-[#001f3f]">
          {labelIdioma}
        </label>
        <div className="relative">
          <select
            id="idioma-login"
            value={locale}
            onChange={(e) => mudarIdioma(e.target.value)}
            className="w-full appearance-none rounded-full bg-[#0097b2] py-3.5 pl-6 pr-12 text-base text-white outline-none"
            aria-label={labelIdioma}
          >
            <option value="pt" className="text-black">
              🇧🇷 Português
            </option>
            <option value="en" className="text-black">
              🇺🇸 English
            </option>
            <option value="es" className="text-black">
              🇪🇸 Español
            </option>
          </select>
          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/90" aria-hidden>
            ▼
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="loginId" className="mb-2 block text-sm font-medium text-[#001f3f]">
            {t("labelEmail")}
          </label>
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
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="senha" className="mb-2 block text-sm font-medium text-[#001f3f]">
            {t("labelPassword")}
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={t("password")}
            className={inputClass}
          />
        </div>

        <div className="-mt-1 text-right">
          <Link href="/recuperar-senha" className="text-sm italic text-[#0097b2] hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>

        {erroSenha ? <p className="text-center text-sm text-red-600">{erroSenha}</p> : null}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-full py-3.5 text-base font-bold text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
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
        <div className="mx-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 pt-2 text-left text-sm">
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="shrink-0 font-bold text-[#0097b2]">→</span>
              {t("benefitMobility")}
            </li>
            <li className="flex items-center gap-2">
              <span className="shrink-0 font-bold text-[#0097b2]">→</span>
              {t("benefitDiscounts")}
            </li>
            <li className="flex items-center gap-2">
              <span className="shrink-0 font-bold text-[#0097b2]">→</span>
              {t("benefitPracticality")}
            </li>
          </ul>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="shrink-0 font-bold text-[#0097b2]">→</span>
              {t("benefitGuide")}
            </li>
            <li className="flex items-center gap-2">
              <span className="shrink-0 font-bold text-[#0097b2]">→</span>
              {t("benefitSecurity")}
            </li>
            <li className="flex items-center gap-2">
              <span className="shrink-0 font-bold text-[#0097b2]">→</span>
              {t("benefitPartnerships")}
            </li>
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push("/escolha-perfil")}
        className="mt-8 w-full rounded-full py-3.5 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#00b838]"
        style={{ backgroundColor: VERDE }}
      >
        {t("createAccount")}
      </button>

      <div className="mt-8 flex justify-center gap-4 text-2xl leading-none" aria-hidden="true">
        <span title="Brasil">🇧🇷</span>
        <span title="Paraguai">🇵🇾</span>
        <span title="Argentina">🇦🇷</span>
      </div>
    </GuiaAuthShell>
  );
}
