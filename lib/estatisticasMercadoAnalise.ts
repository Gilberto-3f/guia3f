import { supabase } from '@/lib/supabase'
import {
  preencherComissaoSegmento,
  preencherContagensSegmento,
  type ComissaoSegmento,
  type ContagemSegmento,
  type SegmentoMercado,
} from '@/lib/segmentosMercado'

export interface ComissaoEmpresaResumo {
  mediaPax: number
  mediaPercentual: number
  mediaIndicacao: number
  quantidade: number
}

export interface AnaliseMercadoDados {
  visibilidade: ContagemSegmento[]
  engajamento: ContagemSegmento[]
  recomendados: ContagemSegmento[]
  comissao: ComissaoSegmento[]
  comissaoEmpresa: ComissaoEmpresaResumo
}

type RpcRow = {
  segmento: string
  total?: number
  media_pax?: number
  media_percentual?: number
  media_indicacao?: number
  quantidade?: number
}

const COMISSAO_EMPRESA_VAZIA: ComissaoEmpresaResumo = {
  mediaPax: 0,
  mediaPercentual: 0,
  mediaIndicacao: 0,
  quantidade: 0,
}

function mapContagens(rows: RpcRow[] | null | undefined): ContagemSegmento[] {
  const parcial: Partial<Record<SegmentoMercado, number>> = {}
  for (const row of rows ?? []) {
    const seg = row.segmento as SegmentoMercado
    if (seg) parcial[seg] = Number(row.total ?? 0)
  }
  return preencherContagensSegmento(parcial)
}

function mapComissao(rows: RpcRow[] | null | undefined): ComissaoSegmento[] {
  const parcial: Partial<
    Record<
      SegmentoMercado,
      { mediaPax: number; mediaPercentual: number; mediaIndicacao: number; quantidade: number }
    >
  > = {}
  for (const row of rows ?? []) {
    const seg = row.segmento as SegmentoMercado
    if (seg) {
      parcial[seg] = {
        mediaPax: Number(row.media_pax ?? 0),
        mediaPercentual: Number(row.media_percentual ?? 0),
        mediaIndicacao: Number(row.media_indicacao ?? 0),
        quantidade: Number(row.quantidade ?? 0),
      }
    }
  }
  return preencherComissaoSegmento(parcial)
}

function mapComissaoEmpresa(raw: Record<string, unknown> | null | undefined): ComissaoEmpresaResumo {
  if (!raw) return COMISSAO_EMPRESA_VAZIA
  return {
    mediaPax: Number(raw.media_pax ?? 0),
    mediaPercentual: Number(raw.media_percentual ?? 0),
    mediaIndicacao: Number(raw.media_indicacao ?? 0),
    quantidade: Number(raw.quantidade ?? 0),
  }
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
    comissaoEmpresa: COMISSAO_EMPRESA_VAZIA,
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

  return {
    visibilidade: mapContagens(payload.visibilidade as RpcRow[]),
    engajamento: mapContagens(payload.engajamento as RpcRow[]),
    recomendados: mapContagens(payload.recomendados as RpcRow[]),
    comissao: mapComissao(payload.comissao as RpcRow[]),
    comissaoEmpresa: mapComissaoEmpresa(payload.comissao_empresa as Record<string, unknown>),
  }
}
