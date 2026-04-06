"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { setCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { getPostAuthRedirectPath } from "@/lib/postAuthRedirect";

const VERDE = "#00D443";
const TEAL = "#0097b2";

const emailOuUsuarioRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Login");
  const tCommon = useTranslations("Common");
  const [loginId, setLoginId] = useState("");
  const [senha, setSenha] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoOtp, setCarregandoOtp] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
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
    setErro("");
    const id = loginId.trim().toLowerCase();
    if (!emailOuUsuarioRegex.test(id)) {
      setErro(t("invalidEmail"));
      return;
    }
    setCarregando(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: id,
        password: senha,
      });
      if (authError) {
        setErro(authError.message);
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
      setErro(t("genericError"));
    } finally {
      setCarregando(false);
    }
  };

  const handleMagicLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro("");
    setMagicLinkSent(false);
    const id = otpEmail.trim().toLowerCase();
    if (!emailOuUsuarioRegex.test(id)) {
      setErro(t("invalidEmail"));
      return;
    }
    setCarregandoOtp(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: id,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setErro(error.message);
        return;
      }
      setMagicLinkSent(true);
    } catch {
      setErro(t("genericError"));
    } finally {
      setCarregandoOtp(false);
    }
  };

  const inputClass =
    "w-full rounded-full bg-[#0097b2] text-white placeholder:italic placeholder:text-white/95 outline-none px-6 py-3.5 text-base";

  const mudarIdioma = (value: string) => {
    setCookie("NEXT_LOCALE", value, { path: "/" });
    router.refresh();
  };

  if (bootSessao) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <p className="text-[#001f3f]">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex w-full shrink-0 justify-center bg-[#0097b2] py-5">
        <Image
          src="/logo.png"
          alt="Guia 3F"
          width={150}
          height={50}
          priority
          className="h-auto w-auto object-contain"
        />
      </header>

      <div className="flex flex-1 flex-col bg-white">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-5">
          <div className="mb-4">
            <select
              value={locale}
              onChange={(e) => mudarIdioma(e.target.value)}
              className="w-full appearance-none rounded-full bg-[#0097b2] px-6 py-3.5 text-base text-white outline-none"
              aria-label="Selecionar idioma"
            >
              <option value="pt" className="text-black">
                Português
              </option>
              <option value="en" className="text-black">
                English
              </option>
              <option value="es" className="text-black">
                Español
              </option>
            </select>
          </div>

          <h2 className="mb-3 text-center text-base font-bold" style={{ color: TEAL }}>
            {t("magicLinkHeading")}
          </h2>
          <form onSubmit={handleMagicLink} className="mb-6 flex flex-col gap-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              placeholder={t("email")}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={carregandoOtp}
              className="rounded-full px-10 py-3 text-base font-bold text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
              style={{ backgroundColor: TEAL }}
            >
              {carregandoOtp ? tCommon("loading") : t("sendMagicLink")}
            </button>
            {magicLinkSent ? (
              <p className="text-center text-sm text-[#001f3f]">{t("magicLinkSent")}</p>
            ) : null}
          </form>

          <div className="mb-3 border-t border-gray-200 pt-4" />

          <h2 className="mb-3 text-center text-base font-bold" style={{ color: TEAL }}>
            {t("passwordLoginHeading")}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            <div className="flex flex-col gap-1">
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
              <div className="text-right">
                <Link
                  href="/recuperar-senha"
                  className="text-xs italic text-[#0097b2] hover:underline sm:text-sm"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
            </div>

            {erro ? <p className="text-center text-sm text-red-600">{erro}</p> : null}

            <div className="flex justify-center pt-1">
              <button
                type="submit"
                disabled={carregando}
                className="rounded-full px-10 py-3 text-base font-bold text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
                style={{ backgroundColor: VERDE }}
              >
                {carregando ? tCommon("loading") : t("loginButton")}
              </button>
            </div>
          </form>

          <div className="mt-10 space-y-4 text-center text-sm leading-relaxed text-[#001f3f]">
            <h2 className="text-lg font-bold" style={{ color: TEAL }}>
              {t("marketingHeadline")}
            </h2>
            <p>{t("marketingBody1")}</p>
            <p>{t("marketingBody2")}</p>
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 pt-1 text-left text-sm">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  {t("benefitMobility")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  {t("benefitDiscounts")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  {t("benefitPracticality")}
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  {t("benefitGuide")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  {t("benefitSecurity")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  {t("benefitPartnerships")}
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-8 rounded-2xl border border-[#0097b2]/40 bg-gray-50 px-4 py-4 text-center text-sm text-[#001f3f]">
            {t("firstTimeHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
