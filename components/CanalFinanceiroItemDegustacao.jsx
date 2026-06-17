'use client'

import { useEffect, useState } from 'react'
import { Check, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { marcarFinanceiroItemLidoEmpresa } from '@/lib/canaisEmpresaVisibilidade'

/**
 * Convite de degustação no canal financeiro da empresa.
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
 *   usuarioId: string
 *   onAceito?: () => void
 * }} props
 */
export default function CanalFinanceiroItemDegustacao({ item, userTipo, usuarioId, onAceito }) {
  const [aceitando, setAceitando] = useState(false)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))
  const [aceito, setAceito] = useState(false)
  const [degustacaoIdResolvido, setDegustacaoIdResolvido] = useState('')
  const [marcadaLida, setMarcadaLida] = useState(item.lida_por_empresa)

  const detalhes =
    item.comprovante_detalhes && typeof item.comprovante_detalhes === 'object'
      ? item.comprovante_detalhes
      : item.metadata && typeof item.metadata === 'object'
        ? item.metadata
        : {}

  const degustacaoIdMeta = String(detalhes.degustacao_id ?? '')
  const degustacaoId = degustacaoIdResolvido || degustacaoIdMeta
  const jaAceito = Boolean(detalhes.aceito) || aceito
  const estaLida = userTipo === 'empresa' ? marcadaLida || item.lida_por_empresa || jaAceito : false

  useEffect(() => {
    let ativo = true
    const resolverDegustacaoId = async () => {
      if (degustacaoIdMeta) {
        if (ativo) setDegustacaoIdResolvido(degustacaoIdMeta)
        return
      }
      const { data } = await supabase
        .from('empresa_degustacoes')
        .select('id')
        .eq('canal_financeiro_id', item.id)
        .maybeSingle()
      if (!ativo) return
      if (data?.id) setDegustacaoIdResolvido(String(data.id))
    }
    void resolverDegustacaoId()
    return () => {
      ativo = false
    }
  }, [degustacaoIdMeta, item.id])

  useEffect(() => {
    if (userTipo !== 'empresa' || !usuarioId || marcadaLida || item.lida_por_empresa) return
    let ativo = true
    const marcar = async () => {
      await marcarFinanceiroItemLidoEmpresa(supabase, usuarioId, item.id)
      if (!ativo) return
      setMarcadaLida(true)
      notificarBadgeCanais()
    }
    void marcar()
    return () => {
      ativo = false
    }
  }, [item.id, item.lida_por_empresa, marcadaLida, userTipo, usuarioId])

  const aceitar = async () => {
    if (userTipo !== 'empresa' || !degustacaoId || aceitando || jaAceito) return
    setAceitando(true)
    setErro(null)
    try {
      const res = await fetch('/api/empresa/degustacao/aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ degustacao_id: degustacaoId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível aceitar a degustação.')
        return
      }
      setAceito(true)
      setMarcadaLida(true)
      notificarBadgeCanais()
      window.dispatchEvent(new Event('empresa-gate-refresh'))
      window.dispatchEvent(new Event('perfil-atualizado'))
      onAceito?.()
    } catch {
      setErro('Erro de rede ao aceitar.')
    } finally {
      setAceitando(false)
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

          {item.mensagem ? (
            <p className="mb-3 whitespace-pre-line text-sm text-gray-600">{item.mensagem}</p>
          ) : null}

          {erro ? <p className="mb-2 text-sm text-rose-600">{erro}</p> : null}

          {userTipo === 'empresa' && !jaAceito ? (
            <button
              type="button"
              onClick={() => void aceitar()}
              disabled={aceitando || !degustacaoId}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0097b2] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              {aceitando ? 'Aceitando…' : degustacaoId ? 'ACEITAR' : 'Carregando…'}
            </button>
          ) : jaAceito ? (
            <p className="text-sm font-semibold text-[#00D443]">Degustação aceita. Aproveite o período bonificado!</p>
          ) : null}

          <p className="mt-3 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}
