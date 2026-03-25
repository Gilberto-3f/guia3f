'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const VERDE = '#00D443'

const emailOuUsuarioRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [locale, setLocale] = useState<'br' | 'py' | 'ar'>('br')

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

  return (
    <div className="min-h-screen bg-[#0097b2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Image
            src="/logo.png"
            alt="Guia 3F"
            width={150}
            height={50}
            priority
            className="h-auto w-auto object-contain"
          />
        </div>

        <div className="bg-white rounded-2xl border-2 border-[#0097b2] p-8 w-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              id="loginId"
              name="loginId"
              type="text"
              autoComplete="username"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="E-mail ou Usuário"
              className="w-full rounded-full bg-[#0097b2] text-white placeholder:italic placeholder:text-white outline-none px-5 py-3.5 text-sm"
            />

            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-full bg-[#0097b2] text-white placeholder:italic placeholder:text-white outline-none px-5 py-3.5 text-sm"
            />

            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-full py-3.5 font-bold text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
              style={{ backgroundColor: VERDE }}
            >
              {carregando ? 'Entrando...' : 'Login'}
            </button>
          </form>

          <div className="mt-4 flex justify-center gap-4">
            {(
              [
                { key: 'br' as const, label: 'Brasil', emoji: '🇧🇷' },
                { key: 'py' as const, label: 'Paraguai', emoji: '🇵🇾' },
                { key: 'ar' as const, label: 'Argentina', emoji: '🇦🇷' },
              ] as const
            ).map(({ key, label, emoji }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => setLocale(key)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-sm transition ring-2 ring-offset-2 ring-offset-white ${
                  locale === key ? 'ring-[#0097b2] opacity-100' : 'ring-transparent opacity-90 hover:opacity-100'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="mt-2 text-right">
            <Link
              href="/recuperar-senha"
              className="text-sm italic hover:underline text-[#0097b2]"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <hr className="my-8 border-gray-200" />

          <h2 className="mb-4 text-center text-lg font-bold text-[#0097b2]">
            Não tem cadastro no GUIA 3F?
          </h2>

          <div className="mb-6 space-y-3 text-sm leading-relaxed text-[#001f3f] italic">
            <p>
              Nosso aplicativo oferece um <span className="font-semibold not-italic">ecossistema</span> completo de
              serviços com profissionais locais, entre outros benefícios.
            </p>
            <p>
              Crie sua conta agora na melhor comunidade do turismo da{' '}
              <span className="font-semibold not-italic">Tríplice Fronteira</span> e desfrute de benefícios exclusivos:
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 not-italic text-[#001f3f]">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#0097b2] font-bold">→</span>
                <span>Mobilidade</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#0097b2] font-bold">→</span>
                <span>Guia Turístico</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#0097b2] font-bold">→</span>
                <span>Descontos</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#0097b2] font-bold">→</span>
                <span>Segurança</span>
              </div>
            </div>
          </div>

          <Link
            href="/escolha-perfil"
            className="block w-full rounded-full py-3.5 text-center font-bold text-white transition-colors hover:bg-[#00b838]"
            style={{ backgroundColor: VERDE }}
          >
            Criar Conta
          </Link>
        </div>
      </div>
    </div>
  )
}
