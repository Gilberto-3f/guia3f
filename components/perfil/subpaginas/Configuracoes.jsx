'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setCookie } from 'cookies-next'

const APP_VERSION = '1.0.0'

export default function Configuracoes() {
  const router = useRouter()
  const locale = useLocale()
  const [modoNoturno, setModoNoturno] = useState(false)
  const [notificacoes, setNotificacoes] = useState(true)
  const [idiomaModalAberto, setIdiomaModalAberto] = useState(false)

  const mudarIdioma = (codigo) => {
    setCookie('NEXT_LOCALE', codigo, { path: '/' })
    setIdiomaModalAberto(false)
    router.refresh()
  }

  return (
    <div className="space-y-6 px-1 pb-2">
      <div>
        <label className="font-medium text-gray-800">🌐 Idioma</label>
        <button
          type="button"
          onClick={() => setIdiomaModalAberto(true)}
          className="mt-1 flex w-full items-center justify-between rounded-lg border border-gray-200 p-2 text-sm text-gray-800"
        >
          <span>
            {locale === 'pt' ? '🇧🇷 Português' : locale === 'en' ? '🇺🇸 English' : '🇪🇸 Español'}
          </span>
          <span className="text-gray-400">▾</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-800">🌙 Modo noturno</span>
        <button
          type="button"
          role="switch"
          aria-checked={modoNoturno}
          onClick={() => setModoNoturno(!modoNoturno)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${modoNoturno ? 'bg-[#0097b2]' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-1 block h-5 w-5 rounded-full bg-white shadow transition-transform ${modoNoturno ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-800">🔕 Silenciar notificações</span>
        <button
          type="button"
          role="switch"
          aria-checked={!notificacoes}
          onClick={() => setNotificacoes(!notificacoes)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${!notificacoes ? 'bg-[#0097b2]' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-1 block h-5 w-5 rounded-full bg-white shadow transition-transform ${!notificacoes ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>

      <Link
        href="/canal"
        className="block w-full rounded-xl bg-sky-50 py-3 text-center text-sm font-medium text-sky-700"
      >
        🆘 Falar com ADM
      </Link>

      <div className="border-t border-gray-100 pt-4 text-center text-sm text-gray-400">Guia 3F v{APP_VERSION}</div>

      <Link href="/recuperar-senha" className="block w-full rounded-xl border border-gray-200 py-3 text-center text-sm font-medium text-gray-800">
        🔐 Mudar senha
      </Link>

      <button
        type="button"
        className="w-full rounded-xl bg-red-50 py-3 text-sm font-medium text-red-600"
        onClick={() => window.alert('Fluxo de exclusão de conta: em breve com confirmação por e-mail.')}
      >
        🗑️ Excluir conta
      </button>

      {idiomaModalAberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Selecionar idioma</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => mudarIdioma('pt')}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  locale === 'pt' ? 'border-[#0097b2] text-[#0097b2]' : 'border-gray-200 text-gray-700'
                }`}
              >
                🇧🇷 Português
              </button>
              <button
                type="button"
                onClick={() => mudarIdioma('en')}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  locale === 'en' ? 'border-[#0097b2] text-[#0097b2]' : 'border-gray-200 text-gray-700'
                }`}
              >
                🇺🇸 English
              </button>
              <button
                type="button"
                onClick={() => mudarIdioma('es')}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  locale === 'es' ? 'border-[#0097b2] text-[#0097b2]' : 'border-gray-200 text-gray-700'
                }`}
              >
                🇪🇸 Español
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIdiomaModalAberto(false)}
              className="mt-4 w-full rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
