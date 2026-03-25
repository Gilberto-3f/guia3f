'use client'

import { useState } from 'react'
import Link from 'next/link'

const APP_VERSION = '1.0.0'

export default function Configuracoes() {
  const [idioma, setIdioma] = useState('pt')
  const [modoNoturno, setModoNoturno] = useState(false)
  const [notificacoes, setNotificacoes] = useState(true)

  return (
    <div className="scrollbar-perfil max-h-[70vh] space-y-6 overflow-y-auto px-1 pb-4">
      <div>
        <label className="font-medium text-gray-800">🌐 Idioma</label>
        <select
          value={idioma}
          onChange={(e) => setIdioma(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
        >
          <option value="pt">🇧🇷 Português</option>
          <option value="es">🇪🇸 Español</option>
          <option value="en">🇺🇸 English</option>
        </select>
        <p className="mt-1 text-xs text-gray-400">Preferência local (UI completa em breve).</p>
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
    </div>
  )
}
