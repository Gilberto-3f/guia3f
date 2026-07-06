'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { corPlanoHex, labelServicoPlano } from '@/lib/planosEmpresaCatalogo'
import {
  labelModalidadePlano,
  listarPlanosAtivosEmpresa,
  precoModalidadePlano,
} from '@/lib/contratarPlanoEmpresa'
import { normalizarPlanoSlug, planoEmpresaReconhecidoNoCatalogo } from '@/lib/planosEmpresaServicosGate'
import PopupPagamentoPlanoEmpresa from '@/components/empresa/PopupPagamentoPlanoEmpresa'

/** @typedef {'mensal' | 'trimestral' | 'anual'} ModalidadePlanoEmpresa */

const MODALIDADES = /** @type {const} */ (['mensal', 'trimestral', 'anual'])

/**
 * @param {import('@/lib/contratarPlanoEmpresa').PlanoEmpresaCatalogo} plano
 * @param {string | null | undefined} planoEmpresa
 */
function planoEhAtual(plano, planoEmpresa) {
  const atual = normalizarPlanoSlug(planoEmpresa ?? '')
  if (!atual || atual === 'gratuito') return false
  return normalizarPlanoSlug(plano.nome) === atual || normalizarPlanoSlug(plano.titulo) === atual
}

/**
 * Aba Planos do canal financeiro (empresa): catálogo fixo configurado pelo ADM.
 * @param {{ usuarioId: string }} props
 */
export default function CanalFinanceiroAbaPlanos({ usuarioId }) {
  const [planos, setPlanos] = useState(/** @type {import('@/lib/contratarPlanoEmpresa').PlanoEmpresaCatalogo[]} */ ([]))
  const [planoEmpresa, setPlanoEmpresa] = useState(/** @type {string | null} */ (null))
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [degustacaoPlanoTitulo, setDegustacaoPlanoTitulo] = useState(/** @type {string | null} */ (null))
  const [loading, setLoading] = useState(true)
  const [expandidoId, setExpandidoId] = useState(/** @type {string | null} */ (null))
  const [servicosAbertosId, setServicosAbertosId] = useState(/** @type {string | null} */ (null))
  const [modalidadePorPlano, setModalidadePorPlano] = useState(
    /** @type {Record<string, ModalidadePlanoEmpresa | ''>} */ ({}),
  )
  const [popupPagamento, setPopupPagamento] = useState(
    /** @type {{ aberto: boolean, plano: import('@/lib/contratarPlanoEmpresa').PlanoEmpresaCatalogo | null, modalidade: ModalidadePlanoEmpresa | null }} */ ({
      aberto: false,
      plano: null,
      modalidade: null,
    }),
  )
  const [feedback, setFeedback] = useState(/** @type {string | null} */ (null))
  const [erro, setErro] = useState(/** @type {string | null} */ (null))

  const carregar = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setErro(null)
    try {
      const [{ data: emp }, lista] = await Promise.all([
        supabase.from('empresas').select('id, plano').eq('usuario_id', usuarioId).maybeSingle(),
        listarPlanosAtivosEmpresa(supabase),
      ])
      setPlanoEmpresa(emp?.plano != null ? String(emp.plano) : null)
      setEmpresaId(emp?.id != null ? String(emp.id) : null)
      setPlanos(lista)

      if (emp?.id) {
        const agora = new Date().toISOString()
        const { data: deg } = await supabase
          .from('empresa_degustacoes')
          .select('id, planos ( titulo )')
          .eq('empresa_id', String(emp.id))
          .eq('status', 'ativa')
          .gt('expira_em', agora)
          .limit(1)
          .maybeSingle()
        if (deg?.id) {
          const planosJoin = deg.planos
          const titulo = Array.isArray(planosJoin) ? planosJoin[0]?.titulo : planosJoin?.titulo
          setDegustacaoPlanoTitulo(titulo != null ? String(titulo) : null)
        } else {
          setDegustacaoPlanoTitulo(null)
        }
      } else {
        setDegustacaoPlanoTitulo(null)
      }
    } catch {
      setErro('Não foi possível carregar os planos.')
      setPlanos([])
    } finally {
      setLoading(false)
    }
  }, [usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const planoContratadoTitulo = useMemo(() => {
    const match = planoEmpresaReconhecidoNoCatalogo(planoEmpresa, planos)
    return match?.titulo ?? null
  }, [planos, planoEmpresa])

  const toggleExpandido = (id) => {
    setExpandidoId((atual) => (atual === id ? null : id))
    setServicosAbertosId(null)
    setFeedback(null)
  }

  const toggleServicos = (id) => {
    setServicosAbertosId((atual) => (atual === id ? null : id))
  }

  const selecionarModalidade = (planoId, modalidade) => {
    setModalidadePorPlano((prev) => ({ ...prev, [planoId]: modalidade }))
    setFeedback(null)
  }

  const abrirPagamento = (plano) => {
    const modalidade = modalidadePorPlano[plano.id]
    if (!modalidade) return
    setFeedback(null)
    setErro(null)
    setPopupPagamento({ aberto: true, plano, modalidade })
  }

  const onContratadoPagamento = (msg, planoContratado = false) => {
    const plano = popupPagamento.plano
    if (planoContratado && plano) setPlanoEmpresa(plano.nome)
    setFeedback(msg)
    setExpandidoId(null)
    setServicosAbertosId(null)
    setPopupPagamento({ aberto: false, plano: null, modalidade: null })
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-gray-500">
        Carregando planos…
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {degustacaoPlanoTitulo ? (
        <p className="mb-2 text-xs font-semibold text-[#00D443]">Degustação ativa: {degustacaoPlanoTitulo}</p>
      ) : null}

      {planoContratadoTitulo ? (
        <p className="mb-4 text-xs font-semibold text-[#0097b2]">Plano atual: {planoContratadoTitulo}</p>
      ) : null}

      {feedback ? (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{feedback}</p>
      ) : null}
      {erro ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p> : null}

      {planos.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nenhum plano disponível no momento.</p>
      ) : (
        <ul className="space-y-2">
          {planos.map((plano) => {
            const aberto = expandidoId === plano.id
            const servicosAbertos = servicosAbertosId === plano.id
            const cor = corPlanoHex(plano.cor)
            const ehAtual = planoEhAtual(plano, planoEmpresa)
            const modalidade = modalidadePorPlano[plano.id] ?? ''
            const podeContratar = Boolean(modalidade) && !ehAtual

            return (
              <li key={plano.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleExpandido(plano.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={aberto}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: cor }}
                      aria-hidden
                    >
                      <DollarSign className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="truncate text-base font-bold text-gray-900">{plano.titulo}</span>
                    {ehAtual ? (
                      <span className="shrink-0 rounded-full bg-[#0097b2]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0097b2]">
                        Atual
                      </span>
                    ) : null}
                  </span>
                  {aberto ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
                  )}
                </button>

                {aberto ? (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    {plano.descricao ? (
                      <p className="text-sm leading-relaxed text-gray-600">{plano.descricao}</p>
                    ) : null}

                    {plano.servicos.length > 0 ? (
                      <div className={plano.descricao ? 'mt-4' : ''}>
                        <button
                          type="button"
                          onClick={() => toggleServicos(plano.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-left"
                          aria-expanded={servicosAbertos}
                        >
                          <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                            Serviços incluídos ({plano.servicos.length})
                          </span>
                          {servicosAbertos ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                          )}
                        </button>
                        {servicosAbertos ? (
                          <ol className="mt-2 space-y-2 pl-1">
                            {plano.servicos.map((sid, index) => (
                              <li key={sid} className="flex gap-2 text-xs text-gray-700">
                                <span
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                                  style={{ backgroundColor: cor }}
                                  aria-hidden
                                >
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 pt-0.5">{labelServicoPlano(sid)}</span>
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">Modalidade</p>
                    <div className="mt-2 flex gap-2">
                      {MODALIDADES.map((mod) => {
                        const selecionada = modalidade === mod
                        const preco = precoModalidadePlano(plano, mod)
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => selecionarModalidade(plano.id, mod)}
                            className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-2 py-2.5 text-center text-sm text-white transition ${
                              selecionada
                                ? 'opacity-100 ring-2 ring-gray-900/25 ring-offset-1'
                                : 'opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: cor }}
                          >
                            <span className="block text-xs font-semibold leading-tight">
                              {labelModalidadePlano(mod)}
                            </span>
                            <span className="mt-1 block text-[11px] font-bold leading-tight">
                              R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={!podeContratar}
                      onClick={() => abrirPagamento(plano)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#00b83b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
                      {ehAtual ? 'Plano atual' : 'Contratar'}
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <PopupPagamentoPlanoEmpresa
        aberto={popupPagamento.aberto}
        onFechar={() => setPopupPagamento({ aberto: false, plano: null, modalidade: null })}
        plano={popupPagamento.plano}
        modalidade={popupPagamento.modalidade}
        preco={
          popupPagamento.plano && popupPagamento.modalidade
            ? precoModalidadePlano(popupPagamento.plano, popupPagamento.modalidade)
            : 0
        }
        empresaId={empresaId}
        onContratado={onContratadoPagamento}
      />
    </div>
  )
}
