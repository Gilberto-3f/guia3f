'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import {
  abaDashboardLiberada,
  featureEmpresaLiberada,
  menuEmpresaLiberado,
  resolverServicosEmpresa,
  type AbaDashboardEmpresa,
  type FeatureEmpresaId,
  type MenuEmpresaId,
  type PlanoResumoServicos,
} from '@/lib/planosEmpresaServicosGate'
import { buscarServicosPlanoDegustacao } from '@/lib/degustacaoEmpresa'
import { TODOS_SERVICOS_EMPRESA } from '@/lib/planosEmpresaCatalogo'

export type UseEmpresaServicosPlanoOpts = {
  /** Mantém loading=true enquanto a empresa ainda não foi carregada (evita flash de bloqueio). */
  aguardarEmpresa?: boolean
  /** Hospedagem do anfitrião: todos os serviços liberados sem plano pago. */
  somenteAnfitriao?: boolean
}

export function useEmpresaServicosPlano(
  planoEmpresa: string | null | undefined,
  empresaId?: string | null,
  opts?: UseEmpresaServicosPlanoOpts,
) {
  const aguardarEmpresa = opts?.aguardarEmpresa ?? false
  const somenteAnfitriao = opts?.somenteAnfitriao ?? false
  const [planos, setPlanos] = useState<PlanoResumoServicos[]>([])
  const [degustacaoAtiva, setDegustacaoAtiva] = useState(false)
  const [degustacaoPlanoId, setDegustacaoPlanoId] = useState<string | null>(null)
  const [degustacaoPlanoTitulo, setDegustacaoPlanoTitulo] = useState<string | null>(null)
  const [degustacaoServicos, setDegustacaoServicos] = useState<ServicoPlanoId[] | null>(null)
  const [planoContratadoId, setPlanoContratadoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const carregarRef = useRef<() => Promise<void>>(async () => {})
  const channelInstancia = useId().replace(/:/g, '')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('id, nome, titulo, servicos')
        .eq('ativo', true)
      if (error) throw error

      const mapped = (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        const servicosRaw = r.servicos
        const servicos = Array.isArray(servicosRaw)
          ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
          : []
        return {
          id: r.id != null ? String(r.id) : undefined,
          nome: String(r.nome ?? ''),
          titulo: String(r.titulo ?? r.nome ?? ''),
          servicos,
        }
      })
      setPlanos(mapped)

      if (empresaId) {
        const agora = new Date().toISOString()
        const [{ data: deg }, { data: assinatura }] = await Promise.all([
          supabase
            .from('empresa_degustacoes')
            .select('id, plano_id, planos ( titulo )')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativa')
            .gt('expira_em', agora)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('empresa_assinaturas')
            .select('plano_id')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .order('assinado_em', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        setPlanoContratadoId(
          assinatura?.plano_id != null ? String(assinatura.plano_id) : null,
        )

        const ativa = Boolean(deg?.id)
        setDegustacaoAtiva(ativa)

        if (ativa) {
          const pid = deg?.plano_id != null ? String(deg.plano_id) : null
          setDegustacaoPlanoId(pid)
          const planosJoin = deg?.planos as { titulo?: string } | { titulo?: string }[] | null
          const titulo = Array.isArray(planosJoin)
            ? planosJoin[0]?.titulo
            : planosJoin?.titulo
          setDegustacaoPlanoTitulo(titulo != null ? String(titulo) : null)
          const servicos = await buscarServicosPlanoDegustacao(supabase, pid)
          setDegustacaoServicos(servicos)
        } else {
          setDegustacaoPlanoId(null)
          setDegustacaoPlanoTitulo(null)
          setDegustacaoServicos(null)
        }
      } else {
        setDegustacaoAtiva(false)
        setDegustacaoPlanoId(null)
        setDegustacaoPlanoTitulo(null)
        setDegustacaoServicos(null)
        setPlanoContratadoId(null)
      }
    } catch {
      setPlanos([])
      setDegustacaoAtiva(false)
      setDegustacaoPlanoId(null)
      setDegustacaoPlanoTitulo(null)
      setDegustacaoServicos(null)
      setPlanoContratadoId(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  carregarRef.current = carregar

  useLayoutEffect(() => {
    setLoading(true)
  }, [empresaId, planoEmpresa])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onRef = () => void carregar()
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)
    return () => {
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
    }
  }, [carregar])

  useEffect(() => {
    if (!empresaId) return
    const ch = supabase
      .channel(`empresa-degustacao-${empresaId}-${channelInstancia}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'empresa_degustacoes',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => {
          void carregarRef.current()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [channelInstancia, empresaId])

  const servicos = useMemo(() => {
    if (somenteAnfitriao) return [...TODOS_SERVICOS_EMPRESA]
    return resolverServicosEmpresa(planoEmpresa, planos, {
      ativa: degustacaoAtiva,
      servicos: degustacaoServicos,
    }, { planoContratadoId })
  }, [degustacaoAtiva, degustacaoServicos, planoContratadoId, planoEmpresa, planos, somenteAnfitriao])

  const temServico = useCallback(
    (servico: ServicoPlanoId) => servicos.includes(servico),
    [servicos],
  )

  const menuLiberado = useCallback(
    (menuId: MenuEmpresaId) => menuEmpresaLiberado(menuId, servicos),
    [servicos],
  )

  const abaLiberada = useCallback(
    (aba: AbaDashboardEmpresa) => abaDashboardLiberada(aba, servicos),
    [servicos],
  )

  const featureLiberada = useCallback(
    (feature: FeatureEmpresaId) => featureEmpresaLiberada(feature, servicos),
    [servicos],
  )

  const contextoEmpresaPendente = aguardarEmpresa && empresaId == null
  const loadingEfetivo = loading || contextoEmpresaPendente

  return useMemo(
    () => ({
      servicos,
      loading: loadingEfetivo,
      degustacaoAtiva,
      degustacaoPlanoId,
      degustacaoPlanoTitulo,
      temServico,
      menuLiberado,
      abaLiberada,
      featureLiberada,
      refetch: carregar,
    }),
    [
      abaLiberada,
      carregar,
      degustacaoAtiva,
      degustacaoPlanoId,
      degustacaoPlanoTitulo,
      featureLiberada,
      loadingEfetivo,
      menuLiberado,
      servicos,
      temServico,
    ],
  )
}
