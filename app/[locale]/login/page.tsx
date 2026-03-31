"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";

const VERDE = "#00D443";
const TEAL = "#0097b2";

const emailOuUsuarioRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Login");
  const tCommon = useTranslations("Common");
  const [loginId, setLoginId] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

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
      router.push("/guia");
    } catch {
      setErro(t("genericError"));
    } finally {
      setCarregando(false);
    }
  };

  const inputClass =
    "w-full rounded-full bg-[#0097b2] text-white placeholder:italic placeholder:text-white/95 outline-none px-6 py-3.5 text-base";

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

          <Link
            href="/escolha-perfil"
            className="mt-8 w-full rounded-full py-3.5 text-center text-base font-bold text-white transition-colors hover:bg-[#00b838]"
            style={{ backgroundColor: VERDE }}
          >
            {t("createAccount")}
          </Link>
        </div>
      </div>
    </div>
  );
}
