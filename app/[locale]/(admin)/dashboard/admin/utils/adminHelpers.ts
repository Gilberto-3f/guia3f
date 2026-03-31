import type { DadoBarras, Periodo, PeriodoVerificacao } from '../types/admin.types'

export function getPeriodoDias(periodo: Periodo): number {
  if (periodo === '7d') return 7
  if (periodo === '30d') return 30
  if (periodo === '90d') return 90
  return 365
}

export function getPeriodoDate(periodo: Periodo): Date {
  const d = new Date()
  d.setDate(d.getDate() - getPeriodoDias(periodo))
  return d
}

export function getMesLabel(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

export function calcVariacaoPercentual(atual: number, anterior: number): number {
  if (anterior <= 0) return atual > 0 ? 100 : 0
  return Number((((atual - anterior) / anterior) * 100).toFixed(1))
}

export function topN<T extends DadoBarras>(arr: T[], n = 8): T[] {
  return [...arr].sort((a, b) => b.total - a.total).slice(0, n)
}

export function getPeriodoVerificacaoDate(periodo: PeriodoVerificacao): Date {
  const d = new Date()
  if (periodo === 'hoje') {
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (periodo === '7d') {
    d.setDate(d.getDate() - 7)
    return d
  }
  d.setDate(d.getDate() - 30)
  return d
}

export function normalizeBusca(v: string): string {
  return v.trim().toLowerCase().replace(/^@/, '')
}
