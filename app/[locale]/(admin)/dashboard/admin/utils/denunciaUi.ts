import type { DenunciaGravidade } from '../types/admin.types'

export const NIVEIS_GRAVIDADE_DENUNCIA: { id: DenunciaGravidade; label: string }[] = [
  { id: 'leve', label: 'Leve' },
  { id: 'media', label: 'Média' },
  { id: 'grave', label: 'Grave' },
  { id: 'gravissima', label: 'Gravíssima' },
]

export const LABEL_GRAVIDADE: Record<DenunciaGravidade, string> = {
  leve: 'Leve',
  media: 'Média',
  grave: 'Grave',
  gravissima: 'Gravíssima',
}

/** Evita duplicar motivo quando descricao repete o texto do campo livre. */
export function formatarMotivoDenuncia(motivo: string, descricao: string | null | undefined): string {
  const m = motivo.trim()
  const d = descricao?.trim() ?? ''
  if (!d || d === m) return m
  if (m && d.startsWith(m)) return d
  return `${m} — ${d}`
}

export function labelStatusDenunciaCard(status: string): string {
  const map: Record<string, string> = {
    pendente: 'Pendente',
    em_investigacao: 'Em investigação',
    encerrada: 'Encerrada',
    arquivada: 'Arquivada',
  }
  return map[status] ?? status
}

export function classeStatusDenunciaCard(status: string): string {
  if (status === 'pendente') return 'text-red-600'
  if (status === 'em_investigacao') return 'text-[#0097b2]'
  return 'text-gray-500'
}
