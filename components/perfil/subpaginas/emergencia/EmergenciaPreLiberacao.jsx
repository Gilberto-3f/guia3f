'use client'

import { useMemo, useState } from 'react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { turistaDocumentosEnviados } from '@/lib/faseVerificacaoConta'
import { MSG_PRE_LIBERACAO_REQUER_DOCS } from '@/lib/avisoVerificacaoContaTexto'
import { normalizarUsername } from '@/lib/turistaPreLiberacao'

const MSG_EXPLICATIVA =
  'Enquanto seu cadastro não é verificado pelo ADM, um profissional verificado pode liberar compras, reservas e mobilidade no app por 24 horas, para vincular às suas compras de serviços pelo app.'

/**
 * Turista: solicita pré-liberação de 24h informando username do profissional verificado.
 */
export default function EmergenciaPreLiberacao() {
  const { turistaDocsRow, recursosTuristaLiberados, loading: gateLoading } = useProfissionalGate()
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState(/** @type {{ tipo: 'erro', texto: string } | null} */ (null))
  const [ultimaSolicitacao, setUltimaSolicitacao] = useState(/** @type {string | null} */ (null))

  const docsEnviados = useMemo(() => turistaDocumentosEnviados(turistaDocsRow), [turistaDocsRow])
  const podeSolicitar = !gateLoading && docsEnviados && !recursosTuristaLiberados

  const enviar = async () => {
    if (!docsEnviados) {
      setFeedback({ tipo: 'erro', texto: MSG_PRE_LIBERACAO_REQUER_DOCS })
      return
    }
    const c = normalizarUsername(codigo)
    if (!c) {
      setFeedback({ tipo: 'erro', texto: 'Informe um username (@username ou username).' })
      return
    }
    setEnviando(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/turista/pre-liberacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ codigo: c }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setFeedback({ tipo: 'erro', texto: json.error ?? 'Não foi possível enviar a solicitação.' })
        return
      }
      const match = String(json.mensagem ?? '').match(/@([a-zA-Z0-9_.-]+)/)
      setUltimaSolicitacao(match?.[1] ?? c)
      setCodigo('')
      window.dispatchEvent(new Event('turista-gate-refresh'))
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de conexão. Tente novamente.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-4 p-4 text-gray-900">

      {!gateLoading && !docsEnviados ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{MSG_PRE_LIBERACAO_REQUER_DOCS}</p>
      ) : null}

      {recursosTuristaLiberados ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Seu cadastro já está liberado para compras e reservas no app.
        </p>
      ) : (
        <>
          <input
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setFeedback(null)
            }}
            placeholder="@username ou username (ex: @joao_guia)"
            disabled={!podeSolicitar}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 disabled:bg-gray-100"
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Username do profissional"
          />

          {feedback ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">{feedback.texto}</p>
          ) : null}

          <button
            type="button"
            disabled={enviando || !podeSolicitar}
            onClick={() => void enviar()}
            className="w-full rounded-lg bg-[#00D443] py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Solicitar pré-liberação'}
          </button>

          {ultimaSolicitacao ? (
            <p className="text-sm leading-relaxed text-emerald-800">
              Solicitação enviada para @{ultimaSolicitacao}. Em breve o profissional fará sua pré-liberação.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-gray-600">{MSG_EXPLICATIVA}</p>
          )}
        </>
      )}
    </div>
  )
}
