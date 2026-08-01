import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import {
  MOEDAS_MOBILIDADE,
  type MoedaMobilidadeId,
} from '@/lib/mobilidadePopupPesquisa'

export type MoedaModoProfissional = 'todas' | 'prioridade'

/** Van / táxi / guia com placa vermelha — não anfitrião nem motorista de app. */
export function profissionalElegivelPerfilMobilidade(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): boolean {
  if (!placaVermelha) return false
  const cats = normalizarCategoriasProfissional(categorias)
  if (cats.includes('anfitriao') && !cats.some((c) => c === 'van' || c === 'taxista' || c === 'guia')) {
    return false
  }
  if (cats.includes('motorista_app') && !cats.some((c) => c === 'van' || c === 'taxista' || c === 'guia')) {
    return false
  }
  return cats.includes('van') || cats.includes('taxista') || cats.includes('guia')
}

const MOEDA_SET = new Set<string>(MOEDAS_MOBILIDADE.map((m) => m.value))

export function normalizarMoedasPreferencia(raw: unknown): MoedaMobilidadeId[] {
  if (!Array.isArray(raw)) return []
  const out: MoedaMobilidadeId[] = []
  for (const item of raw) {
    const c = String(item ?? '')
      .trim()
      .toLowerCase()
    if (MOEDA_SET.has(c) && !out.includes(c as MoedaMobilidadeId)) {
      out.push(c as MoedaMobilidadeId)
    }
  }
  return out
}

export function normalizarMoedaModo(raw: unknown): MoedaModoProfissional {
  return String(raw ?? '').trim().toLowerCase() === 'prioridade' ? 'prioridade' : 'todas'
}

export function normalizarVeiculoFotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((u) => String(u ?? '').trim())
    .filter((u) => u.startsWith('http'))
    .slice(0, 8)
}

export function normalizarVeiculoLugares(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) return null
  return Math.min(50, n)
}

/**
 * Soft-rank de moeda (só relevante com pagamento em dinheiro + moedas do turista).
 * 0 = prioridade alta; 1 = sem cadastro / neutro; 2 = fim da fila.
 */
export function scoreMoedaSoftRank(
  modo: MoedaModoProfissional | null | undefined,
  preferenciaProf: string[] | null | undefined,
  pagamentoTurista: string | null | undefined,
  moedasTurista: string[] | null | undefined,
): number {
  const pag = String(pagamentoTurista ?? '').trim().toLowerCase()
  if (pag !== 'dinheiro') return 0

  const turistaMoedas = normalizarMoedasPreferencia(moedasTurista)
  if (turistaMoedas.length === 0) return 0

  const m = normalizarMoedaModo(modo)
  if (m === 'todas') return 0

  const prefs = normalizarMoedasPreferencia(preferenciaProf)
  if (prefs.length === 0) return 1 // prioridade sem lista → neutro

  const overlap = prefs.some((p) => turistaMoedas.includes(p))
  return overlap ? 0 : 2
}

/** Soft-rank idioma: 0 = fala; 1 = sem preferência / neutro; 2 = não fala. */
export function scoreIdiomaSoftRank(
  idiomasProf: string[] | null | undefined,
  idiomaPreferido: string | null | undefined,
): number {
  const pref = String(idiomaPreferido ?? '')
    .trim()
    .toLowerCase()
  if (!pref) return 0
  if (!Array.isArray(idiomasProf) || idiomasProf.length === 0) return 1
  const tem = idiomasProf.some((i) => String(i).trim().toLowerCase() === pref)
  return tem ? 0 : 2
}

/** Mapeia código do app (real/dolar…) para ISO usado em cotacoes. */
export function moedaMobilidadeParaIso(codigo: string): string {
  switch (String(codigo).toLowerCase()) {
    case 'real':
      return 'BRL'
    case 'guarani':
      return 'PYG'
    case 'peso':
      return 'ARS'
    case 'dolar':
      return 'USD'
    case 'euro':
      return 'EUR'
    default:
      return 'BRL'
  }
}
