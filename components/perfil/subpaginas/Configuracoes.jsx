'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setCookie } from 'cookies-next'
import {
  BellOff,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Globe,
  KeyRound,
  MessageSquare,
  Moon,
  Trash2,
} from 'lucide-react'
import RegrasEcossistema from '@/components/perfil/subpaginas/RegrasEcossistema'

const IDIOMAS = [
  { codigo: 'pt', label: 'Português', bandeira: '🇧🇷' },
  { codigo: 'en', label: 'English', bandeira: '🇺🇸' },
  { codigo: 'es', label: 'Español', bandeira: '🇪🇸' },
]

/**
 * @param {{
 *   variant?: 'turista' | 'profissional' | 'empresa' | 'admin'
 * }} props
 */
export default function Configuracoes({ variant = 'turista' }) {
  const router = useRouter()
  const locale = useLocale()
  const [modoNoturno, setModoNoturno] = useState(false)
  const [notificacoes, setNotificacoes] = useState(true)
  const [idiomaAberto, setIdiomaAberto] = useState(false)
  const [view, setView] = useState(/** @type {'main' | 'regras'} */ ('main'))

  const mostrarFalarComAdm = variant === 'profissional'
  const idiomaAtual = IDIOMAS.find((i) => i.codigo === locale) ?? IDIOMAS[0]

  const mudarIdioma = (codigo) => {
    setCookie('NEXT_LOCALE', codigo, { path: '/' })
    setIdiomaAberto(false)
    router.refresh()
  }

  if (view === 'regras') {
    return <RegrasEcossistema onVoltar={() => setView('main')} />
  }

  return (
    <div className="space-y-1 px-1 pb-4">
      {/* Idioma — chevron */}
      <div className="rounded-xl border border-gray-100">
        <button
          type="button"
          onClick={() => setIdiomaAberto((v) => !v)}
          className="flex w-full items-center gap-3 px-3 py-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
            <Globe className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium text-gray-800">Idioma</span>
          <span className="text-xs text-gray-500">
            {idiomaAtual.bandeira} {idiomaAtual.label}
          </span>
          {idiomaAberto ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          )}
        </button>
        {idiomaAberto ? (
          <div className="border-t border-gray-100 px-3 pb-2 pt-1">
            {IDIOMAS.map((item) => (
              <button
                key={item.codigo}
                type="button"
                onClick={() => mudarIdioma(item.codigo)}
                className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  locale === item.codigo ? 'bg-[#e6f7fa] font-semibold text-[#007d94]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span aria-hidden>{item.bandeira}</span>
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Modo noturno */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
            <Moon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-sm font-medium text-gray-800">Modo noturno</span>
        </span>
        <Toggle checked={modoNoturno} onChange={setModoNoturno} />
      </div>

      {/* Silenciar notificações */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
            <BellOff className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-sm font-medium text-gray-800">Silenciar notificações</span>
        </span>
        <Toggle checked={!notificacoes} onChange={(silenciado) => setNotificacoes(!silenciado)} />
      </div>

      {mostrarFalarComAdm ? (
        <Link
          href="/canal"
          className="flex items-center gap-3 rounded-xl border border-[#0097b2]/20 bg-[#e6f7fa]/50 px-3 py-3 transition hover:bg-[#e6f7fa]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0097b2]">
            <MessageSquare className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-sm font-medium text-[#007d94]">Falar com ADM</span>
        </Link>
      ) : null}

      <div className="border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => setView('regras')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
            <BookOpen className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium text-gray-800">Regras do ecossistema</span>
          <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-gray-400" aria-hidden />
        </button>

        <Link
          href="/recuperar-senha"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
            <KeyRound className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium text-gray-800">Mudar senha</span>
        </Link>

        <button
          type="button"
          onClick={() => window.alert('Fluxo de exclusão de conta: em breve com confirmação por e-mail.')}
          className="mt-1 flex w-full items-center gap-3 rounded-xl bg-red-50 px-3 py-3 text-left transition hover:bg-red-100/80"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-600">
            <Trash2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex-1 text-sm font-medium text-red-600">Excluir conta</span>
        </button>
      </div>
    </div>
  )
}

/**
 * @param {{ checked: boolean, onChange: (v: boolean) => void }} props
 */
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#0097b2]' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-1 block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  )
}
