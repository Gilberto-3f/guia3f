'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronsDown } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const VERDE = '#00D443'
const TEAL = '#0097b2'

const emailOuUsuarioRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LOCALES = [
  { key: 'br' as const, label: 'Português', emoji: '🇧🇷', pais: 'Brasil' },
  { key: 'py' as const, label: 'Español', emoji: '🇵🇾', pais: 'Paraguai' },
  { key: 'ar' as const, label: 'Español', emoji: '🇦🇷', pais: 'Argentina' },
]

export default function LoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [locale, setLocale] = useState<'br' | 'py' | 'ar'>('br')
  const [idiomaMenuAberto, setIdiomaMenuAberto] = useState(false)
  const idiomaRef = useRef<HTMLDivElement>(null)

  const localeAtual = LOCALES.find((l) => l.key === locale) ?? LOCALES[0]

  useEffect(() => {
    if (!idiomaMenuAberto) return
    const onDoc = (e: MouseEvent) => {
      if (idiomaRef.current && !idiomaRef.current.contains(e.target as Node)) {
        setIdiomaMenuAberto(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [idiomaMenuAberto])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErro('')
    const id = loginId.trim().toLowerCase()
    if (!emailOuUsuarioRegex.test(id)) {
      setErro('Informe um e-mail válido para entrar.')
      return
    }
    setCarregando(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: id,
        password: senha,
      })
      if (authError) {
        setErro(authError.message)
        return
      }
      router.push('/guia')
    } catch {
      setErro('Erro ao entrar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const inputClass =
    'w-full rounded-full bg-[#0097b2] text-white placeholder:italic placeholder:text-white/95 outline-none px-6 py-3.5 text-base'

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
          <div className="relative mb-6 self-start" ref={idiomaRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={idiomaMenuAberto}
              onClick={() => setIdiomaMenuAberto((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-1 py-1 text-[#001f3f] outline-none ring-[#0097b2] focus-visible:ring-2"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {localeAtual.emoji}
              </span>
              <span className="text-base font-medium">{localeAtual.label}</span>
              <ChevronsDown className="h-5 w-5 shrink-0 text-[#001f3f] opacity-80" aria-hidden />
            </button>
            {idiomaMenuAberto ? (
              <ul
                role="listbox"
                className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
              >
                {LOCALES.map(({ key, label, emoji }) => (
                  <li key={key} role="option" aria-selected={locale === key}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#001f3f] hover:bg-gray-50"
                      onClick={() => {
                        setLocale(key)
                        setIdiomaMenuAberto(false)
                      }}
                    >
                      <span className="text-xl" aria-hidden>
                        {emoji}
                      </span>
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

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
              placeholder="E-mail"
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
                placeholder="Senha"
                className={inputClass}
              />
              <div className="text-right">
                <Link
                  href="/recuperar-senha"
                  className="text-xs italic text-[#0097b2] hover:underline sm:text-sm"
                >
                  Esqueceu a senha?
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
                {carregando ? 'Entrando...' : 'Login'}
              </button>
            </div>
          </form>

          <div className="mt-10 space-y-4 text-center text-sm leading-relaxed text-[#001f3f]">
            <h2 className="text-lg font-bold" style={{ color: TEAL }}>
              Não tem cadastro no GUIA 3F?
            </h2>
            <p>
              Nosso aplicativo oferece um <span className="font-semibold">ecossistema</span> completo de serviços e
              empresas locais.
            </p>
            <p>
              Crie sua conta agora mesmo na melhor comunidade do turismo da{' '}
              <span className="font-semibold">Tríplice Fronteira</span> e desfrute de benefícios exclusivos como:
            </p>
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 pt-1 text-left text-sm">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  Mobilidade
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  Descontos
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  Praticidade
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  Guia Turístico
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  Segurança
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: TEAL }}>
                    →
                  </span>
                  Parcerias
                </li>
              </ul>
            </div>
          </div>

          <Link
            href="/escolha-perfil"
            className="mt-8 w-full rounded-full py-3.5 text-center text-base font-bold text-white transition-colors hover:bg-[#00b838]"
            style={{ backgroundColor: VERDE }}
          >
            Criar Conta
          </Link>

          <div className="mt-auto flex justify-center gap-4 pb-8 pt-10">
            {LOCALES.map(({ key, emoji, pais }) => (
              <button
                key={key}
                type="button"
                aria-label={pais}
                title={pais}
                onClick={() => setLocale(key)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-md transition ring-2 ring-offset-2 ring-offset-white ${
                  locale === key ? 'ring-[#0097b2]' : 'ring-transparent hover:opacity-90'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
