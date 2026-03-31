'use client'

import { useMemo, useState } from 'react'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useDenunciasEmpresa } from '../../hooks/useDenunciasEmpresa'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

export default function DenunciasEmpresa() {
  const { dados: empresa } = useDashboardEmpresa()
  const { denuncias, loading, error, responderViaChatAdm } = useDenunciasEmpresa(empresa?.id ?? null)

  const [modalAberto, setModalAberto] = useState(false)
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const selecionada = useMemo(() => denuncias.find((d) => d.id === selecionadaId) ?? null, [denuncias, selecionadaId])

  const abrir = (id: string) => {
    setSelecionadaId(id)
    setResposta('')
    setFeedback(null)
    setModalAberto(true)
  }

  const enviarResposta = async () => {
    if (!selecionada) return
    const txt = resposta.trim()
    if (!txt) return
    setEnviando(true)
    try {
      await responderViaChatAdm(selecionada.id, txt)
      setFeedback('✅ Resposta enviada para o atendimento ADM.')
      setModalAberto(false)
      setResposta('')
    } catch {
      setFeedback('❌ Não foi possível enviar a resposta.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-500">Carregando...</div>

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar denúncias: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {feedback ? <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{feedback}</div> : null}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">⚠️ Denúncias Recebidas</h3>
        {denuncias.length === 0 ? (
          <p className="py-8 text-center text-gray-500">Nenhuma denúncia recebida</p>
        ) : (
          <div className="space-y-3">
            {denuncias.map((denuncia) => (
              <button
                key={denuncia.id}
                type="button"
                className="w-full cursor-pointer rounded-lg border p-3 text-left hover:bg-gray-50"
                onClick={() => abrir(denuncia.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{denuncia.motivo}</p>
                    <p className="text-sm text-gray-500">
                      Por: {denuncia.denunciante_nome || denuncia.denunciante_email || 'Usuário'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">{formatDate(denuncia.created_at)}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
                        denuncia.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {denuncia.status === 'pendente' ? 'Em análise' : 'Resolvida'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {modalAberto && selecionada ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-4 font-bold text-[#001f3f]">Responder Denúncia</h3>
            <div className="mb-4">
              <p className="text-sm font-medium">Motivo: {selecionada.motivo}</p>
              <p className="mt-1 text-sm text-gray-600">{selecionada.descricao}</p>
              {selecionada.evidencias.length > 0 ? (
                <p className="mt-1 text-xs text-gray-500">📎 {selecionada.evidencias.length} evidência(s)</p>
              ) : null}
            </div>
            <textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="Sua resposta (será encaminhada ao atendimento ADM)..."
              className="mb-4 w-full rounded-lg border p-2"
              rows={4}
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setModalAberto(false)} className="flex-1 rounded-lg bg-gray-200 px-4 py-2">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void enviarResposta()}
                disabled={enviando || !resposta.trim()}
                className="flex-1 rounded-lg bg-[#0097b2] px-4 py-2 text-white disabled:opacity-50"
              >
                {enviando ? '...' : 'Enviar Resposta'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

