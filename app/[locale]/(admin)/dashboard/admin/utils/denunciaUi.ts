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
  if (status === 'em_investigacao') return 'text-[#00D443]'
  return 'text-gray-500'
}

const LABEL_MEDIDA: Record<string, string> = {
  improcedente: 'Denúncia improcedente',
  mensagem: 'Mensagem enviada ao usuário',
  bloqueio: 'Bloqueio temporário de acesso',
  excluir_conteudo: 'Publicação denunciada excluída',
  excluir_cadastro: 'Exclusão de cadastro solicitada',
  advertencia: 'Advertência',
  suspensao: 'Suspensão temporária',
  banimento: 'Banimento permanente',
}

export function labelMedidaDenuncia(tipo: string | null | undefined): string {
  if (!tipo) return '—'
  return LABEL_MEDIDA[tipo] ?? tipo.replace(/_/g, ' ')
}

export function resumoMedidaDenuncia(params: {
  medida_tipo?: string | null
  penalidade_aplicada?: string | null
  penalidade_detalhes?: { texto?: string | null; motivo?: string | null; medida?: string | null; dias?: number } | null
}): string {
  const partes: string[] = []
  const tipo = params.medida_tipo ?? params.penalidade_aplicada
  if (tipo) partes.push(labelMedidaDenuncia(tipo))

  const det = params.penalidade_detalhes
  if (det?.texto?.trim()) partes.push(det.texto.trim())
  else if (det?.motivo?.trim()) partes.push(det.motivo.trim())

  if (det?.dias) partes.push(`Duração: ${det.dias} dia(s)`)

  return partes.length ? partes.join(' · ') : 'Nenhuma medida registrada.'
}

