import { inferCodigoPaisEmpresa } from '@/lib/empresaPaisUi'
import {
  normalizarCidadeChave,
  type EcossistemaBloco,
  type EcossistemaCidade,
} from '@/lib/ecossistemas'

export type AbaCanalCidade = {
  id: string
  label: string
  pais: string | null
}

const ROTULO_CURTO: Record<string, string> = {
  'foz do iguacu': 'Foz',
  'ciudad del este': 'CDE',
  'puerto iguazu': 'Iguazú',
}

export function rotuloCurtoCidade(cidade: EcossistemaCidade): string {
  const k = normalizarCidadeChave(cidade.chave || cidade.label).toLowerCase()
  if (ROTULO_CURTO[k]) return ROTULO_CURTO[k]
  const label = String(cidade.label ?? cidade.chave ?? '').trim()
  const primeira = label.split(/\s+/)[0]
  return primeira || label || cidade.chave
}

/** Região com 2+ cidades: Todos + uma aba por cidade. Cidade avulsa: sem abas. */
export function abasCidadeDoBloco(bloco: EcossistemaBloco | null | undefined): AbaCanalCidade[] {
  if (!bloco || bloco.tipo !== 'regiao') return []
  const cidades = (bloco.cidades ?? []).filter((c) => String(c.chave ?? '').trim())
  if (cidades.length <= 1) return []
  return [
    { id: 'geral', label: 'Todos', pais: null },
    ...cidades.map((c) => ({
      id: String(c.chave).trim(),
      label: rotuloCurtoCidade(c),
      pais: c.pais != null ? String(c.pais).trim().toUpperCase() : null,
    })),
  ]
}

function matchCidadeNoBloco(
  raw: string,
  cidades: EcossistemaCidade[],
): EcossistemaCidade | null {
  const n = normalizarCidadeChave(raw).toLowerCase()
  if (!n) return null
  return (
    cidades.find((c) => {
      const chave = normalizarCidadeChave(c.chave).toLowerCase()
      const label = normalizarCidadeChave(c.label).toLowerCase()
      return chave === n || label === n || n.includes(chave) || chave.includes(n)
    }) ?? null
  )
}

export function abaCidadeDoPerfil(
  bloco: EcossistemaBloco | null | undefined,
  opts: {
    pais?: string | null
    cidade?: string | string[] | null
  },
): string {
  const cidades = bloco?.cidades ?? []
  if (cidades.length === 0) return 'geral'

  const lista = Array.isArray(opts.cidade)
    ? opts.cidade
    : opts.cidade != null && String(opts.cidade).trim() !== ''
      ? [String(opts.cidade)]
      : []
  for (const raw of lista) {
    const hit = matchCidadeNoBloco(String(raw), cidades)
    if (hit) return String(hit.chave).trim()
  }

  const pais = String(opts.pais ?? '')
    .trim()
    .toUpperCase()
  const paisNorm = (() => {
    const p = String(opts.pais ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (p === 'br' || p.includes('brasil')) return 'BR'
    if (p === 'py' || p.includes('paraguai') || p.includes('paraguay')) return 'PY'
    if (p === 'ar' || p.includes('argentina')) return 'AR'
    if (pais === 'BR' || pais === 'AR' || pais === 'PY') return pais
    return ''
  })()
  if (paisNorm) {
    const doPais = cidades.filter((c) => String(c.pais ?? '').trim().toUpperCase() === paisNorm)
    if (doPais.length === 1) return String(doPais[0].chave).trim()
  }

  for (const raw of lista) {
    const cod = inferCodigoPaisEmpresa(String(raw))
    if (!cod) continue
    const doPais = cidades.filter((c) => String(c.pais ?? '').trim().toUpperCase() === cod)
    if (doPais.length === 1) return String(doPais[0].chave).trim()
  }

  return 'geral'
}
