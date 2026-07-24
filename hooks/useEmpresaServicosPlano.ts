'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import {
  abaDashboardLiberada,
  featureEmpresaLiberada,
  menuEmpresaLiberado,
  menuEmpresaVisivel,
  normalizarPlanoSlug,
  planoEmpresaReconhecidoNoCatalogo,
  publicidadeExternaLiberada,
  publicidadeHomeLiberada,
  resolverServicosEmpresa,
  type AbaDashboardEmpresa,
  type FeatureEmpresaId,
  type MenuEmpresaId,
  type PlanoResumoServicos,
} from '@/lib/planosEmpresaServicosGate'
import { buscarServicosPlanoDegustacao } from '@/lib/degustacaoEmpresa'
import {
  assinaturaContratadaVigente,
  deveExibirLembreteVencimentoPlano,
  diasParaVencimento,
} from '@/lib/empresaAssinatura'
import { invalidarCachePresencaPublicaGlobal } from '@/lib/empresaPresencaPublica'
import { TODOS_SERVICOS_EMPRESA } from '@/lib/planosEmpresaCatalogo'

let planosCacheGlobal: PlanoResumoServicos[] | null = null
let planosCachePromise: Promise<PlanoResumoServicos[]> | null = null

async function fetchPlanosAtivosCached(): Promise<PlanoResumoServicos[]> {
  if (planosCacheGlobal) return planosCacheGlobal
  if (planosCachePromise) return planosCachePromise

  planosCachePromise = (async () => {
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
    planosCacheGlobal = mapped
    return mapped
  })()

  try {
    return await planosCachePromise
  } finally {
    planosCachePromise = null
  }
}

export type UseEmpresaServicosPlanoOpts = {
  /** Mantém loading=true enquanto a empresa ainda não foi carregada (evita flash de bloqueio). */
  aguardarEmpresa?: boolean
  /** Hospedagem do anfitrião: todos os serviços liberados sem plano pago. */
  somenteAnfitriao?: boolean
}

/** Pré-carrega catálogo de planos (cache em memória) para abrir o menu empresa mais rápido. */
export function prefetchPlanosEmpresa() {
  void fetchPlanosAtivosCached().catch(() => {})
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
  const [temAssinaturaAtivaRegistro, setTemAssinaturaAtivaRegistro] = useState(false)
  const [assinaturaContratadaVigenteFlag, setAssinaturaContratadaVigenteFlag] = useState(false)
  const [assinaturaVencimentoEm, setAssinaturaVencimentoEm] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !(opts?.somenteAnfitriao ?? false))
  const carregar = useCallback(async () => {
    if (somenteAnfitriao) {
      setPlanos([])
      setDegustacaoAtiva(false)
      setDegustacaoPlanoId(null)
      setDegustacaoPlanoTitulo(null)
      setDegustacaoServicos(null)
      setPlanoContratadoId(null)
      setTemAssinaturaAtivaRegistro(false)
      setAssinaturaContratadaVigenteFlag(false)
      setAssinaturaVencimentoEm(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const mapped = await fetchPlanosAtivosCached()
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
            .select('plano_id, status, vencimento_em')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo')
            .order('assinado_em', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        const temAssinatura = Boolean(assinatura)
        const vigente = assinaturaContratadaVigente(assinatura)
        // Assinatura com status ativo mas ciclo vencido NÃO exige renovação via flag "tem registro"
        // (evita UI bloqueada + refetch em loop). Só conta se ainda vigente.
        setTemAssinaturaAtivaRegistro(temAssinatura && vigente)
        setAssinaturaContratadaVigenteFlag(vigente)
        setPlanoContratadoId(
          vigente && assinatura?.plano_id != null ? String(assinatura.plano_id) : null,
        )
        setAssinaturaVencimentoEm(
          vigente && assinatura?.vencimento_em != null ? String(assinatura.vencimento_em) : null,
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
          const servicosDeg = await buscarServicosPlanoDegustacao(supabase, pid)
          setDegustacaoServicos(servicosDeg)
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
        setTemAssinaturaAtivaRegistro(false)
        setAssinaturaContratadaVigenteFlag(false)
        setAssinaturaVencimentoEm(null)
      }
    } catch {
      setPlanos([])
      setDegustacaoAtiva(false)
      setDegustacaoPlanoId(null)
      setDegustacaoPlanoTitulo(null)
      setDegustacaoServicos(null)
      setPlanoContratadoId(null)
      setTemAssinaturaAtivaRegistro(false)
      setAssinaturaContratadaVigenteFlag(false)
      setAssinaturaVencimentoEm(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId, somenteAnfitriao])

  useLayoutEffect(() => {
    if (somenteAnfitriao) {
      setLoading(false)
      return
    }
    setLoading(true)
  }, [empresaId, planoEmpresa, somenteAnfitriao])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onRef = () => {
      invalidarCachePresencaPublicaGlobal()
      void carregar()
    }
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)
    return () => {
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
    }
  }, [carregar])

  const exigeAssinaturaVigente = useMemo(() => {
    if (degustacaoAtiva || somenteAnfitriao) return false
    const slug = normalizarPlanoSlug(planoEmpresa ?? '')
    if (!slug || slug === 'gratuito') return false
    return planoEmpresaReconhecidoNoCatalogo(planoEmpresa, planos) || temAssinaturaAtivaRegistro
  }, [degustacaoAtiva, planoEmpresa, planos, somenteAnfitriao, temAssinaturaAtivaRegistro])

  const servicos = useMemo(() => {
    if (somenteAnfitriao) return [...TODOS_SERVICOS_EMPRESA]
    return resolverServicosEmpresa(
      planoEmpresa,
      planos,
      {
        ativa: degustacaoAtiva,
        servicos: degustacaoServicos,
      },
      {
        planoContratadoId,
        assinaturaContratadaVigente: degustacaoAtiva
          ? undefined
          : exigeAssinaturaVigente
            ? assinaturaContratadaVigenteFlag
            : undefined,
      },
    )
  }, [
    assinaturaContratadaVigenteFlag,
    degustacaoAtiva,
    degustacaoServicos,
    exigeAssinaturaVigente,
    planoContratadoId,
    planoEmpresa,
    planos,
    somenteAnfitriao,
  ])

  /**
   * Visibilidade pública (guia + página da empresa): serviços do plano da empresa.
   * Ciclo irregular já retira a empresa do guia (presença pública) — não bloqueia
   * de novo recursos na página (visitantes muitas vezes não leem empresa_assinaturas via RLS).
   */
  const servicosPublicos = useMemo(() => {
    if (somenteAnfitriao) return [...TODOS_SERVICOS_EMPRESA]
    return resolverServicosEmpresa(
      planoEmpresa,
      planos,
      {
        ativa: degustacaoAtiva,
        servicos: degustacaoServicos,
      },
      {
        planoContratadoId,
      },
    )
  }, [degustacaoAtiva, degustacaoServicos, planoContratadoId, planoEmpresa, planos, somenteAnfitriao])

  const temServico = useCallback(
    (servico: ServicoPlanoId) => servicos.includes(servico),
    [servicos],
  )

  const menuLiberado = useCallback(
    (menuId: MenuEmpresaId) => menuEmpresaLiberado(menuId, servicos),
    [servicos],
  )

  const menuVisivel = useCallback(
    (menuId: MenuEmpresaId) => menuEmpresaVisivel(menuId, servicos),
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

  const featurePublicaLiberada = useCallback(
    (feature: FeatureEmpresaId) => featureEmpresaLiberada(feature, servicosPublicos),
    [servicosPublicos],
  )

  const temPublicidadeHome = useCallback(
    () => publicidadeHomeLiberada(servicos),
    [servicos],
  )

  const temPublicidadeExterna = useCallback(
    () =>
      publicidadeExternaLiberada(servicos, {
        emDegustacao: degustacaoAtiva,
        assinaturaContratadaVigente: assinaturaContratadaVigenteFlag,
      }),
    [assinaturaContratadaVigenteFlag, degustacaoAtiva, servicos],
  )

  const lembreteVencimentoPlano = useMemo(
    () =>
      !degustacaoAtiva &&
      assinaturaContratadaVigenteFlag &&
      deveExibirLembreteVencimentoPlano(assinaturaVencimentoEm),
    [assinaturaContratadaVigenteFlag, assinaturaVencimentoEm, degustacaoAtiva],
  )

  const diasParaVencimentoPlano = useMemo(
    () => diasParaVencimento(assinaturaVencimentoEm),
    [assinaturaVencimentoEm],
  )

  const contextoEmpresaPendente = aguardarEmpresa && empresaId == null
  const loadingEfetivo = somenteAnfitriao
    ? contextoEmpresaPendente
    : loading || contextoEmpresaPendente

  return useMemo(
    () => ({
      servicos,
      servicosPublicos,
      loading: loadingEfetivo,
      degustacaoAtiva,
      degustacaoPlanoId,
      degustacaoPlanoTitulo,
      assinaturaContratadaVigente: assinaturaContratadaVigenteFlag,
      assinaturaVencimentoEm,
      lembreteVencimentoPlano,
      diasParaVencimentoPlano,
      temServico,
      menuLiberado,
      menuVisivel,
      abaLiberada,
      featureLiberada,
      featurePublicaLiberada,
      temPublicidadeHome,
      temPublicidadeExterna,
      refetch: carregar,
    }),
    [
      abaLiberada,
      assinaturaContratadaVigenteFlag,
      assinaturaVencimentoEm,
      carregar,
      degustacaoAtiva,
      degustacaoPlanoId,
      degustacaoPlanoTitulo,
      diasParaVencimentoPlano,
      featureLiberada,
      featurePublicaLiberada,
      lembreteVencimentoPlano,
      loadingEfetivo,
      menuLiberado,
      menuVisivel,
      servicos,
      servicosPublicos,
      temPublicidadeExterna,
      temPublicidadeHome,
      temServico,
    ],
  )
}
