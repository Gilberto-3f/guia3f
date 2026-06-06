'use client'

export { useDashboardEmpresa } from '../context/DashboardEmpresaContext'

export interface DadosEmpresa {
  id: string
  usuario_id: string | null
  nome: string
  username: string
  categoria: string
  cidade: string
  plano: string
  nota_media: number
  total_avaliacoes: number
  verificado: boolean
}

export const EMPRESA_SELECT =
  'id, usuario_id, nome_fantasia, nome_usuario, categoria, cidade, plano, nota_media, total_avaliacoes, docs_verificado, status'

function asString(v: unknown, fallback = '') {
  return v != null ? String(v) : fallback
}

function asNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function mapEmpresaRow(data: Record<string, unknown>): DadosEmpresa {
  const status = asString(data.status, '')
  return {
    id: asString(data.id),
    usuario_id: data.usuario_id != null ? asString(data.usuario_id) : null,
    nome: asString(data.nome_fantasia, 'Empresa'),
    username: asString(data.nome_usuario, ''),
    categoria: asString(data.categoria, ''),
    cidade: asString(data.cidade, ''),
    plano: asString(data.plano, 'Básico'),
    nota_media: asNumber(data.nota_media, 0),
    total_avaliacoes: asNumber(data.total_avaliacoes, 0),
    verificado: Boolean(data.docs_verificado) || status === 'ativo',
  }
}
