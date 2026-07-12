'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, FileText, ScrollText, Shield, ArrowLeft, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseRegrasEcossistema } from '@/lib/regrasEcossistema'

const APP_VERSION = '1.0.0'

const SECOES = [
  { id: 'regras', campo: 'regras_ecossistema', titulo: 'Regras do ecossistema', Icon: ScrollText },
  { id: 'privacidade', campo: 'politicas_privacidade', titulo: 'Políticas de privacidade', Icon: Shield },
  { id: 'termos', campo: 'termos_uso', titulo: 'Termos de uso', Icon: FileText },
]

export default function RegrasEcossistema() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(/** @type {Record<string, string>} */ ({}))
  const [secaoAtiva, setSecaoAtiva] = useState(/** @type {string | null} */ (null))
  const [regraAbertaId, setRegraAbertaId] = useState(/** @type {string | null} */ (null))

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
          regras_ecossistema: String(data?.regras_ecossistema ?? ''),
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
    if (secao.id === 'regras') {
      const regras = parseRegrasEcossistema(config.regras_ecossistema)
      return (
        <div className="px-1 pb-4">
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSecaoAtiva(null)
                setRegraAbertaId(null)
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0097b2] text-white shadow-sm transition hover:bg-[#007a91] active:brightness-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </button>
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-gray-900">
              {secao.titulo}
            </h2>
          </div>

          {regras.length === 0 ? (
            <p className="mt-4 text-center text-sm text-gray-500">Conteúdo em atualização.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {regras.map((regra) => {
                const aberta = regraAbertaId === regra.id
                return (
                  <li key={regra.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setRegraAbertaId(aberta ? null : regra.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-gray-50"
                      aria-expanded={aberta}
                    >
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">{regra.titulo}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${aberta ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>
                    {aberta ? (
                      <div className="whitespace-pre-wrap border-t border-gray-100 px-3 py-3 text-sm leading-relaxed text-gray-700">
                        {regra.texto.trim() || 'Sem texto.'}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )
    }

    const texto = config[secao.campo] || 'Conteúdo em atualização.'
    return (
      <div className="px-1 pb-4">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSecaoAtiva(null)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0097b2] text-white shadow-sm transition hover:bg-[#007a91] active:brightness-95"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-gray-900">{secao.titulo}</h2>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{texto}</div>
      </div>
    )
  }

  return (
    <div className="px-1 pb-4">
      {loading ? <p className="mt-2 text-center text-sm text-gray-400">Carregando…</p> : null}

      {!loading ? (
        <ul className="mt-1 divide-y divide-gray-100">
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
