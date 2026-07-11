'use client'

import { useState } from 'react'
import { DollarSign, FileText, CheckCircle, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { marcarFinanceiroItemLidoEmpresa } from '@/lib/canaisEmpresaVisibilidade'

/**
 * @param {{
 *   item: {
 *     id: string
 *     tipo: string
 *     titulo: string
 *     mensagem: string | null
 *     valor: number | null
 *     anexo_url: string | null
 *     lida_por_profissional: boolean
 *     lida_por_empresa: boolean
 *     created_at: string
 *     profissional_nome: string
 *     empresa_nome: string
 *     destino_rotulo?: string | null
 *   }
 *   userTipo: 'profissional' | 'empresa'
 *   destinoRotulo?: string | null
 *   onItemLido?: (itemId: string) => void | Promise<void>
 * }} props
 */
export default function CanalFinanceiroItem({ item, userTipo, destinoRotulo = null, onItemLido }) {
  const [marcandoLida, setMarcandoLida] = useState(false)
  const [lidaLocal, setLidaLocal] = useState(false)

  const getIcon = () => {
    switch (item.tipo) {
      case 'comissao':
        return <DollarSign size={20} className="text-green-500" aria-hidden />
      case 'pagamento':
        return <CheckCircle size={20} className="text-blue-500" aria-hidden />
      case 'manifesto':
      case 'manifesto_indicacao':
        return <FileText size={20} className="text-purple-500" aria-hidden />
      case 'mensagem_adm':
        return <FileText size={20} className="text-[#00D443]" aria-hidden />
      case 'recibo_atendimento':
        return <CheckCircle size={20} className="text-emerald-600" aria-hidden />
      case 'extrato_parceria':
      case 'extrato_comissao':
      case 'extrato_comissao_paga':
      case 'pagamento_pendente':
      case 'plano_assinatura':
      case 'degustacao_plano':
      case 'lembrete_vencimento_plano':
      case 'relatorio_pax':
      case 'relatorio_parceria':
      case 'comprovante_pagamento':
        return <DollarSign size={20} className="text-amber-600" aria-hidden />
      default:
        return <FileText size={20} className="text-gray-500" aria-hidden />
    }
  }

  const marcarComoLida = async () => {
    setMarcandoLida(true)
    try {
      if (typeof onItemLido === 'function') {
        await onItemLido(item.id)
        setLidaLocal(true)
        return
      }

      if (userTipo === 'empresa') {
        const ok = await marcarFinanceiroItemLidoEmpresa(supabase, '', item.id)
        if (!ok) throw new Error('Falha ao marcar como lida')
      } else {
        const { error } = await supabase
          .from('canal_financeiro')
          .update({ lida_por_profissional: true })
          .eq('id', item.id)
        if (error) throw error
      }
      setLidaLocal(true)
      notificarBadgeCanais()
    } catch (e) {
      console.error('Erro ao marcar como lida:', e)
    } finally {
      setMarcandoLida(false)
    }
  }

  const estaLida =
    lidaLocal ||
    (userTipo === 'profissional' ? item.lida_por_profissional : item.lida_por_empresa)
  const valorNum = item.valor != null ? Number(item.valor) : null

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${!estaLida ? 'border-l-4 border-[#00D443]' : ''}`}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">{getIcon()}</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-gray-800">{item.titulo}</h3>
            {!estaLida ? <span className="rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">Nova</span> : null}
            {destinoRotulo ? (
              <span className="rounded-full bg-[#0097b2]/10 px-2 py-0.5 text-xs font-semibold text-[#0097b2]">
                {destinoRotulo}
              </span>
            ) : null}
          </div>

          <p className="mb-2 text-sm text-gray-600">
            {destinoRotulo
              ? null
              : userTipo === 'profissional'
                ? item.empresa_nome
                : item.profissional_nome}
          </p>

          {item.mensagem ? <p className="mb-2 text-sm text-gray-500">{item.mensagem}</p> : null}

          {valorNum != null && valorNum > 0 ? (
            <p className="mb-2 text-lg font-bold text-[#00D443]">R$ {valorNum.toFixed(2)}</p>
          ) : null}

          {item.anexo_url ? (
            <a
              href={item.anexo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 inline-flex items-center gap-1 text-sm text-[#00D443]"
            >
              <Eye size={14} aria-hidden />
              Ver comprovante
            </a>
          ) : null}

          <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>

          {!estaLida ? (
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
