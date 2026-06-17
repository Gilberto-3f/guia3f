'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

export function useEmpresaServicosPlano(
  planoEmpresa: string | null | undefined,
  empresaId?: string | null,
) {
  const [planos, setPlanos] = useState<PlanoResumoServicos[]>([])
  const [degustacaoAtiva, setDegustacaoAtiva] = useState(false)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('nome, titulo, servicos')
        .eq('ativo', true)
      if (error) throw error

      const mapped = (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        const servicosRaw = r.servicos
        const servicos = Array.isArray(servicosRaw)
          ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
          : []
        return {
          nome: String(r.nome ?? ''),
          titulo: String(r.titulo ?? r.nome ?? ''),
          servicos,
        }
      })
      setPlanos(mapped)

      if (empresaId) {
        const agora = new Date().toISOString()
        const { data: deg } = await supabase
          .from('empresa_degustacoes')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('status', 'ativa')
          .gt('expira_em', agora)
          .limit(1)
          .maybeSingle()
        setDegustacaoAtiva(Boolean(deg?.id))
      } else {
        setDegustacaoAtiva(false)
      }
    } catch {
      setPlanos([])
      setDegustacaoAtiva(false)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

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

  const servicos = useMemo(
    () => resolverServicosEmpresa(planoEmpresa, planos, degustacaoAtiva),
    [degustacaoAtiva, planoEmpresa, planos],
  )

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

  return useMemo(
    () => ({
      servicos,
      loading,
      degustacaoAtiva,
      temServico,
      menuLiberado,
      abaLiberada,
      featureLiberada,
      refetch: carregar,
    }),
    [abaLiberada, carregar, degustacaoAtiva, featureLiberada, loading, menuLiberado, servicos, temServico],
  )
}
