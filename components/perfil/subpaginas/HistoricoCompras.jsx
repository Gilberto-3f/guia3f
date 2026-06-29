'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Briefcase, ShoppingBag, Bed, Ticket, UtensilsCrossed, Car } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  listarComprasTurista,
  marcarComprasTuristaComoVistas,
} from '@/lib/turistaCompras'
import { rotuloFormaPagamentoReservaHospedagem } from '@/lib/reservaHospedagem'

const STATUS_ROTULO = {
  pendente: 'Aguardando anfitrião',
  confirmada: 'Confirmada',
  cancelada: 'Recusada',
  registrada: 'Registrada',
}

function iconeCompra(tipo) {
  if (tipo === 'reserva_hospedagem') return Bed
  if (tipo === 'compra_ticket') return Ticket
  if (tipo === 'reserva_mesa') return UtensilsCrossed
  if (tipo === 'mobilidade' || tipo === 'mobilidade_corrida') return Car
  return ShoppingBag
}

function statusCls(status) {
  if (status === 'confirmada' || status === 'registrada') return 'bg-emerald-50 text-emerald-700'
  if (status === 'pendente') return 'bg-amber-50 text-amber-700'
  if (status === 'cancelada') return 'bg-red-50 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function formatarData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * @param {{ usuarioId: string | null }} props
 */
export default function HistoricoCompras({ usuarioId }) {
  const router = useRouter()
  const [aba, setAba] = useState(/** @type {'servicos' | 'compras'} */ ('compras'))
  const [loading, setLoading] = useState(true)
  const [itens, setItens] = useState(/** @type {import('@/lib/turistaCompras').TuristaCompraRow[]} */ ([]))
  const [mobilidadeExtra, setMobilidadeExtra] = useState([])

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setItens([])
      setMobilidadeExtra([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const categoria = aba === 'servicos' ? 'servicos' : 'compras'
      const lista = await listarComprasTurista(supabase, usuarioId, { categoria, limit: 80 })
      setItens(lista)

      if (aba === 'servicos') {
        const { data: sols } = await supabase
          .from('solicitacao_mobilidade')
          .select('id, status, created_at, profissional_id, profissionais(nome_completo, nome_usuario)')
          .eq('turista_id', usuarioId)
          .order('created_at', { ascending: false })
          .limit(40)

        const refsCompra = new Set(
          lista.filter((i) => i.referencia_id).map((i) => String(i.referencia_id)),
        )

        const extra = (sols ?? [])
          .filter((s) => !refsCompra.has(String(s.id)))
          .map((s) => {
            const prof = s.profissionais && typeof s.profissionais === 'object' ? s.profissionais : null
            const nome =
              prof?.nome_completo != null
                ? String(prof.nome_completo)
                : prof?.nome_usuario != null
                  ? String(prof.nome_usuario)
                  : 'Profissional'
            return {
              id: `mob-${s.id}`,
              titulo: `Mobilidade — ${nome}`,
              descricao: null,
              status: String(s.status ?? 'pendente'),
              registrado_em: String(s.created_at ?? ''),
              tipo: 'mobilidade',
              empresa_id: null,
              pendente: false,
            }
          })
        setMobilidadeExtra(extra)
      } else {
        setMobilidadeExtra([])
      }
    } finally {
      setLoading(false)
    }

    void marcarComprasTuristaComoVistas(supabase, usuarioId).then(() => {
      window.dispatchEvent(new CustomEvent('turista-compras-lidas'))
    })
  }, [usuarioId, aba])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const tabCls = (ativo) =>
    `flex-1 py-2.5 text-center text-xs font-semibold tracking-wide transition-colors ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  const listaExibir = aba === 'servicos' ? [...itens, ...mobilidadeExtra] : itens

  const abrirEmpresa = (empresaId) => {
    if (!empresaId) return
    router.push(`/empresa/${empresaId}`)
  }

  return (
    <div className="px-1 pb-4">
      <div className="mb-1 flex border-b border-gray-200">
        <button type="button" className={tabCls(aba === 'servicos')} onClick={() => setAba('servicos')}>
          SERVIÇOS
        </button>
        <button type="button" className={tabCls(aba === 'compras')} onClick={() => setAba('compras')}>
          COMPRAS
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          {aba === 'servicos' ? (
            <>
              <Briefcase className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span>Serviços de profissionais contratados pelo app.</span>
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span>Tickets e reservas feitas pelo aplicativo.</span>
            </>
          )}
        </div>

        {loading ? (
          <ul className="space-y-2" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </ul>
        ) : listaExibir.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
            {aba === 'servicos' ? 'Nenhum serviço contratado ainda' : 'Nenhuma compra registrada ainda'}
          </div>
        ) : (
          <ul className="space-y-2">
            {listaExibir.map((item) => {
              const Ico = iconeCompra(item.tipo)
              const status = String(item.status ?? 'registrada')
              const meta =
                item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
              const formaPag = rotuloFormaPagamentoReservaHospedagem(meta.forma_pagamento)
              const motivoRecusa = meta.motivo_recusa != null ? String(meta.motivo_recusa) : null

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => abrirEmpresa(item.empresa_id)}
                    disabled={!item.empresa_id}
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-100 bg-white px-3 py-3 text-left shadow-sm transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/10 text-[#0097b2]">
                      <Ico className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{item.titulo}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusCls(status)}`}
                        >
                          {STATUS_ROTULO[status] ?? status}
                        </span>
                        {item.pendente ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#00D443]" aria-label="Novo" />
                        ) : null}
                      </span>
                      {item.descricao ? (
                        <span className="mt-0.5 block text-xs text-gray-600">{item.descricao}</span>
                      ) : null}
                      {formaPag ? (
                        <span className="mt-0.5 block text-xs text-gray-500">Pagamento: {formaPag}</span>
                      ) : null}
                      {motivoRecusa ? (
                        <span className="mt-0.5 block text-xs text-red-600">Motivo: {motivoRecusa}</span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-gray-400">
                        {formatarData(item.registrado_em)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
