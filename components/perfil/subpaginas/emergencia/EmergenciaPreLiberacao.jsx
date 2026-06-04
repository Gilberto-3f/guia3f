'use client'

import { useMemo, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { turistaDocumentosEnviados } from '@/lib/faseVerificacaoConta'
import { MSG_PRE_LIBERACAO_REQUER_DOCS } from '@/lib/avisoVerificacaoContaTexto'

/**
 * Turista: solicita pré-liberação de 24h informando username do profissional verificado.
 */
export default function EmergenciaPreLiberacao() {
  const { turistaDocsRow, recursosTuristaLiberados, loading: gateLoading } = useProfissionalGate()
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState(/** @type {{ tipo: 'ok' | 'erro', texto: string } | null} */ (null))

  const docsEnviados = useMemo(() => turistaDocumentosEnviados(turistaDocsRow), [turistaDocsRow])
  const podeSolicitar = !gateLoading && docsEnviados && !recursosTuristaLiberados

  const enviar = async () => {
    if (!docsEnviados) {
      setFeedback({ tipo: 'erro', texto: MSG_PRE_LIBERACAO_REQUER_DOCS })
      return
    }
    const c = codigo.trim().replace(/^@+/, '')
    if (!c) {
      setFeedback({ tipo: 'erro', texto: 'Informe o username do profissional que lhe atendeu.' })
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
      setFeedback({
        tipo: 'ok',
        texto:
          json.mensagem ??
          'Solicitação enviada. O profissional verá o pedido em Canal → Financeiro → Relatórios do APP.',
      })
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
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0097b2]/10 text-[#0097b2]">
          <KeyRound size={22} aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Pré-liberação de Cadastro</h2>
          <p className="mt-1 text-sm text-gray-600">
            Informe o <strong>username</strong> do profissional verificado que lhe atendeu (sem @).
          </p>
        </div>
      </div>

      {!gateLoading && !docsEnviados ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{MSG_PRE_LIBERACAO_REQUER_DOCS}</p>
      ) : null}

      {recursosTuristaLiberados ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Seu cadastro já está liberado para compras e reservas no app.
        </p>
      ) : (
        <>
          <label className="block text-sm font-semibold text-gray-700">Username do profissional</label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ex: joao_guia"
            disabled={!podeSolicitar}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 disabled:bg-gray-100"
            autoCapitalize="off"
            autoCorrect="off"
          />

          {feedback ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'
              }`}
            >
              {feedback.texto}
            </p>
          ) : null}

          <button
            type="button"
            disabled={enviando || !podeSolicitar}
            onClick={() => void enviar()}
            className="w-full rounded-lg bg-[#00D443] py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Solicitar pré-liberação'}
          </button>

          <p className="text-sm leading-relaxed text-gray-600">
            Enquanto seu cadastro não é verificado pelo ADM, um profissional verificado pode liberar compras e
            reservas no app por <strong>24 horas</strong>, para vincular às suas compras de serviços pelo app.
          </p>
        </>
      )}
    </div>
  )
}
