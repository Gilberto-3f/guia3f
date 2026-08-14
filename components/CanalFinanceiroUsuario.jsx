'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CanalFinanceiroItem from '@/components/CanalFinanceiroItem'
import CanalFinanceiroItemDegustacao from '@/components/CanalFinanceiroItemDegustacao'
import CanalFinanceiroItemPreLiberacao from '@/components/CanalFinanceiroItemPreLiberacao'
import CanalFinanceiroItemReservaHospedagem from '@/components/CanalFinanceiroItemReservaHospedagem'
import CanalFinanceiroItemLembreteVencimento from '@/components/CanalFinanceiroItemLembreteVencimento'
import CanalFinanceiroMensageiro from '@/components/CanalFinanceiroMensageiro'
import CanalFinanceiroAbaPlanos from '@/components/CanalFinanceiroAbaPlanos'
import {
  buscarMapaStatusDegustacaoCanalEmpresa,
  itemCanalFinanceiroContaComoNaoLidoEmpresa,
  marcarFinanceiroItemLidoEmpresa,
  marcarFinanceiroLidoEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'
import {
  marcarFinanceiroItemLidoProfissional,
  marcarFinanceiroLidoProfissional,
} from '@/lib/canaisProfissionalVisibilidade'
import {
  itemCanalFinanceiroPreLiberacao,
  listarPreLiberacoesHistoricoProfissional,
  listarPreLiberacoesPendentesProfissional,
} from '@/lib/turistaPreLiberacao'
import { contarMensageiroFinanceiroNaoLidas } from '@/lib/financeiroMensageiroLeitura'
import { notificarBadgeCanais, notificarBadgeCanaisAposLeitura } from '@/lib/canais-badge-events'
import {
  categoriasIncluemAnfitriao,
  rotuloDestinoNotificacaoFinanceira,
  rotuloDestinoNotificacaoFinanceiraTexto,
} from '@/lib/anfitriaoDualMode'
import { dedupeItensCanalReservaHospedagem } from '@/lib/reservaHospedagem'
import { TITULO_PLANOS_CANAL } from '@/lib/canalFinanceiroPlanosEmpresa'
import { itemCanalFinanceiroEhAvisoManifesto } from '@/lib/recomendacaoContratacaoDestino'

/** Catálogo de planos fica na aba Planos; avisos de assinatura ativa aparecem em Relatórios. */
function ocultarPlanoAssinaturaCatalogoRelatorios(item, userTipo) {
  if (userTipo !== 'empresa' || item.tipo !== 'plano_assinatura') return false
  if (String(item.titulo ?? '').trim() === TITULO_PLANOS_CANAL) return true
  const detalhes =
    item.comprovante_detalhes && typeof item.comprovante_detalhes === 'object'
      ? item.comprovante_detalhes
      : item.metadata && typeof item.metadata === 'object'
        ? item.metadata
        : {}
  return detalhes.variant === 'catalogo_planos'
}

const abaCls = (ativo) =>
  `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
    ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`

function itemRelatorioContaComoNaoLido(item, tipo, statusDegustacaoPorCanal, empresaHospedagemId, ocultarManifesto) {
  if (ocultarManifesto && itemCanalFinanceiroEhAvisoManifesto(item)) return false
  if (item.tipo === 'pre_liberacao_turista' && !item.metadata?.respondido) return true
  if (item.tipo === 'reserva_hospedagem') {
    const respondido = String(item.metadata?.respondido ?? '').trim()
    if (!respondido) return true
    if (tipo === 'empresa' || (empresaHospedagemId && item.empresa_id)) {
      return !item.lida_por_empresa
    }
    return !item.lida_por_profissional
  }
  if (empresaHospedagemId && item.empresa_id) {
    return itemCanalFinanceiroContaComoNaoLidoEmpresa(
      {
        id: item.id,
        lida_por_empresa: item.lida_por_empresa,
        tipo: item.tipo,
        metadata: item.metadata,
        comprovante_detalhes: item.comprovante_detalhes,
      },
      statusDegustacaoPorCanal,
    )
  }
  if (tipo === 'empresa') {
    return itemCanalFinanceiroContaComoNaoLidoEmpresa(
      {
        id: item.id,
        lida_por_empresa: item.lida_por_empresa,
        tipo: item.tipo,
        metadata: item.metadata,
        comprovante_detalhes: item.comprovante_detalhes,
      },
      statusDegustacaoPorCanal,
    )
  }
  return !item.lida_por_profissional
}

/**
 * Canal financeiro do profissional ou empresa: relatórios do app + mensageiro ADM.
 * @param {{ usuarioId: string, tipo: 'profissional' | 'empresa', empresaHospedagemId?: string | null, ehAnfitriao?: boolean }} props
 */
export default function CanalFinanceiroUsuario({
  usuarioId,
  tipo,
  empresaHospedagemId = null,
  ehAnfitriao: ehAnfitriaoProp = false,
}) {
  const modoAnfitriaoFinanceiro = tipo === 'profissional' && Boolean(empresaHospedagemId)
  const [aba, setAba] = useState(/** @type {'relatorios' | 'mensageiro' | 'planos'} */ ('relatorios'))
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [naoLidas, setNaoLidas] = useState(0)
  const [naoLidasMensageiro, setNaoLidasMensageiro] = useState(0)
  const [ehAnfitriao, setEhAnfitriao] = useState(Boolean(ehAnfitriaoProp))
  const [statusDegustacaoPorCanal, setStatusDegustacaoPorCanal] = useState(
    /** @type {Map<string, string>} */ (() => new Map()),
  )
  const ocultarManifesto = tipo === 'profissional' && ehAnfitriao
  const abaRef = useRef(aba)
  const marcandoLeituraRef = useRef(false)
  const carregarSeqRef = useRef(0)

  useEffect(() => {
    abaRef.current = aba
  }, [aba])

  useEffect(() => {
    setEhAnfitriao(Boolean(ehAnfitriaoProp))
  }, [ehAnfitriaoProp])

  const aplicarLeituraLocalNosItens = useCallback(
    (lista, persistiuProf, persistiuEmpresa) => {
      const visualizadoEm = new Date().toISOString()
      return lista.map((item) => {
        const itemEmpresa = Boolean(item.empresa_id)
        const marcarProf =
          persistiuProf &&
          tipo === 'profissional' &&
          (!modoAnfitriaoFinanceiro || !itemEmpresa)
        const marcarEmp =
          persistiuEmpresa && (tipo === 'empresa' || (modoAnfitriaoFinanceiro && itemEmpresa))
        return {
          ...item,
          lida_por_profissional: marcarProf ? true : item.lida_por_profissional,
          lida_por_empresa: marcarEmp ? true : item.lida_por_empresa,
          metadata:
            marcarEmp && item.tipo === 'degustacao_plano'
              ? { ...(item.metadata ?? {}), visualizado_em: visualizadoEm }
              : item.metadata,
          comprovante_detalhes:
            marcarEmp && item.tipo === 'degustacao_plano'
              ? { ...(item.comprovante_detalhes ?? item.metadata ?? {}), visualizado_em: visualizadoEm }
              : item.comprovante_detalhes,
        }
      })
    },
    [tipo, modoAnfitriaoFinanceiro],
  )

  const marcarItemRelatorioLido = useCallback(
    async (itemId) => {
      if (!usuarioId || !itemId) return

      const alvo = itens.find((row) => row.id === itemId)
      const viaEmpresa =
        tipo === 'empresa' || (modoAnfitriaoFinanceiro && Boolean(alvo?.empresa_id))

      let persistiu = false
      if (viaEmpresa) {
        persistiu = await marcarFinanceiroItemLidoEmpresa(supabase, usuarioId, itemId)
      } else {
        persistiu = await marcarFinanceiroItemLidoProfissional(supabase, usuarioId, itemId)
      }

      if (!persistiu) return

      setItens((prev) => {
        const visualizadoEm = new Date().toISOString()
        const next = prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                lida_por_profissional:
                  !viaEmpresa || tipo === 'profissional' ? true : item.lida_por_profissional,
                lida_por_empresa: viaEmpresa ? true : item.lida_por_empresa,
                metadata:
                  viaEmpresa && item.tipo === 'degustacao_plano'
                    ? { ...(item.metadata ?? {}), visualizado_em: visualizadoEm }
                    : item.metadata,
                comprovante_detalhes:
                  viaEmpresa && item.tipo === 'degustacao_plano'
                    ? { ...(item.comprovante_detalhes ?? item.metadata ?? {}), visualizado_em: visualizadoEm }
                    : item.comprovante_detalhes,
              }
            : item,
        )
        setNaoLidas(
          next.filter((row) =>
            itemRelatorioContaComoNaoLido(
              row,
              tipo,
              statusDegustacaoPorCanal,
              empresaHospedagemId,
              ocultarManifesto,
            ),
          ).length,
        )
        return next
      })
      notificarBadgeCanaisAposLeitura()
    },
    [
      tipo,
      usuarioId,
      statusDegustacaoPorCanal,
      empresaHospedagemId,
      modoAnfitriaoFinanceiro,
      itens,
      ocultarManifesto,
    ],
  )

  const marcarRelatoriosComoLidos = useCallback(async () => {
    if (!usuarioId || marcandoLeituraRef.current) return false
    marcandoLeituraRef.current = true
    try {
      let persistiuProf = false
      let persistiuEmpresa = false
      if (tipo === 'profissional') {
        persistiuProf = await marcarFinanceiroLidoProfissional(supabase, usuarioId)
        if (modoAnfitriaoFinanceiro) {
          persistiuEmpresa = await marcarFinanceiroLidoEmpresa(supabase, usuarioId)
        }
      } else {
        persistiuEmpresa = await marcarFinanceiroLidoEmpresa(supabase, usuarioId)
      }
      if (!persistiuProf && !persistiuEmpresa) return false

      setItens((prev) => {
        const next = aplicarLeituraLocalNosItens(prev, persistiuProf, persistiuEmpresa)
        setNaoLidas(
          next.filter((row) =>
            itemRelatorioContaComoNaoLido(
              row,
              tipo,
              statusDegustacaoPorCanal,
              empresaHospedagemId,
              ocultarManifesto,
            ),
          ).length,
        )
        return next
      })
      notificarBadgeCanaisAposLeitura()
      return true
    } finally {
      marcandoLeituraRef.current = false
    }
  }, [
    usuarioId,
    tipo,
    modoAnfitriaoFinanceiro,
    statusDegustacaoPorCanal,
    empresaHospedagemId,
    ocultarManifesto,
    aplicarLeituraLocalNosItens,
  ])

  useEffect(() => {
    if (aba !== 'relatorios' || loading || !usuarioId) return
    void marcarRelatoriosComoLidos()
  }, [aba, loading, usuarioId, tipo, marcarRelatoriosComoLidos])

  const carregar = useCallback(async (opts = {}) => {
    const silencioso = opts.silencioso === true
    if (!usuarioId) return
    const seq = ++carregarSeqRef.current
    if (!silencioso) setLoading(true)
    try {
      let profissionalId = /** @type {string | null} */ (null)
      let empresaId = /** @type {string | null} */ (null)
      let anfitriaoDetectado = false

      if (tipo === 'profissional') {
        const { data: p } = await supabase
          .from('profissionais')
          .select('id, categorias')
          .eq('usuario_id', usuarioId)
          .maybeSingle()
        profissionalId = p?.id != null ? String(p.id) : null
        const cats = Array.isArray(p?.categorias)
          ? p.categorias.filter((c) => typeof c === 'string')
          : []
        anfitriaoDetectado = categoriasIncluemAnfitriao(cats)
        if (anfitriaoDetectado) setEhAnfitriao(true)
        if (modoAnfitriaoFinanceiro && empresaHospedagemId) {
          empresaId = String(empresaHospedagemId)
        }
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
        if (modoAnfitriaoFinanceiro && empresaId) {
          query = query.or(`profissional_id.eq.${profissionalId},empresa_id.eq.${empresaId}`)
        } else {
          query = query.eq('profissional_id', profissionalId)
        }
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

          const destino = rotuloDestinoNotificacaoFinanceira({
            empresa_id: r.empresa_id,
            profissional_id: r.profissional_id,
          })

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
            profissional_id: r.profissional_id != null ? String(r.profissional_id) : null,
            empresa_id: r.empresa_id != null ? String(r.empresa_id) : null,
            profissional_nome: pn,
            empresa_nome: en,
            destino_notificacao: destino,
            destino_rotulo: rotuloDestinoNotificacaoFinanceiraTexto(destino),
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

      formatados = dedupeItensCanalReservaHospedagem(formatados)

      const ocultarManifestoAgora =
        tipo === 'profissional' && (ehAnfitriaoProp || anfitriaoDetectado)
      if (ocultarManifestoAgora) {
        const manifestoPendentes = formatados.filter(
          (item) =>
            itemCanalFinanceiroEhAvisoManifesto(item) &&
            !item.lida_por_profissional &&
            item.profissional_id,
        )
        if (manifestoPendentes.length > 0 && profissionalId) {
          const ids = manifestoPendentes.map((i) => i.id)
          await supabase
            .from('canal_financeiro')
            .update({ lida_por_profissional: true })
            .in('id', ids)
            .eq('profissional_id', profissionalId)
        }
        formatados = formatados.filter((item) => !itemCanalFinanceiroEhAvisoManifesto(item))
      }

      formatados.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      let statusDegMap = /** @type {Map<string, string>} */ (new Map())
      const empresaDegId = tipo === 'empresa' ? empresaId : modoAnfitriaoFinanceiro ? empresaHospedagemId : null
      if (empresaDegId) {
        statusDegMap = await buscarMapaStatusDegustacaoCanalEmpresa(supabase, empresaDegId)
        setStatusDegustacaoPorCanal(statusDegMap)
      }

      // Ao visualizar Relatórios, persiste leitura antes de calcular o badge (evita race com realtime).
      if (abaRef.current === 'relatorios') {
        while (marcandoLeituraRef.current) {
          await new Promise((r) => setTimeout(r, 40))
          if (seq !== carregarSeqRef.current) return
        }
        marcandoLeituraRef.current = true
        try {
          let persistiuProf = false
          let persistiuEmpresa = false
          if (tipo === 'profissional') {
            persistiuProf = await marcarFinanceiroLidoProfissional(supabase, usuarioId)
            if (modoAnfitriaoFinanceiro) {
              persistiuEmpresa = await marcarFinanceiroLidoEmpresa(supabase, usuarioId)
            }
          } else {
            persistiuEmpresa = await marcarFinanceiroLidoEmpresa(supabase, usuarioId)
          }
          if (persistiuProf || persistiuEmpresa) {
            formatados = aplicarLeituraLocalNosItens(formatados, persistiuProf, persistiuEmpresa)
            notificarBadgeCanaisAposLeitura()
          }
        } finally {
          marcandoLeituraRef.current = false
        }
      }

      if (seq !== carregarSeqRef.current) return

      setItens(formatados)
      setNaoLidas(
        formatados.filter((item) =>
          itemRelatorioContaComoNaoLido(
            item,
            tipo,
            statusDegMap,
            modoAnfitriaoFinanceiro ? empresaHospedagemId : null,
            ocultarManifestoAgora,
          ),
        ).length,
      )
      const msgNaoLidas = await contarMensageiroFinanceiroNaoLidas(supabase, usuarioId)
      if (seq !== carregarSeqRef.current) return
      setNaoLidasMensageiro(msgNaoLidas)
    } catch (e) {
      console.error('Erro ao carregar canal financeiro:', e)
    } finally {
      if (!silencioso && seq === carregarSeqRef.current) setLoading(false)
    }
  }, [usuarioId, tipo, empresaHospedagemId, modoAnfitriaoFinanceiro, ehAnfitriaoProp, aplicarLeituraLocalNosItens])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (tipo !== 'empresa' || !usuarioId) return
    void fetch('/api/empresa/canal-financeiro/reparar-degustacao', { method: 'POST' })
      .then(() => notificarBadgeCanais())
      .catch(() => {})
  }, [tipo, usuarioId])

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
          {itens.filter(
            (item) =>
              !ocultarPlanoAssinaturaCatalogoRelatorios(item, tipo) &&
              !(ocultarManifesto && itemCanalFinanceiroEhAvisoManifesto(item)),
          ).length === 0 ? (
            <div className="py-8 text-center text-gray-400">Nenhuma movimentação financeira ainda</div>
          ) : (
            itens
              .filter(
                (item) =>
                  !ocultarPlanoAssinaturaCatalogoRelatorios(item, tipo) &&
                  !(ocultarManifesto && itemCanalFinanceiroEhAvisoManifesto(item)),
              )
              .map((item) =>
                item.tipo === 'pre_liberacao_turista' && tipo === 'profissional' ? (
                  <CanalFinanceiroItemPreLiberacao
                    key={item.id}
                    item={item}
                    onRespondido={() => void carregar({ silencioso: true })}
                  />
                ) : item.tipo === 'reserva_hospedagem' &&
                  (tipo === 'empresa' || (modoAnfitriaoFinanceiro && item.empresa_id)) ? (
                  <CanalFinanceiroItemReservaHospedagem
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
                ) : item.tipo === 'lembrete_vencimento_plano' && tipo === 'empresa' ? (
                  <CanalFinanceiroItemLembreteVencimento key={item.id} item={item} />
                ) : (
                  <CanalFinanceiroItem
                    key={item.id}
                    item={item}
                    userTipo={modoAnfitriaoFinanceiro && item.empresa_id ? 'empresa' : tipo}
                    destinoRotulo={modoAnfitriaoFinanceiro ? item.destino_rotulo : null}
                    onItemLido={marcarItemRelatorioLido}
                    onItemAtualizado={(itemId, patch) => {
                      setItens((prev) =>
                        prev.map((row) => (row.id === itemId ? { ...row, ...patch } : row)),
                      )
                    }}
                  />
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
