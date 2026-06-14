'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  corPlanoHex,
  labelServicoPlano,
  type PlanoCorId,
  type ServicoPlanoId,
} from '@/lib/planosEmpresaCatalogo'

export type PlanoEmpresa = {
  id: string
  nome: string
  titulo: string
  cor: PlanoCorId
  descricao: string
  servicos: ServicoPlanoId[]
  precoMensal: number
  precoTrimestral: number
  precoAnual: number
}

function mapPlanoRow(row: Record<string, unknown>): PlanoEmpresa {
  const servicosRaw = row.servicos
  const servicos = Array.isArray(servicosRaw)
    ? servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
    : []

  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    titulo: String(row.titulo ?? row.nome ?? 'Plano'),
    cor: (String(row.cor ?? 'azul') as PlanoCorId) || 'azul',
    descricao: String(row.descricao ?? ''),
    servicos,
    precoMensal: Number(row.preco_mensal ?? row.valor ?? 0),
    precoTrimestral: Number(row.preco_trimestral ?? 0),
    precoAnual: Number(row.preco_anual ?? 0),
  }
}

const PLANOS_FALLBACK: PlanoEmpresa[] = [
  {
    id: 'basico',
    nome: 'BASICO',
    titulo: 'Básico',
    cor: 'azul',
    descricao: '',
    servicos: ['pagina_rede_social'],
    precoMensal: 97,
    precoTrimestral: 291,
    precoAnual: 1164,
  },
  {
    id: 'premium',
    nome: 'PREMIUM',
    titulo: 'Premium',
    cor: 'roxo',
    descricao: '',
    servicos: ['pagina_rede_social', 'publicidade', 'dashboard_empresa'],
    precoMensal: 197,
    precoTrimestral: 591,
    precoAnual: 2364,
  },
  {
    id: 'enterprise',
    nome: 'ENTERPRISE',
    titulo: 'Enterprise',
    cor: 'preto',
    descricao: '',
    servicos: ['pagina_rede_social', 'publicidade', 'dashboard_empresa', 'canais', 'auxiliar_adm'],
    precoMensal: 497,
    precoTrimestral: 1491,
    precoAnual: 5964,
  },
]

export function usePlanos(empresaId: string | null) {
  const [planos, setPlanos] = useState<PlanoEmpresa[]>(PLANOS_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [solicitando, setSolicitando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('preco_mensal', { ascending: true })
      if (error) throw error
      const mapped = (data ?? []).map((p) => mapPlanoRow(p as Record<string, unknown>))
      if (mapped.length > 0) setPlanos(mapped)
    } catch {
      setPlanos(PLANOS_FALLBACK)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const solicitarMudanca = useCallback(
    async (tipo: 'upgrade' | 'downgrade', plano: PlanoEmpresa) => {
      if (!empresaId) return
      setSolicitando(true)
      try {
        const texto = `[PLANO] Solicitação de ${tipo.toUpperCase()} para ${plano.titulo} (${plano.nome})`
        const { error } = await supabase.from('mensagens_chat_adm').insert({
          empresa_id: empresaId,
          mensagem: texto,
          lida_admin: false,
        })
        if (error) throw error
      } finally {
        setSolicitando(false)
      }
    },
    [empresaId],
  )

  return useMemo(
    () => ({ planos, loading, solicitando, solicitarMudanca, refetch: carregar }),
    [carregar, loading, planos, solicitando, solicitarMudanca],
  )
}

export { corPlanoHex, labelServicoPlano }
