'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CanalFinanceiroItem from '@/components/CanalFinanceiroItem'
import CanalFinanceiroItemDegustacao from '@/components/CanalFinanceiroItemDegustacao'
import CanalFinanceiroItemPreLiberacao from '@/components/CanalFinanceiroItemPreLiberacao'
import CanalFinanceiroMensageiro from '@/components/CanalFinanceiroMensageiro'
import CanalFinanceiroAbaPlanos from '@/components/CanalFinanceiroAbaPlanos'
import {
  marcarFinanceiroItemLidoEmpresa,
  marcarFinanceiroLidoEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'
import { marcarFinanceiroLidoProfissional } from '@/lib/canaisProfissionalVisibilidade'
import {
  itemCanalFinanceiroPreLiberacao,
  listarPreLiberacoesHistoricoProfissional,
  listarPreLiberacoesPendentesProfissional,
} from '@/lib/turistaPreLiberacao'
import { contarMensageiroFinanceiroNaoLidas } from '@/lib/financeiroMensageiroLeitura'
import { notificarBadgeCanais, notificarBadgeCanaisAposLeitura } from '@/lib/canais-badge-events'

const abaCls = (ativo) =>
  `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
    ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`

/**
 * Canal financeiro do profissional ou empresa: relatórios do app + mensageiro ADM.
 * @param {{ usuarioId: string, tipo: 'profissional' | 'empresa' }} props
 */
export default function CanalFinanceiroUsuario({ usuarioId, tipo }) {
  const [aba, setAba] = useState(/** @type {'relatorios' | 'mensageiro' | 'planos'} */ ('relatorios'))
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [naoLidas, setNaoLidas] = useState(0)
  const [naoLidasMensageiro, setNaoLidasMensageiro] = useState(0)

  const marcarItemRelatorioLido = useCallback(
    async (itemId) => {
      if (!usuarioId || !itemId) return

      let persistiu = false
      if (tipo === 'empresa') {
        persistiu = await marcarFinanceiroItemLidoEmpresa(supabase, usuarioId, itemId)
      } else {
        const { data: prof } = await supabase
          .from('profissionais')
          .select('id')
          .eq('usuario_id', usuarioId)
          .maybeSingle()
        const profissionalId = prof?.id != null ? String(prof.id) : ''
        if (profissionalId) {
          const { data, error } = await supabase
            .from('canal_financeiro')
            .update({ lida_por_profissional: true })
            .eq('id', itemId)
            .eq('profissional_id', profissionalId)
            .select('id')
            .maybeSingle()
          persistiu = !error && Boolean(data?.id)
        }
      }

      if (!persistiu) return

      setItens((prev) => {
        const next = prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                lida_por_profissional: tipo === 'profissional' ? true : item.lida_por_profissional,
                lida_por_empresa: tipo === 'empresa' ? true : item.lida_por_empresa,
              }
            : item,
        )
        setNaoLidas(
          next.filter((item) => {
            if (item.tipo === 'pre_liberacao_turista' && !item.metadata?.respondido) return true
            return tipo === 'profissional' ? !item.lida_por_profissional : !item.lida_por_empresa
          }).length,
        )
        return next
      })
      notificarBadgeCanaisAposLeitura()
    },
    [tipo, usuarioId],
  )

  const marcarRelatoriosComoLidos = useCallback(async () => {
    if (!usuarioId) return
    if (tipo === 'profissional') {
      await marcarFinanceiroLidoProfissional(supabase, usuarioId)
    } else {
      await marcarFinanceiroLidoEmpresa(supabase, usuarioId)
    }
    setNaoLidas(0)
    setItens((prev) =>
      prev.map((item) => ({
        ...item,
        lida_por_profissional: tipo === 'profissional' ? true : item.lida_por_profissional,
        lida_por_empresa: tipo === 'empresa' ? true : item.lida_por_empresa,
      })),
    )
    notificarBadgeCanaisAposLeitura()
  }, [usuarioId, tipo])

  useEffect(() => {
    if (aba !== 'relatorios' || loading || !usuarioId) return
    const temNaoLidas = itens.some((item) => {
      if (item.tipo === 'pre_liberacao_turista' && !item.metadata?.respondido) return false
      return tipo === 'profissional' ? !item.lida_por_profissional : !item.lida_por_empresa
    })
    if (temNaoLidas) void marcarRelatoriosComoLidos()
  }, [aba, loading, itens, usuarioId, tipo, marcarRelatoriosComoLidos])

  const carregar = useCallback(async (opts = {}) => {
    const silencioso = opts.silencioso === true
    if (!usuarioId) return
    if (!silencioso) setLoading(true)
    try {
      let profissionalId = /** @type {string | null} */ (null)
      let empresaId = /** @type {string | null} */ (null)

      if (tipo === 'profissional') {
        const { data: p } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
        profissionalId = p?.id != null ? String(p.id) : null
      } else {
        const { data: e } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
        empresaId = e?.id != null ? String(e.id) : null
      }

      let query = supabase
        .from('canal_financeiro')
        .select(
          `
          id,
          tipo,
          titulo,
          mensagem,
          valor,
          anexo_url,
          lida_por_profissional,
          lida_por_empresa,
          metadata,
          comprovante_detalhes,
          created_at,
          profissional_id,
          empresa_id,
          profissionais (nome_completo),
          empresas (nome_fantasia)
        `,
        )
        .order('created_at', { ascending: false })

      if (tipo === 'profissional' && profissionalId) {
        query = query.eq('profissional_id', profissionalId)
      } else if (tipo === 'empresa' && empresaId) {
        query = query.eq('empresa_id', empresaId)
      }

      const { data, error } = await query
      if (error) throw error

      let formatados =
        data?.map((row) => {
          const r = /** @type {Record<string, unknown>} */ (row)
          const prof = r.profissionais
          const emp = r.empresas
          const pn =
            prof && typeof prof === 'object' && prof !== null && 'nome_completo' in prof
              ? String(/** @type {{ nome_completo?: string }} */ (prof).nome_completo ?? 'Profissional')
              : 'Profissional'
          const en =
            emp && typeof emp === 'object' && emp !== null && 'nome_fantasia' in emp
              ? String(/** @type {{ nome_fantasia?: string }} */ (emp).nome_fantasia ?? 'Empresa')
              : 'Empresa'

          return {
            id: String(r.id),
            tipo: String(r.tipo ?? ''),
            titulo: String(r.titulo ?? ''),
            mensagem: r.mensagem != null ? String(r.mensagem) : null,
            valor: r.valor != null ? Number(r.valor) : null,
            anexo_url: r.anexo_url != null ? String(r.anexo_url) : null,
            lida_por_profissional: Boolean(r.lida_por_profissional),
            lida_por_empresa: Boolean(r.lida_por_empresa),
            metadata:
              r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
                ? /** @type {Record<string, unknown>} */ (r.metadata)
                : {},
            comprovante_detalhes:
              r.comprovante_detalhes &&
              typeof r.comprovante_detalhes === 'object' &&
              !Array.isArray(r.comprovante_detalhes)
                ? /** @type {Record<string, unknown>} */ (r.comprovante_detalhes)
                : {},
            created_at: String(r.created_at ?? ''),
            profissional_nome: pn,
            empresa_nome: en,
          }
        }) ?? []

      if (tipo === 'profissional') {
        const pendentes = await listarPreLiberacoesPendentesProfissional(supabase, usuarioId)
        const historico = await listarPreLiberacoesHistoricoProfissional(supabase, usuarioId)

        const idsCanal = new Set(formatados.map((i) => String(i.id)))
        const solicitacoesNaLista = new Set(
          formatados
            .filter((i) => i.tipo === 'pre_liberacao_turista')
            .map((i) => String(i.metadata?.solicitacao_id ?? ''))
            .filter(Boolean),
        )

        const sinteticosPendentes = pendentes
          .filter((p) => !solicitacoesNaLista.has(p.id) && !(p.canal_financeiro_id && idsCanal.has(p.canal_financeiro_id)))
          .map((p) => itemCanalFinanceiroPreLiberacao(p))

        const sinteticosHistorico = historico
          .filter(
            (h) =>
              !solicitacoesNaLista.has(h.id) &&
              !(h.canal_financeiro_id && idsCanal.has(h.canal_financeiro_id)),
          )
          .map((h) =>
            itemCanalFinanceiroPreLiberacao({
              id: h.id,
              turista_usuario_id: h.turista_usuario_id,
              turista_username: h.turista_username,
              turista_nome: h.turista_nome,
              solicitado_em: h.solicitado_em,
              respondido_em: h.respondido_em,
              status: h.status,
              canal_financeiro_id: h.canal_financeiro_id,
              expira_em: h.expira_em,
            }),
          )

        formatados = [...sinteticosPendentes, ...sinteticosHistorico, ...formatados]
      }

      formatados.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      setItens(formatados)
      setNaoLidas(
        formatados.filter((item) => {
          if (item.tipo === 'pre_liberacao_turista' && !item.metadata?.respondido) return true
          return tipo === 'profissional' ? !item.lida_por_profissional : !item.lida_por_empresa
        }).length,
      )
      const msgNaoLidas = await contarMensageiroFinanceiroNaoLidas(supabase, usuarioId)
      setNaoLidasMensageiro(msgNaoLidas)
    } catch (e) {
      console.error('Erro ao carregar canal financeiro:', e)
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [usuarioId, tipo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!usuarioId) return

    let cancelled = false
    let ch = /** @type {ReturnType<typeof supabase.channel> | null} */ (null)

    const setup = async () => {
      let filterCol = /** @type {'profissional_id' | 'empresa_id'} */ ('profissional_id')
      let entityId = /** @type {string | null} */ (null)

      if (tipo === 'profissional') {
        const { data: p } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
        entityId = p?.id != null ? String(p.id) : null
      } else {
        filterCol = 'empresa_id'
        const { data: e } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
        entityId = e?.id != null ? String(e.id) : null
      }

      if (!entityId || cancelled) return

      ch = supabase
        .channel(`canal-financeiro-usuario-${entityId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'canal_financeiro',
            filter: `${filterCol}=eq.${entityId}`,
          },
          () => {
            if (!cancelled) {
              void carregar({ silencioso: true })
              notificarBadgeCanais()
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'financeiro_mensagens',
          },
          () => {
            if (!cancelled) {
              void carregar({ silencioso: true })
              notificarBadgeCanais()
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'financeiro_conversa_leitura',
            filter: `usuario_id=eq.${usuarioId}`,
          },
          () => {
            if (!cancelled) {
              void carregar({ silencioso: true })
            }
          },
        )

      if (tipo === 'profissional') {
        ch = ch.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'turista_pre_liberacoes',
            filter: `profissional_usuario_id=eq.${usuarioId}`,
          },
          () => {
            if (!cancelled) {
              void carregar({ silencioso: true })
              notificarBadgeCanais()
            }
          },
        )
      }

      ch = ch.subscribe()
    }

    void setup()

    return () => {
      cancelled = true
      if (ch) void supabase.removeChannel(ch)
    }
  }, [usuarioId, tipo, carregar])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="canal-financeiro-ui flex min-h-0 flex-1 flex-col text-gray-900">
      <div className="sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-white px-3 py-2" role="tablist">
        <div className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'relatorios'}
            className={`${abaCls(aba === 'relatorios')} relative`}
            onClick={() => setAba('relatorios')}
          >
            Relatórios
            {naoLidas > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'mensageiro'}
            className={`${abaCls(aba === 'mensageiro')} relative`}
            onClick={() => setAba('mensageiro')}
          >
            Mensageiro
            {naoLidasMensageiro > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {naoLidasMensageiro > 9 ? '9+' : naoLidasMensageiro}
              </span>
            ) : null}
          </button>
          {tipo === 'empresa' ? (
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'planos'}
              className={abaCls(aba === 'planos')}
              onClick={() => setAba('planos')}
            >
              Planos
            </button>
          ) : null}
        </div>
      </div>

      {aba === 'relatorios' ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {itens.filter((item) => !(tipo === 'empresa' && item.tipo === 'plano_assinatura')).length === 0 ? (
            <div className="py-8 text-center text-gray-400">Nenhuma movimentação financeira ainda</div>
          ) : (
            itens
              .filter((item) => !(tipo === 'empresa' && item.tipo === 'plano_assinatura'))
              .map((item) =>
                item.tipo === 'pre_liberacao_turista' && tipo === 'profissional' ? (
                  <CanalFinanceiroItemPreLiberacao
                    key={item.id}
                    item={item}
                    onRespondido={() => void carregar({ silencioso: true })}
                  />
                ) : item.tipo === 'degustacao_plano' && tipo === 'empresa' ? (
                  <CanalFinanceiroItemDegustacao
                    key={item.id}
                    item={item}
                    userTipo={tipo}
                    usuarioId={usuarioId}
                    onAceito={() => void carregar({ silencioso: true })}
                    onItemLido={marcarItemRelatorioLido}
                  />
                ) : (
                  <CanalFinanceiroItem key={item.id} item={item} userTipo={tipo} />
                ),
              )
          )}
        </div>
      ) : aba === 'planos' && tipo === 'empresa' ? (
        <CanalFinanceiroAbaPlanos usuarioId={usuarioId} />
      ) : (
        <CanalFinanceiroMensageiro usuarioId={usuarioId} />
      )}
    </div>
  )
}
