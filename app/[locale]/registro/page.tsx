"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { getPostAuthRedirectPath } from "@/lib/postAuthRedirect";
import GuiaAuthShell from "@/components/GuiaAuthShell";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function RegistroPage() {
  const router = useRouter();
  const t = useTranslations("Registro");
  const tLogin = useTranslations("Login");
  const tCadastro = useTranslations("Cadastro");
  const tCommon = useTranslations("Common");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [boot, setBoot] = useState(true);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);

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
      setBoot(false);
    };
    void run();
    return () => {
      ativo = false;
    };
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro("");
    const mail = email.trim().toLowerCase();
    if (!emailRegex.test(mail)) {
      setErro(t("valEmail"));
      return;
    }
    if (!senhaRegex.test(senha)) {
      setErro(t("valPassword"));
      return;
    }
    if (senha !== senhaConfirma) {
      setErro(t("valPasswordMatch"));
      return;
    }

    setEnviando(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password: senha,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      if (error) {
        setErro(error.message || t("signUpError"));
        return;
      }
      if (data.session) {
        router.replace("/escolha-perfil");
        return;
      }
      setAguardandoEmail(true);
    } catch {
      setErro(t("signUpError"));
    } finally {
      setEnviando(false);
    }
  };

  const inputClass =
    "w-full max-w-80 rounded-full border border-gray-300 px-4 py-2 text-base text-[#001f3f] placeholder:text-[#001f3f]/60 outline-none focus:ring-2 focus:ring-[#0097b2]";

  if (boot) {
    return (
      <GuiaAuthShell largeHeaderLogo>
        <p className="text-center text-[#001f3f]">{tCommon("loading")}</p>
      </GuiaAuthShell>
    );
  }

  if (aguardandoEmail) {
    return (
      <GuiaAuthShell largeHeaderLogo>
        <h1 className="mb-4 text-center text-xl font-bold text-[#0097b2]">{t("checkEmailTitle")}</h1>
        <p className="mx-auto mb-3 max-w-md text-center text-sm leading-relaxed text-[#001f3f]">
          {t("checkEmailBody")}
        </p>
        <p className="mx-auto max-w-md text-center text-xs text-[#001f3f]/80">{t("checkEmailHint")}</p>
        <div className="mt-8 text-center text-sm text-[#001f3f]">
          <Link href="/login" className="font-medium text-[#0097b2] hover:underline">
            {t("loginLink")}
          </Link>
        </div>
      </GuiaAuthShell>
    );
  }

  return (
    <GuiaAuthShell largeHeaderLogo>
      <h1 className="mb-2 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t("title")}</h1>
      <p className="mx-auto mb-6 max-w-md text-center text-sm text-[#001f3f]">{t("subtitle")}</p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mx-auto flex w-full max-w-80 flex-col items-center gap-2"
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tLogin("email")}
          aria-label={tLogin("email")}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder={tLogin("password")}
          aria-label={tLogin("password")}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          value={senhaConfirma}
          onChange={(e) => setSenhaConfirma(e.target.value)}
          placeholder={tCadastro("confirmPassword")}
          aria-label={tCadastro("confirmPassword")}
          className={inputClass}
        />

        {erro ? <p className="text-center text-sm text-red-600">{erro}</p> : null}

        <button
          type="submit"
          disabled={enviando}
          className="mt-2 w-full max-w-80 rounded-full bg-[#00D443] py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
        >
          {enviando ? tCommon("loading") : t("submit")}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#001f3f]">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-[#0097b2] hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </GuiaAuthShell>
  );
}
