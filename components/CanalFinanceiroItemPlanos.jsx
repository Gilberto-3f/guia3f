'use client'

import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { corPlanoHex, labelServicoPlano } from '@/lib/planosEmpresaCatalogo'

/**
 * Card de planos no canal financeiro (tipo plano_assinatura).
 * @param {{
 *   item: {
 *     id: string
 *     titulo: string
 *     mensagem: string | null
 *     lida_por_empresa: boolean
 *     created_at: string
 *     metadata?: Record<string, unknown>
 *     comprovante_detalhes?: Record<string, unknown>
 *   }
 *   userTipo: 'profissional' | 'empresa'
 * }} props
 */
export default function CanalFinanceiroItemPlanos({ item, userTipo }) {
  const [marcandoLida, setMarcandoLida] = useState(false)
  const [solicitando, setSolicitando] = useState(false)
  const [feedback, setFeedback] = useState(/** @type {string | null} */ (null))

  const detalhes =
    item.comprovante_detalhes && typeof item.comprovante_detalhes === 'object'
      ? item.comprovante_detalhes
      : item.metadata && typeof item.metadata === 'object'
        ? item.metadata
        : {}

  const planosRaw = Array.isArray(detalhes.planos) ? detalhes.planos : []
  const planos = planosRaw.filter((p) => p && typeof p === 'object')

  const estaLida = userTipo === 'empresa' ? item.lida_por_empresa : false

  const marcarComoLida = async () => {
    if (userTipo !== 'empresa') return
    setMarcandoLida(true)
    try {
      const { error } = await supabase
        .from('canal_financeiro')
        .update({ lida_por_empresa: true })
        .eq('id', item.id)
      if (error) throw error
      notificarBadgeCanais()
    } catch (e) {
      console.error('Erro ao marcar como lida:', e)
    } finally {
      setMarcandoLida(false)
    }
  }

  const solicitarPlano = async (plano) => {
    if (userTipo !== 'empresa' || solicitando) return
    setSolicitando(true)
    setFeedback(null)
    try {
      const titulo = String(plano.titulo ?? plano.nome ?? 'Plano')
      const nome = String(plano.nome ?? titulo)
      const texto = `[PLANO] Solicitação de assinatura: ${titulo} (${nome})`

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) throw new Error('sessao')

      const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
      if (!emp?.id) throw new Error('empresa')

      const { error } = await supabase.from('mensagens_chat_adm').insert({
        empresa_id: emp.id,
        mensagem: texto,
        lida_admin: false,
      })
      if (error) throw error
      setFeedback(`Solicitação enviada para o plano ${titulo}.`)
    } catch {
      setFeedback('Não foi possível enviar a solicitação.')
    } finally {
      setSolicitando(false)
    }
  }

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${!estaLida ? 'border-l-4 border-[#00D443]' : ''}`}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
          <DollarSign size={20} className="text-amber-600" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-gray-800">{item.titulo}</h3>
            {!estaLida ? (
              <span className="rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">Nova</span>
            ) : null}
          </div>

          {item.mensagem ? <p className="mb-3 text-sm text-gray-600">{item.mensagem}</p> : null}

          {feedback ? <p className="mb-3 rounded-lg bg-gray-50 p-2 text-sm text-gray-700">{feedback}</p> : null}

          {planos.length > 0 ? (
            <div className="space-y-3">
              {planos.map((plano) => {
                const cor = corPlanoHex(plano.cor)
                const titulo = String(plano.titulo ?? plano.nome ?? 'Plano')
                const servicos = Array.isArray(plano.servicos) ? plano.servicos : []

                return (
                  <div key={String(plano.id ?? titulo)} className="rounded-lg border border-gray-200 p-3">
                    <div className="h-1 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: cor }}
                      >
                        <DollarSign className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                      </span>
                      <p className="font-bold text-gray-900">{titulo}</p>
                    </div>

                    {plano.descricao ? <p className="mt-2 text-xs text-gray-600">{String(plano.descricao)}</p> : null}

                    <div className="mt-2 space-y-0.5 text-xs text-gray-800">
                      <p>
                        <span className="font-semibold" style={{ color: cor }}>
                          Mensal:
                        </span>{' '}
                        R$ {Number(plano.precoMensal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-700">Trimestral:</span> R${' '}
                        {Number(plano.precoTrimestral ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-700">Anual:</span> R${' '}
                        {Number(plano.precoAnual ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {servicos.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[11px] text-gray-600">
                        {servicos.map((sid) => (
                          <li key={String(sid)} className="flex gap-1.5">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                            <span>{labelServicoPlano(String(sid))}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {userTipo === 'empresa' ? (
                      <button
                        type="button"
                        onClick={() => void solicitarPlano(plano)}
                        disabled={solicitando}
                        className="mt-3 w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-50"
                        style={{ backgroundColor: cor }}
                      >
                        Solicitar este plano
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhum plano disponível no momento.</p>
          )}

          <p className="mt-3 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>

          {!estaLida && userTipo === 'empresa' ? (
            <button
              type="button"
              onClick={() => void marcarComoLida()}
              disabled={marcandoLida}
              className="mt-2 text-xs text-gray-400 hover:text-[#00D443] disabled:opacity-50"
            >
              Marcar como lida
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
