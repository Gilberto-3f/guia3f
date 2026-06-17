'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { corPlanoHex, labelServicoPlano } from '@/lib/planosEmpresaCatalogo'
import {
  labelModalidadePlano,
  listarPlanosAtivosEmpresa,
  precoModalidadePlano,
} from '@/lib/contratarPlanoEmpresa'
import { normalizarPlanoSlug } from '@/lib/planosEmpresaServicosGate'

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
  const [loading, setLoading] = useState(true)
  const [expandidoId, setExpandidoId] = useState(/** @type {string | null} */ (null))
  const [modalidadePorPlano, setModalidadePorPlano] = useState(
    /** @type {Record<string, ModalidadePlanoEmpresa | ''>} */ ({}),
  )
  const [contratandoId, setContratandoId] = useState(/** @type {string | null} */ (null))
  const [feedback, setFeedback] = useState(/** @type {string | null} */ (null))
  const [erro, setErro] = useState(/** @type {string | null} */ (null))

  const carregar = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setErro(null)
    try {
      const [{ data: emp }, lista] = await Promise.all([
        supabase.from('empresas').select('plano').eq('usuario_id', usuarioId).maybeSingle(),
        listarPlanosAtivosEmpresa(supabase),
      ])
      setPlanoEmpresa(emp?.plano != null ? String(emp.plano) : null)
      setPlanos(lista)
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

  useEffect(() => {
    if (!usuarioId) return
    const ch = supabase
      .channel(`planos-empresa-${usuarioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planos' }, () => {
        void carregar()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [usuarioId, carregar])

  const planoAtualTitulo = useMemo(() => {
    const match = planos.find((p) => planoEhAtual(p, planoEmpresa))
    return match?.titulo ?? (planoEmpresa && planoEmpresa !== 'gratuito' ? planoEmpresa : null)
  }, [planos, planoEmpresa])

  const toggleExpandido = (id) => {
    setExpandidoId((atual) => (atual === id ? null : id))
    setFeedback(null)
  }

  const selecionarModalidade = (planoId, modalidade) => {
    setModalidadePorPlano((prev) => ({ ...prev, [planoId]: modalidade }))
    setFeedback(null)
  }

  const contratar = async (plano) => {
    const modalidade = modalidadePorPlano[plano.id]
    if (!modalidade || contratandoId) return

    setContratandoId(plano.id)
    setFeedback(null)
    setErro(null)
    try {
      const res = await fetch('/api/empresa/contratar-plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano_id: plano.id, modalidade }),
      })
      const json = (await res.json())
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível contratar o plano.')
        return
      }
      setPlanoEmpresa(plano.nome)
      setFeedback(
        `Plano ${json.plano_titulo ?? plano.titulo} (${labelModalidadePlano(modalidade)}) contratado. Os serviços do plano foram liberados.`,
      )
      setExpandidoId(null)
    } catch {
      setErro('Falha de conexão ao contratar.')
    } finally {
      setContratandoId(null)
    }
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
      <p className="mb-1 text-sm text-gray-600">
        Planos configurados pela administração. Escolha a modalidade e contrate para liberar os serviços do plano.
      </p>

      {planoAtualTitulo ? (
        <p className="mb-4 text-xs font-semibold text-[#0097b2]">Plano atual: {planoAtualTitulo}</p>
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
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cor }}
                      aria-hidden
                    />
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

                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-500">Modalidade</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {MODALIDADES.map((mod) => {
                        const selecionada = modalidade === mod
                        const preco = precoModalidadePlano(plano, mod)
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => selecionarModalidade(plano.id, mod)}
                            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                              selecionada
                                ? 'border-[#0097b2] bg-[#e6f7fa] ring-1 ring-[#0097b2]/30'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <span className="block font-semibold text-gray-900">{labelModalidadePlano(mod)}</span>
                            <span className="mt-0.5 block text-xs text-gray-600">
                              R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {plano.servicos.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Serviços incluídos</p>
                        <ul className="mt-2 space-y-1.5">
                          {plano.servicos.map((sid) => (
                            <li key={sid} className="flex gap-2 text-xs text-gray-700">
                              <span
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: cor }}
                                aria-hidden
                              />
                              <span>{labelServicoPlano(sid)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      disabled={!podeContratar || contratandoId === plano.id}
                      onClick={() => void contratar(plano)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#00b83b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
                      {contratandoId === plano.id ? 'Contratando…' : ehAtual ? 'Plano atual' : 'Contratar'}
                    </button>
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
