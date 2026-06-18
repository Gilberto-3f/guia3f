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

  const [{ count, error }, mensageiro] = await Promise.all([
    supabase
      .from('canal_financeiro')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('lida_por_empresa', false),
    contarMensageiroFinanceiroNaoLidas(supabase, usuarioId),
  ])

  if (error) {
    console.error('contarFinanceiroNaoLidasEmpresa:', error)
    return mensageiro
  }
  return (count ?? 0) + mensageiro
}

export async function marcarFinanceiroLidoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<boolean> {
  if (!usuarioId) return false
  const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const empresaId = emp?.id != null ? String(emp.id) : ''
  if (!empresaId) return false

  const { error } = await supabase
    .from('canal_financeiro')
    .update({ lida_por_empresa: true })
    .eq('empresa_id', empresaId)
    .eq('lida_por_empresa', false)

  if (error) {
    console.error('marcarFinanceiroLidoEmpresa:', error)
    return false
  }
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

  const { data, error } = await supabase
    .from('canal_financeiro')
    .update({ lida_por_empresa: true })
    .eq('id', itemId)
    .eq('empresa_id', empresaId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('marcarFinanceiroItemLidoEmpresa:', error)
    return false
  }
  if (data?.id) return true

  const { data: jaLida } = await supabase
    .from('canal_financeiro')
    .select('id')
    .eq('id', itemId)
    .eq('empresa_id', empresaId)
    .eq('lida_por_empresa', true)
    .maybeSingle()

  return Boolean(jaLida?.id)
}

export { isCanalFinanceiroEmpresa }
