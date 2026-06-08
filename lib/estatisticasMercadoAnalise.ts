import { supabase } from '@/lib/supabase'
import {
  preencherComissaoSegmento,
  preencherContagensSegmento,
  type ComissaoSegmento,
  type ContagemSegmento,
  type SegmentoMercado,
} from '@/lib/segmentosMercado'

export interface AnaliseMercadoDados {
  visibilidade: ContagemSegmento[]
  engajamento: ContagemSegmento[]
  recomendados: ContagemSegmento[]
  comissao: ComissaoSegmento[]
  comissaoEmpresa: { media: number; quantidade: number }
}

type RpcRow = { segmento: string; total?: number; media?: number; quantidade?: number }

function mapContagens(rows: RpcRow[] | null | undefined): ContagemSegmento[] {
  const parcial: Partial<Record<SegmentoMercado, number>> = {}
  for (const row of rows ?? []) {
    const seg = row.segmento as SegmentoMercado
    if (seg) parcial[seg] = Number(row.total ?? 0)
  }
  return preencherContagensSegmento(parcial)
}

function mapComissao(rows: RpcRow[] | null | undefined): ComissaoSegmento[] {
  const parcial: Partial<Record<SegmentoMercado, { media: number; quantidade: number }>> = {}
  for (const row of rows ?? []) {
    const seg = row.segmento as SegmentoMercado
    if (seg) {
      parcial[seg] = {
        media: Number(row.media ?? 0),
        quantidade: Number(row.quantidade ?? 0),
      }
    }
  }
  return preencherComissaoSegmento(parcial)
}

export async function buscarAnaliseMercado(
  dataLimite: string | null,
  empresaId: string | null,
): Promise<AnaliseMercadoDados> {
  const vazio: AnaliseMercadoDados = {
    visibilidade: preencherContagensSegmento({}),
    engajamento: preencherContagensSegmento({}),
    recomendados: preencherContagensSegmento({}),
    comissao: preencherComissaoSegmento({}),
    comissaoEmpresa: { media: 0, quantidade: 0 },
  }

  const { data, error } = await supabase.rpc('rpc_analise_mercado', {
    p_desde: dataLimite,
    p_empresa_id: empresaId,
  })

  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.message?.includes('Could not find the function') ||
      error.message?.includes('schema cache')
    ) {
      return vazio
    }
    throw error
  }

  const payload = (data ?? {}) as Record<string, unknown>
  const comissaoEmp = payload.comissao_empresa as { media?: number; quantidade?: number } | null

  return {
    visibilidade: mapContagens(payload.visibilidade as RpcRow[]),
    engajamento: mapContagens(payload.engajamento as RpcRow[]),
    recomendados: mapContagens(payload.recomendados as RpcRow[]),
    comissao: mapComissao(payload.comissao as RpcRow[]),
    comissaoEmpresa: {
      media: Number(comissaoEmp?.media ?? 0),
      quantidade: Number(comissaoEmp?.quantidade ?? 0),
    },
  }
}
