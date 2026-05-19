'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, FileText, ScrollText, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const APP_VERSION = '1.0.0'

const SECOES = [
  { id: 'regras', campo: 'regras_ecossistema', titulo: 'Regras do ecossistema', Icon: ScrollText },
  { id: 'privacidade', campo: 'politicas_privacidade', titulo: 'Políticas de privacidade', Icon: Shield },
  { id: 'termos', campo: 'termos_uso', titulo: 'Termos de uso', Icon: FileText },
]

/**
 * @param {{ onVoltar: () => void }} props
 */
export default function RegrasEcossistema({ onVoltar }) {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(/** @type {Record<string, string>} */ ({}))
  const [secaoAtiva, setSecaoAtiva] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    let ativo = true
    void (async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('config_geral')
          .select('regras_ecossistema, politicas_privacidade, termos_uso')
          .limit(1)
          .maybeSingle()
        if (!ativo) return
        setConfig({
          regras_ecossistema: String(data?.regras_ecossistema ?? 'Conteúdo em atualização.'),
          politicas_privacidade: String(data?.politicas_privacidade ?? 'Conteúdo em atualização.'),
          termos_uso: String(data?.termos_uso ?? 'Conteúdo em atualização.'),
        })
      } catch {
        if (ativo) setConfig({})
      } finally {
        if (ativo) setLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  const secao = SECOES.find((s) => s.id === secaoAtiva)

  if (secaoAtiva && secao) {
    const texto = config[secao.campo] ?? 'Conteúdo em atualização.'
    return (
      <div className="px-1 pb-4">
        <button type="button" onClick={() => setSecaoAtiva(null)} className="mb-3 text-sm font-medium text-[#0097b2] hover:underline">
          ← Voltar
        </button>
        <h2 className="text-lg font-bold text-gray-900">{secao.titulo}</h2>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{texto}</div>
      </div>
    )
  }

  return (
    <div className="px-1 pb-4">
      <button type="button" onClick={onVoltar} className="mb-3 text-sm font-medium text-[#0097b2] hover:underline">
        ← Voltar
      </button>
      <h2 className="text-lg font-bold text-gray-900">Regras do ecossistema</h2>
      <p className="mt-1 text-sm text-gray-600">Como o Guia 3F funciona e suas diretrizes de uso.</p>

      {loading ? <p className="mt-6 text-center text-sm text-gray-400">Carregando…</p> : null}

      {!loading ? (
        <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
          {SECOES.map(({ id, titulo, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setSecaoAtiva(id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-gray-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800">{titulo}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-6 text-center text-xs text-gray-400">Guia 3F v{APP_VERSION}</p>
    </div>
  )
}
