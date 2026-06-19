import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarSegmentoSlugEmpresa } from '@/lib/canaisEmpresaAdm'
import {
  isCanalFinanceiroEmpresa,
  nomeNormCanalEmpresa,
  slugCanalSegmentoEmpresa,
} from '@/lib/canaisEmpresaSlugs'
import { contarMensageiroFinanceiroNaoLidas } from '@/lib/financeiroMensageiroLeitura'

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS_SLUG = ['guia', 'taxista', 'van', 'motorista_app', 'anfitriao'] as const

export type CanalFinanceiroRowEmpresa = {
  id?: string | null
  lida_por_empresa?: boolean | null
  tipo?: string | null
  metadata?: Record<string, unknown> | null
  comprovante_detalhes?: Record<string, unknown> | null
}

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

/** Degustação aceita ou encerrada não entra no badge mesmo se lida_por_empresa atrasou no banco. */
export function itemCanalFinanceiroContaComoNaoLidoEmpresa(row: CanalFinanceiroRowEmpresa): boolean {
  if (row.lida_por_empresa === true) return false

  const tipo = String(row.tipo ?? '')
  if (tipo !== 'degustacao_plano') return true

  const meta = detalhesCanalFinanceiro(row)
  if (meta.aceito === true) return false
  if (meta.visualizado_em != null && String(meta.visualizado_em).trim() !== '') return false

  const status = String(meta.status ?? '').toLowerCase()
  if (status === 'ativa' || status === 'expirada' || status === 'cancelada') return false

  return true
}

function mesclarVisualizadoMetadata(
  atual: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base =
    atual && typeof atual === 'object' && !Array.isArray(atual) ? { ...atual } : {}
  return {
    ...base,
    visualizado_em: new Date().toISOString(),
  }
}

async function marcarItemLidoViaApi(itemId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !itemId) return false
  try {
    const res = await fetch('/api/empresa/canal-financeiro/marcar-lido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    })
    const json = (await res.json()) as { ok?: boolean }
    return res.ok && json.ok === true
  } catch {
    return false
  }
}

async function marcarTodosLidosViaApi(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const res = await fetch('/api/empresa/canal-financeiro/marcar-lido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
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
      const slug = toSlugComunidade(c.comunidade_prof != null ? String(c.comunidade_prof) : '')
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

  const [{ data: rows, error }, mensageiro] = await Promise.all([
    supabase
      .from('canal_financeiro')
      .select('id, tipo, lida_por_empresa, metadata, comprovante_detalhes')
      .eq('empresa_id', empresaId),
    contarMensageiroFinanceiroNaoLidas(supabase, usuarioId),
  ])

  if (error) {
    console.error('contarFinanceiroNaoLidasEmpresa:', error)
    return mensageiro
  }

  const relatorios = (rows ?? []).filter(itemCanalFinanceiroContaComoNaoLidoEmpresa).length
  return relatorios + mensageiro
}

export async function marcarFinanceiroLidoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<boolean> {
  if (!usuarioId) return false
  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''
  if (!empresaId) return false

  const { data: pendentes, error: selErr } = await supabase
    .from('canal_financeiro')
    .select('id, tipo, metadata, comprovante_detalhes, lida_por_empresa')
    .eq('empresa_id', empresaId)

  if (selErr) {
    console.error('marcarFinanceiroLidoEmpresa select:', selErr)
    return false
  }

  const idsMarcar = (pendentes ?? [])
    .filter(itemCanalFinanceiroContaComoNaoLidoEmpresa)
    .map((r) => String(r.id))
    .filter(Boolean)

  if (idsMarcar.length === 0) return true

  for (const id of idsMarcar) {
    const row = (pendentes ?? []).find((r) => String(r.id) === id)
    const tipo = String(row?.tipo ?? '')
    const patch: Record<string, unknown> = { lida_por_empresa: true }
    if (tipo === 'degustacao_plano') {
      patch.metadata = mesclarVisualizadoMetadata(
        detalhesCanalFinanceiro(row as CanalFinanceiroRowEmpresa),
      )
      patch.comprovante_detalhes = patch.metadata
    }

    const { error } = await supabase
      .from('canal_financeiro')
      .update(patch)
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) console.error('marcarFinanceiroLidoEmpresa update:', error)
  }

  const { data: restRows, error: restErr } = await supabase
    .from('canal_financeiro')
    .select('id, tipo, lida_por_empresa, metadata, comprovante_detalhes')
    .eq('empresa_id', empresaId)

  if (restErr) {
    console.error('marcarFinanceiroLidoEmpresa verify:', restErr)
    return marcarTodosLidosViaApi()
  }

  const aindaNaoLidos = (restRows ?? []).some(itemCanalFinanceiroContaComoNaoLidoEmpresa)
  if (aindaNaoLidos) return marcarTodosLidosViaApi()
  return true
}

export async function marcarFinanceiroItemLidoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  itemId: string,
): Promise<boolean> {
  if (!usuarioId || !itemId) return false
  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''
  if (!empresaId) return false

  const { data: row, error: rowErr } = await supabase
    .from('canal_financeiro')
    .select('id, tipo, metadata, comprovante_detalhes, lida_por_empresa')
    .eq('id', itemId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (rowErr) {
    console.error('marcarFinanceiroItemLidoEmpresa select:', rowErr)
    return marcarItemLidoViaApi(itemId)
  }

  if (!row?.id) return false
  if (!itemCanalFinanceiroContaComoNaoLidoEmpresa(row as CanalFinanceiroRowEmpresa)) return true

  const tipo = String(row.tipo ?? '')
  const patch: Record<string, unknown> = { lida_por_empresa: true }
  if (tipo === 'degustacao_plano') {
    patch.metadata = mesclarVisualizadoMetadata(detalhesCanalFinanceiro(row as CanalFinanceiroRowEmpresa))
    patch.comprovante_detalhes = patch.metadata
  }

  const { data, error } = await supabase
    .from('canal_financeiro')
    .update(patch)
    .eq('id', itemId)
    .eq('empresa_id', empresaId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('marcarFinanceiroItemLidoEmpresa:', error)
    return marcarItemLidoViaApi(itemId)
  }
  if (data?.id) return true

  const viaApi = await marcarItemLidoViaApi(itemId)
  if (viaApi) return true

  const { data: jaLida } = await supabase
    .from('canal_financeiro')
    .select('id, lida_por_empresa, metadata, comprovante_detalhes')
    .eq('id', itemId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  return Boolean(jaLida?.id && !itemCanalFinanceiroContaComoNaoLidoEmpresa(jaLida as CanalFinanceiroRowEmpresa))
}

export { isCanalFinanceiroEmpresa }
