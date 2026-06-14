'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import {
  abaDashboardLiberada,
  menuEmpresaLiberado,
  resolverServicosDoPlano,
  type AbaDashboardEmpresa,
  type MenuEmpresaId,
  type PlanoResumoServicos,
} from '@/lib/planosEmpresaServicosGate'

export function useEmpresaServicosPlano(planoEmpresa: string | null | undefined) {
  const [planos, setPlanos] = useState<PlanoResumoServicos[]>([])
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
    } catch {
      setPlanos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const servicos = useMemo(
    () => resolverServicosDoPlano(planoEmpresa, planos),
    [planoEmpresa, planos],
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

  return useMemo(
    () => ({ servicos, loading, temServico, menuLiberado, abaLiberada, refetch: carregar }),
    [abaLiberada, carregar, loading, menuLiberado, servicos, temServico],
  )
}
