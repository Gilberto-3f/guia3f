import type { EcossistemaBloco } from '@/lib/ecossistemas'
import { vinculoEcossistemaIgnoravel } from '@/lib/ecossistemas'
import {
  aliasesCidadeGuia,
  normalizarChaveCidadeGuia,
  type PaisGuiaFiltro,
} from '@/lib/segmentosEmpresaGuia'
import { mapCidadeAtuacaoParaTabelado, type CidadeOrigemTabeladoId } from '@/lib/servicosTabeladosCatalogo'

export type ChipPaisBloco = {
  pais: PaisGuiaFiltro
  cidadeChave: string
  label: string
}

function paisDeCodigo(raw: string | null | undefined): PaisGuiaFiltro | null {
  const n = String(raw ?? '').trim().toUpperCase()
  if (n === 'BR' || n === 'BRASIL') return 'br'
  if (n === 'PY' || n === 'PARAGUAI') return 'py'
  if (n === 'AR' || n === 'ARGENTINA') return 'ar'
  return null
}

function colunasTextoUnicas(rows: unknown, chave: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    const v = String((row as Record<string, unknown> | null)?.[chave] ?? '').trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function paisInferidoDaCidade(chaveOuLabel: string): PaisGuiaFiltro | null {
  const n = normalizarChaveCidadeGuia(chaveOuLabel)
  if (n.includes('foz') || n.includes('londrina')) return 'br'
  if (n.includes('ciudad') || n.includes('cde') || n.includes('leste')) return 'py'
  if (n.includes('puerto') || n.includes('iguazu')) return 'ar'
  return null
}

export function aliasesCidadesDoBloco(bloco: EcossistemaBloco | null | undefined): string[] {
  if (!bloco) return []
  const set = new Set<string>()
  for (const c of bloco.cidades) {
    for (const a of aliasesCidadeGuia(c.chave)) set.add(a)
    for (const a of aliasesCidadeGuia(c.label)) set.add(a)
  }
  return [...set]
}

export function cidadePertenceAoBloco(
  cidade: string | null | undefined,
  bloco: EcossistemaBloco | null | undefined,
): boolean {
  if (!bloco) return true
  const raw = String(cidade ?? '').trim()
  if (!raw) return false
  const aliases = new Set(
    aliasesCidadesDoBloco(bloco).map((c) => normalizarChaveCidadeGuia(c)),
  )
  const n = normalizarChaveCidadeGuia(raw)
  if (aliases.has(n)) return true
  return [...aliases].some((a) => a && (n.includes(a) || a.includes(n)))
}

export function chipsPaisDoBloco(bloco: EcossistemaBloco | null | undefined): ChipPaisBloco[] {
  if (!bloco) {
    return [
      { pais: 'br', cidadeChave: 'Foz do Iguacu', label: 'Foz do Iguaçu' },
      { pais: 'py', cidadeChave: 'Ciudad del Este', label: 'Ciudad del Este' },
      { pais: 'ar', cidadeChave: 'Puerto Iguazu', label: 'Puerto Iguazú' },
    ]
  }
  const out: ChipPaisBloco[] = []
  const seen = new Set<PaisGuiaFiltro>()
  for (const c of bloco.cidades) {
    const pais = paisDeCodigo(c.pais) ?? paisInferidoDaCidade(c.chave) ?? paisInferidoDaCidade(c.label)
    if (!pais || seen.has(pais)) continue
    seen.add(pais)
    out.push({ pais, cidadeChave: c.chave, label: c.label })
  }
  return out
}

export function cidadesTabeladoDoBloco(
  bloco: EcossistemaBloco | null | undefined,
): CidadeOrigemTabeladoId[] {
  if (!bloco) return ['foz', 'cde', 'puerto_iguazu']
  const set = new Set<CidadeOrigemTabeladoId>()
  for (const c of bloco.cidades) {
    const id = mapCidadeAtuacaoParaTabelado(c.label) ?? mapCidadeAtuacaoParaTabelado(c.chave)
    if (id) set.add(id)
  }
  return [...set]
}

export async function buscarIdsEmpresaEcossistema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ecoId: string | null | undefined,
): Promise<Set<string> | null> {
  const id = String(ecoId ?? '').trim()
  if (!id) return null
  const { data, error } = await supabase
    .from('empresa_ecossistemas')
    .select('empresa_id')
    .eq('ecossistema_id', id)
  if (error) {
    if (vinculoEcossistemaIgnoravel(error)) return null
    return null
  }
  return new Set(colunasTextoUnicas(data, 'empresa_id'))
}

/** `profissionais.id` vinculados ao bloco. `null` = tabela ausente (não filtrar). */
export async function buscarIdsProfissionalEcossistema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ecoId: string | null | undefined,
): Promise<Set<string> | null> {
  const id = String(ecoId ?? '').trim()
  if (!id) return null
  const { data, error } = await supabase
    .from('profissional_ecossistemas')
    .select('profissional_id')
    .eq('ecossistema_id', id)
  if (error) {
    if (vinculoEcossistemaIgnoravel(error)) return null
    return null
  }
  return new Set(colunasTextoUnicas(data, 'profissional_id'))
}

/** IDs de bloco da empresa. `null` = tabela ausente. */
export async function buscarEcoIdsDaEmpresa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  empresaId: string | null | undefined,
): Promise<string[] | null> {
  const id = String(empresaId ?? '').trim()
  if (!id) return []
  const { data, error } = await supabase
    .from('empresa_ecossistemas')
    .select('ecossistema_id')
    .eq('empresa_id', id)
  if (error) {
    if (vinculoEcossistemaIgnoravel(error)) return null
    return null
  }
  return colunasTextoUnicas(data, 'ecossistema_id')
}

/** Empresas em qualquer um dos blocos. `null` = tabela ausente. */
export async function buscarIdsEmpresasDosEcossistemas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ecoIds: string[],
): Promise<Set<string> | null> {
  const ids = colunasTextoUnicas(
    ecoIds.map((id) => ({ id: String(id ?? '').trim() })),
    'id',
  )
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase
    .from('empresa_ecossistemas')
    .select('empresa_id')
    .in('ecossistema_id', ids)
  if (error) {
    if (vinculoEcossistemaIgnoravel(error)) return null
    return null
  }
  return new Set(colunasTextoUnicas(data, 'empresa_id'))
}

/** IDs de bloco do profissional. `null` = tabela ausente. */
export async function buscarEcoIdsDoProfissional(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profissionalId: string | null | undefined,
): Promise<string[] | null> {
  const id = String(profissionalId ?? '').trim()
  if (!id) return []
  const { data, error } = await supabase
    .from('profissional_ecossistemas')
    .select('ecossistema_id')
    .eq('profissional_id', id)
  if (error) {
    if (vinculoEcossistemaIgnoravel(error)) return null
    return null
  }
  return colunasTextoUnicas(data, 'ecossistema_id')
}

/** Profissionais em qualquer um dos blocos. `null` = tabela ausente. */
export async function buscarIdsProfissionaisDosEcossistemas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ecoIds: string[],
): Promise<Set<string> | null> {
  const ids = colunasTextoUnicas(
    ecoIds.map((id) => ({ id: String(id ?? '').trim() })),
    'id',
  )
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase
    .from('profissional_ecossistemas')
    .select('profissional_id')
    .in('ecossistema_id', ids)
  if (error) {
    if (vinculoEcossistemaIgnoravel(error)) return null
    return null
  }
  return new Set(colunasTextoUnicas(data, 'profissional_id'))
}

/** Tríplice (e qualquer bloco com 2+ países): matching de fronteira. Londrina (1 país): não. */
export function blocoPermiteCruzamentoFronteira(bloco: EcossistemaBloco | null | undefined): boolean {
  if (!bloco) return true
  const paises = new Set<PaisGuiaFiltro>()
  for (const c of bloco.cidades) {
    const pais = paisDeCodigo(c.pais) ?? paisInferidoDaCidade(c.chave) ?? paisInferidoDaCidade(c.label)
    if (pais) paises.add(pais)
  }
  return paises.size >= 2
}
