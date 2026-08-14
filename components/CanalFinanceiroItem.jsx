'use client'

import { useState } from 'react'
import { DollarSign, FileText, CheckCircle, Eye, MessageCircle, Handshake } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { supabase } from '@/lib/supabase'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { marcarFinanceiroItemLidoEmpresa } from '@/lib/canaisEmpresaVisibilidade'
import { marcarFinanceiroItemLidoProfissional } from '@/lib/canaisProfissionalVisibilidade'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'

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
 *     metadata?: Record<string, unknown>
 *     comprovante_detalhes?: Record<string, unknown>
 *   }
 *   userTipo: 'profissional' | 'empresa'
 *   destinoRotulo?: string | null
 *   onItemLido?: (itemId: string) => void | Promise<void>
 *   onItemAtualizado?: (itemId: string, patch: Record<string, unknown>) => void
 * }} props
 */
export default function CanalFinanceiroItem({ item, userTipo, destinoRotulo = null, onItemLido, onItemAtualizado }) {
  const [marcandoLida, setMarcandoLida] = useState(false)
  const [lidaLocal, setLidaLocal] = useState(false)
  const [reforcando, setReforcando] = useState(false)
  const [erroReforcar, setErroReforcar] = useState('')
  const [cedeuLocal, setCedeuLocal] = useState(false)

  const detalhes =
    item.metadata && typeof item.metadata === 'object' && Object.keys(item.metadata).length > 0
      ? item.metadata
      : item.comprovante_detalhes && typeof item.comprovante_detalhes === 'object'
        ? item.comprovante_detalhes
        : {}
  const kind = detalhes.kind != null ? String(detalhes.kind) : ''
  const parceiroRaw =
    (detalhes.parceiro && typeof detalhes.parceiro === 'object' ? detalhes.parceiro : null) ||
    (detalhes.colega && typeof detalhes.colega === 'object' ? detalhes.colega : null)
  const parceiro = parceiroRaw && !Array.isArray(parceiroRaw) ? /** @type {Record<string, unknown>} */ (parceiroRaw) : null
  const mostrarParceiro =
    Boolean(parceiro) &&
    (kind === 'anfitriao_foi_recomendado' ||
      kind === 'indicador_contratacao_hospedagem' ||
      kind === 'proposta_parceria_base' ||
      kind === 'confirmar_pagamento_bilateral')
  const parceiroNome = parceiro?.nome != null ? String(parceiro.nome) : 'Profissional'
  const parceiroUsername = parceiro?.username != null ? String(parceiro.username) : ''
  const parceiroFoto = parceiro?.foto_url != null ? String(parceiro.foto_url) : null
  const parceiroWhatsapp = parceiro?.whatsapp != null ? String(parceiro.whatsapp) : ''
  const bilateralPagamento = kind === 'confirmar_pagamento_bilateral'
  const liquidadoBilateral = detalhes.liquidado === true
  const recomendadoEm =
    detalhes.recomendado_em != null && String(detalhes.recomendado_em).trim() !== ''
      ? String(detalhes.recomendado_em)
      : null

  const parceriaId =
    detalhes.parceria_id != null && String(detalhes.parceria_id).trim()
      ? String(detalhes.parceria_id).trim()
      : ''
  const cedeuFatia = cedeuLocal || detalhes.cedeu_fatia === true
  const podeReforcarParceria =
    userTipo === 'profissional' &&
    kind === 'parceria_comissao_empresa' &&
    String(detalhes.papel ?? '') === 'indicado' &&
    detalhes.pode_reforcar !== false &&
    !cedeuFatia &&
    Boolean(parceriaId)

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
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const uid = session?.user?.id ?? ''
        const ok = await marcarFinanceiroItemLidoProfissional(supabase, uid, item.id)
        if (!ok) throw new Error('Falha ao marcar como lida')
      }
      setLidaLocal(true)
      notificarBadgeCanais()
    } catch (e) {
      console.error('Erro ao marcar como lida:', e)
    } finally {
      setMarcandoLida(false)
    }
  }

  const reforcarParceria = async () => {
    if (!parceriaId || reforcando) return
    const confirmou = window.confirm(
      'Ao reforçar a parceria, você cede permanentemente sua fatia das comissões de empresas ao profissional que indicou você. O valor da rota tabelada não será alterado. Deseja continuar?',
    )
    if (!confirmou) return
    setReforcando(true)
    setErroReforcar('')
    try {
      const res = await fetch(`/api/profissional/parcerias/${encodeURIComponent(parceriaId)}/reforcar`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErroReforcar(String(json.error ?? 'Não foi possível reforçar a parceria.'))
        return
      }
      setCedeuLocal(true)
      if (typeof onItemAtualizado === 'function') {
        onItemAtualizado(item.id, {
          mensagem:
            'Parceria reforçada: você cedeu sua fatia das comissões de empresas ao indicador. Ele passa a receber 100% nesta parceria.',
          comprovante_detalhes: {
            ...detalhes,
            cedeu_fatia: true,
            pode_reforcar: false,
            split_regular_pct: 0,
            split_indicador_pct: 100,
          },
        })
      }
      notificarBadgeCanais()
    } catch {
      setErroReforcar('Não foi possível reforçar a parceria.')
    } finally {
      setReforcando(false)
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

          {mostrarParceiro ? (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                <AvatarImage
                  src={parceiroFoto}
                  alt=""
                  fill
                  className="h-full w-full object-cover"
                  sizes="44px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{parceiroNome}</p>
                <p className="truncate text-xs text-gray-500">
                  {parceiroUsername.startsWith('@') ? parceiroUsername : `@${parceiroUsername}`}
                </p>
              </div>
              {bilateralPagamento && parceiroWhatsapp ? (
                <button
                  type="button"
                  onClick={() => {
                    openWhatsAppChat(
                      parceiroWhatsapp,
                      `Olá ${parceiroNome}, sobre a confirmação de pagamento/recebimento da parceria no Guia 3F.`,
                    )
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#0097b2]/10 px-2 py-1.5 text-xs font-bold text-[#0097b2]"
                  aria-label="WhatsApp do parceiro"
                >
                  <MessageCircle size={14} aria-hidden />
                  WhatsApp
                </button>
              ) : null}
            </div>
          ) : null}

          {bilateralPagamento ? (
            <p className="mb-2 text-xs font-medium text-amber-800">
              {liquidadoBilateral
                ? 'Liquidado — ambas as partes confirmaram (sem timeout).'
                : 'Pendente até as duas partes confirmarem (sem prazo de expiração).'}
            </p>
          ) : null}

          {recomendadoEm ? (
            <p className="mb-2 text-xs text-gray-400">
              Recomendação: {new Date(recomendadoEm).toLocaleString('pt-BR')}
            </p>
          ) : null}

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

          {kind === 'parceria_comissao_empresa' ? (
            <p className="mb-2 text-xs font-medium text-[#0097b2]">
              {cedeuFatia
                ? 'Fatia do indicado cedida — indicador 100% nas comissões de empresas.'
                : `Split atual: indicado ${Number(detalhes.split_regular_pct) || 50}% · indicador ${Number(detalhes.split_indicador_pct) || 50}% (só comissões de empresas).`}
            </p>
          ) : null}

          {podeReforcarParceria ? (
            <div className="mb-2 space-y-1.5">
              <button
                type="button"
                onClick={() => void reforcarParceria()}
                disabled={reforcando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D443] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <Handshake size={16} aria-hidden />
                {reforcando ? 'Reforçando…' : 'REFORÇAR PARCERIA'}
              </button>
              <p className="text-[11px] leading-snug text-gray-500">
                Cede sua fatia das comissões de empresas ao profissional que indicou. Não altera o valor da rota tabelada.
              </p>
              {erroReforcar ? <p className="text-xs text-red-600">{erroReforcar}</p> : null}
            </div>
          ) : null}

          {cedeuFatia && kind === 'parceria_comissao_empresa' && String(detalhes.papel ?? '') === 'indicado' ? (
            <p className="mb-2 text-xs font-semibold text-emerald-700">Parceria reforçada — fatia cedida.</p>
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
