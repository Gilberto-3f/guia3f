import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarSegmentoSlugEmpresa } from '@/lib/canaisEmpresaAdm'
import {
  isCanalFinanceiroEmpresa,
  nomeNormCanalEmpresa,
  slugCanalSegmentoEmpresa,
} from '@/lib/canaisEmpresaSlugs'
import { contarMensageiroFinanceiroNaoLidas } from '@/lib/financeiroMensageiroLeitura'

import {
  COMUNIDADES_PROFISSIONAIS_SLUG,
  slugComunidadeProfissionalDeCanalEmpresa,
} from '@/lib/canaisProfissionaisListaUi'

export type CanalFinanceiroRowEmpresa = {
  id?: string | null
  lida_por_empresa?: boolean | null
  tipo?: string | null
  metadata?: Record<string, unknown> | null
  comprovante_detalhes?: Record<string, unknown> | null
}

export type StatusDegustacaoPorCanal = Map<string, string>

function detalhesCanalFinanceiro(row: CanalFinanceiroRowEmpresa): Record<string, unknown> {
  if (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)) {
    return row.metadata
  }
  if (
    row.comprovante_detalhes &&
    typeof row.comprovante_detalhes === 'object' &&
    !Array.isArray(row.comprovante_detalhes)
  ) {
    return row.comprovante_detalhes
  }
  return {}
}

export function degustacaoCanalEncerradaParaBadge(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'ativa' || s === 'expirada' || s === 'cancelada'
}

export async function buscarMapaStatusDegustacaoCanalEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<StatusDegustacaoPorCanal> {
  const map: StatusDegustacaoPorCanal = new Map()
  if (!empresaId) return map

  const { data, error } = await supabase
    .from('empresa_degustacoes')
    .select('canal_financeiro_id, status')
    .eq('empresa_id', empresaId)
    .not('canal_financeiro_id', 'is', null)

  if (error) {
    console.error('buscarMapaStatusDegustacaoCanalEmpresa:', error)
    return map
  }

  for (const row of data ?? []) {
    if (row.canal_financeiro_id) {
      map.set(String(row.canal_financeiro_id), String(row.status ?? ''))
    }
  }
  return map
}

/** Degustação aceita, encerrada ou visualizada não entra no badge. */
export function itemCanalFinanceiroContaComoNaoLidoEmpresa(
  row: CanalFinanceiroRowEmpresa,
  statusDegustacaoPorCanal?: StatusDegustacaoPorCanal | null,
): boolean {
  if (row.lida_por_empresa === true) return false

  const tipo = String(row.tipo ?? '')
  if (tipo !== 'degustacao_plano') return true

  const canalId = row.id != null ? String(row.id) : ''
  const statusDeg = statusDegustacaoPorCanal?.get(canalId) ?? null
  if (degustacaoCanalEncerradaParaBadge(statusDeg)) return false

  const meta = detalhesCanalFinanceiro(row)
  if (meta.aceito === true) return false
  if (meta.visualizado_em != null && String(meta.visualizado_em).trim() !== '') return false

  const statusMeta = String(meta.status ?? statusDeg ?? '').toLowerCase()
  if (degustacaoCanalEncerradaParaBadge(statusMeta)) return false

  return true
}

async function marcarItemLidoViaApi(itemId?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const res = await fetch('/api/empresa/canal-financeiro/marcar-lido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemId ? { item_id: itemId } : {}),
    })
    const json = (await res.json()) as { ok?: boolean }
    return res.ok && json.ok === true
  } catch {
    return false
  }
}

function toSlugComunidade(valor: string | null | undefined): string {
  const raw = String(valor ?? '').trim()
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
}

function slugComunidadeCanalEmpresa(c: {
  nome?: string | null
  categoria?: string | null
  comunidade_prof?: string | null
}): string {
  return slugComunidadeProfissionalDeCanalEmpresa(c)
}

/**
 * IDs de canais cujas mensagens entram no badge / lista da empresa.
 */
export async function obterIdsCanaisMensagensEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<Set<string>> {
  if (!usuarioId) return new Set()

  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''

  const segmentosSlugs = await buscarSegmentoSlugEmpresa(supabase, usuarioId)

  const { data: canais, error } = await supabase
    .from('canais')
    .select('id, nome, tipo_publico, categoria, empresa_id, comunidade_prof')
    .eq('ativo', true)
    .eq('tipo_publico', 'empresa')

  if (error) {
    console.error('obterIdsCanaisMensagensEmpresa:', error)
    return new Set()
  }

  const ids = new Set<string>()
  for (const c of canais ?? []) {
    const id = String(c.id)
    if (c.empresa_id == null) {
      const n = nomeNormCanalEmpresa(c.nome)
      if (n === 'ADM' || n === 'FINANCEIRO') {
        ids.add(id)
        continue
      }
      const slug = slugCanalSegmentoEmpresa(
        c.categoria != null ? String(c.categoria) : null,
        c.nome != null ? String(c.nome) : null
      )
      if (slug && segmentosSlugs.includes(slug)) ids.add(id)
    } else if (empresaId && String(c.empresa_id) === empresaId) {
      const slug =
        slugComunidadeCanalEmpresa({
          nome: c.nome != null ? String(c.nome) : null,
          categoria: c.categoria != null ? String(c.categoria) : null,
          comunidade_prof: c.comunidade_prof != null ? String(c.comunidade_prof) : null,
        }) || toSlugComunidade(c.comunidade_prof != null ? String(c.comunidade_prof) : '')
      if (slug && (COMUNIDADES_PROFISSIONAIS_SLUG as readonly string[]).includes(slug)) {
        ids.add(id)
      }
    }
  }
  return ids
}

export async function contarFinanceiroNaoLidasEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<number> {
  if (!usuarioId) return 0
  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''
  if (!empresaId) return 0

  const [{ data: rows, error }, mensageiro, statusDeg] = await Promise.all([
    supabase
      .from('canal_financeiro')
      .select('id, tipo, lida_por_empresa, metadata, comprovante_detalhes')
      .eq('empresa_id', empresaId),
    contarMensageiroFinanceiroNaoLidas(supabase, usuarioId),
    buscarMapaStatusDegustacaoCanalEmpresa(supabase, empresaId),
  ])

  if (error) {
    console.error('contarFinanceiroNaoLidasEmpresa:', error)
    return mensageiro
  }

  const relatorios = (rows ?? []).filter((r) =>
    itemCanalFinanceiroContaComoNaoLidoEmpresa(r as CanalFinanceiroRowEmpresa, statusDeg),
  ).length
  return relatorios + mensageiro
}

export async function marcarFinanceiroLidoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<boolean> {
  if (!usuarioId) return false
  if (typeof window !== 'undefined') {
    return marcarItemLidoViaApi()
  }

  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''
  if (!empresaId) return false

  const statusDeg = await buscarMapaStatusDegustacaoCanalEmpresa(supabase, empresaId)
  const { data: rows } = await supabase
    .from('canal_financeiro')
    .select('id, tipo, lida_por_empresa, metadata, comprovante_detalhes')
    .eq('empresa_id', empresaId)

  const pendentes = (rows ?? []).filter((r) =>
    itemCanalFinanceiroContaComoNaoLidoEmpresa(r as CanalFinanceiroRowEmpresa, statusDeg),
  )
  return pendentes.length === 0
}

export async function marcarFinanceiroItemLidoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  itemId: string,
): Promise<boolean> {
  if (!usuarioId || !itemId) return false
  if (typeof window !== 'undefined') {
    return marcarItemLidoViaApi(itemId)
  }

  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''
  if (!empresaId) return false

  const statusDeg = await buscarMapaStatusDegustacaoCanalEmpresa(supabase, empresaId)
  const { data: row } = await supabase
    .from('canal_financeiro')
    .select('id, tipo, lida_por_empresa, metadata, comprovante_detalhes')
    .eq('id', itemId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!row?.id) return false
  return !itemCanalFinanceiroContaComoNaoLidoEmpresa(row as CanalFinanceiroRowEmpresa, statusDeg)
}

export { isCanalFinanceiroEmpresa }
