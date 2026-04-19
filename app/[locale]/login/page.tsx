"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { syncSessionCookiesToServer } from "@/lib/authCookieSync";
import { supabase } from "@/lib/supabase";
import { getSafeCadastroNext } from "@/lib/cadastroNextRedirect";
import { getPostAuthRedirectPath } from "@/lib/postAuthRedirect";
import GuiaAuthShell from "@/components/GuiaAuthShell";
import SeletorIdioma from "@/components/SeletorIdioma";
import BotaoLogin from "@/components/BotaoLogin";

const emailOuUsuarioRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const senhaMinLen = 8;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      if (session?.user?.id && session.access_token && session.refresh_token) {
        await syncSessionCookiesToServer(session);
        const nextCadastro = getSafeCadastroNext(searchParams.get("next"));
        if (nextCadastro) {
          router.replace(nextCadastro);
          return;
        }
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
  }, [router, searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErroSenha("");
    const id = loginId.trim().toLowerCase();
    if (!emailOuUsuarioRegex.test(id)) {
      setErroSenha(t("invalidEmail"));
      return;
    }
    if (senha.length < senhaMinLen) {
      setErroSenha(t("passwordMinLength"));
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
      if (uid && session?.access_token && session.refresh_token) {
        const synced = await syncSessionCookiesToServer(session);
        if (!synced) {
          setErroSenha(t("genericError"));
          return;
        }
        const nextCadastro = getSafeCadastroNext(searchParams.get("next"));
        if (nextCadastro) {
          router.replace(nextCadastro);
          return;
        }
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

  if (bootSessao) {
    return (
      <GuiaAuthShell largeHeaderLogo>
        <p className="text-center text-[#001f3f]">{tCommon("loading")}</p>
      </GuiaAuthShell>
    );
  }

  return (
    <GuiaAuthShell largeHeaderLogo>
      <SeletorIdioma />

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-80 flex-col items-center gap-1.5"
      >
        <div className="w-full">
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
        </div>

        <div className="w-full">
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            minLength={senhaMinLen}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={t("password")}
            aria-label={t("password")}
            className={inputClass}
          />
        </div>

        <div className="w-full pt-0.5 text-center">
          <Link href="/recuperar-senha" className="text-sm italic text-[#0097b2] hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>

        {erroSenha ? <p className="text-center text-sm text-red-600">{erroSenha}</p> : null}

        <div className="flex w-full justify-center pt-0.5">
          <BotaoLogin disabled={carregando} loading={carregando} loadingLabel={tCommon("loading")}>
            {t("loginButton")}
          </BotaoLogin>
        </div>
      </form>

      <div className="my-8 h-px w-full max-w-80 bg-gray-300" aria-hidden="true" />

      <div className="mx-auto max-w-80 space-y-4 text-center text-sm leading-relaxed text-[#001f3f]">
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
        onClick={() => router.push("/escolha-perfil")}
        className="mx-auto mt-8 block w-full max-w-[4cm] rounded-full bg-[#00D443] py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#00b838]"
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
