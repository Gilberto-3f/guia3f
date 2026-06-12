import type { CadastroPendente } from './CardPendente'
import type { PendenteEmpresa, PendenteProfissional, PendenteTurista } from '../../types/admin.types'
import { normalizarCategoriaEmpresaGuia, ROTULO_SEGUIMENTO_GUIA } from '@/lib/segmentosEmpresaGuia'
import {
  formatContatoExibicao,
  formatLocalizacaoVerificacao,
  formatProfissionalCategorias,
  pickDocumentoFiscalEmpresa,
} from './verificacaoFormatters'

function rotuloSegmentoEmpresa(categoria: string): string | undefined {
  const cat = normalizarCategoriaEmpresaGuia(categoria)
  if (cat) return ROTULO_SEGUIMENTO_GUIA[cat]
  return undefined
}

function parseFotosEmpresa(r: Record<string, unknown>): string[] {
  const raw = r.fotos_urls ?? r.fotos_url
  if (Array.isArray(raw)) return raw.map((v) => String(v))
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? p.map((v) => String(v)) : []
    } catch {
      return []
    }
  }
  return []
}

function parseCategoriasProfissional(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v))
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? p.map((v) => String(v)) : []
    } catch {
      return []
    }
  }
  return []
}

export function mapTuristaToCadastroPendente(p: PendenteTurista): CadastroPendente {
  return {
    id: p.id,
    usuarioId: p.usuario_id,
    nome: p.nome_completo,
    username: `@${p.nome_usuario}`,
    label: 'Turista',
    dataCadastro: new Date(p.created_at).toLocaleDateString('pt-BR'),
    email: p.email?.trim() || '—',
    whatsappLine: formatContatoExibicao(p.whatsapp || p.telefone),
    avatarUrl: p.foto_url,
    documentoIdentidade: p.documento_identidade?.trim() || undefined,
    alerta: null,
    docsVerificado: p.docs_verificado,
    docsVerificadoEm: p.docs_verificado_em ? new Date(p.docs_verificado_em).toLocaleDateString('pt-BR') : null,
    placaVermelha: false,
    raw: { ...p } as Record<string, unknown>,
  }
}

export function mapProfissionalToCadastroPendente(p: PendenteProfissional): CadastroPendente {
  const contato = p.whatsapp || p.telefone
  return {
    id: p.id,
    usuarioId: p.usuario_id,
    nome: p.nome_completo,
    username: `@${p.nome_usuario}`,
    label: 'Profissional',
    dataCadastro: new Date(p.created_at).toLocaleDateString('pt-BR'),
    email: p.email?.trim() || '—',
    whatsappLine: formatContatoExibicao(contato),
    avatarUrl: p.foto_url,
    documentoIdentidade: p.documento_identidade?.trim() || undefined,
    categoriaProfissional: (() => {
      const fmt = formatProfissionalCategorias(p.categorias)
      return fmt !== '—' ? fmt : undefined
    })(),
    cidadeDisplay:
      formatLocalizacaoVerificacao({
        cidadesAtuacao: p.cidade_atuacao,
        pais: p.pais,
      }) ?? undefined,
    alerta: null,
    docsVerificado: p.docs_verificado,
    docsVerificadoEm: p.docs_verificado_em ? new Date(p.docs_verificado_em).toLocaleDateString('pt-BR') : null,
    placaVermelha: p.placa_vermelha,
    raw: { ...p } as Record<string, unknown>,
  }
}

export function mapEmpresaToCadastroPendente(p: PendenteEmpresa): CadastroPendente {
  const raw = { ...p } as Record<string, unknown>
  return {
    id: p.id,
    usuarioId: p.usuario_id,
    nome: String(p.nome_fantasia ?? ''),
    username: `@${String(p.nome_usuario ?? '')}`,
    label: 'Empresa',
    dataCadastro: new Date(p.created_at).toLocaleDateString('pt-BR'),
    email: p.email?.trim() || '—',
    whatsappLine: formatContatoExibicao(p.whatsapp || p.telefone),
    avatarUrl: p.fotos_url?.[0] ?? null,
    empresaFiscal: pickDocumentoFiscalEmpresa(raw),
    segmentoEmpresa: rotuloSegmentoEmpresa(String(p.categoria ?? '')),
    cidadeDisplay: formatLocalizacaoVerificacao({ cidade: p.cidade }) ?? undefined,
    alerta: null,
    docsVerificado: p.docs_verificado,
    docsVerificadoEm: p.docs_verificado_em ? new Date(p.docs_verificado_em).toLocaleDateString('pt-BR') : null,
    placaVermelha: false,
    raw,
  }
}

export function mapRowToCadastroPendente(
  tipo: 'turistas' | 'profissionais' | 'empresas',
  row: Record<string, unknown>,
  email?: string | null,
  preLiberacoes?: Record<string, unknown>[],
): CadastroPendente | null {
  if (tipo === 'turistas') {
    const p: PendenteTurista = {
      id: String(row.id),
      usuario_id: String(row.usuario_id),
      nome_completo: String(row.nome_completo ?? ''),
      nome_usuario: String(row.nome_usuario ?? ''),
      foto_url: row.foto_perfil_url ? String(row.foto_perfil_url) : null,
      documento_frente_url: row.documento_frente_url ? String(row.documento_frente_url) : null,
      documento_verso_url: row.documento_verso_url ? String(row.documento_verso_url) : null,
      documento_identidade:
        row.documento_identidade != null && String(row.documento_identidade).trim()
          ? String(row.documento_identidade).trim()
          : null,
      docs_verificado: Boolean(row.docs_verificado),
      docs_verificado_por: row.docs_verificado_por ? String(row.docs_verificado_por) : null,
      docs_verificado_em: row.docs_verificado_em ? String(row.docs_verificado_em) : null,
      created_at: String(row.created_at ?? new Date().toISOString()),
      email: email ?? null,
      whatsapp: row.whatsapp != null && String(row.whatsapp).trim() ? String(row.whatsapp).trim() : null,
      telefone: row.telefone != null && String(row.telefone).trim() ? String(row.telefone).trim() : null,
      pre_liberacoes: preLiberacoes ?? [],
    }
    return mapTuristaToCadastroPendente(p)
  }

  if (tipo === 'profissionais') {
    const categorias = parseCategoriasProfissional(row.categorias)
    const p: PendenteProfissional = {
      id: String(row.id),
      usuario_id: String(row.usuario_id),
      nome_completo: String(row.nome_completo ?? ''),
      nome_usuario: String(row.nome_usuario ?? ''),
      foto_url: row.foto_perfil_url ? String(row.foto_perfil_url) : null,
      categorias,
      placa_vermelha: Boolean(row.placa_vermelha),
      documento_frente_url: row.documento_frente_url != null ? String(row.documento_frente_url) : null,
      documento_identidade:
        row.documento_identidade != null && String(row.documento_identidade).trim()
          ? String(row.documento_identidade).trim()
          : null,
      documentos: {
        identidade_url: String(row.documento_frente_url ?? row.identidade_url ?? ''),
        documento_verso_url: String(row.documento_verso_url ?? ''),
        comprovante_residencia_url: String(row.comprovante_residencia_url ?? ''),
        comprovante_profissao_url: String(row.comprovante_profissao_url ?? ''),
      },
      docs_verificado: Boolean(row.docs_verificado),
      docs_verificado_por: row.docs_verificado_por ? String(row.docs_verificado_por) : null,
      docs_verificado_em: row.docs_verificado_em ? String(row.docs_verificado_em) : null,
      created_at: String(row.created_at ?? new Date().toISOString()),
      email: email ?? null,
      whatsapp: row.whatsapp != null && String(row.whatsapp).trim() ? String(row.whatsapp).trim() : null,
      telefone: row.telefone != null && String(row.telefone).trim() ? String(row.telefone).trim() : null,
      pais: row.pais != null && String(row.pais).trim() ? String(row.pais).trim() : null,
      cidade_atuacao: Array.isArray(row.cidade_atuacao)
        ? row.cidade_atuacao.map((v) => String(v))
        : row.cidade_atuacao != null && String(row.cidade_atuacao).trim()
          ? [String(row.cidade_atuacao).trim()]
          : null,
    }
    return mapProfissionalToCadastroPendente(p)
  }

  const docRaw = row.documento_comercial_url ?? row.documento_url ?? row.documento_comercial
  const doc = docRaw ? String(docRaw) : ''
  const p: PendenteEmpresa = {
    id: String(row.id),
    usuario_id: String(row.usuario_id),
    nome_fantasia: String(row.nome_fantasia ?? ''),
    nome_usuario: String(row.nome_usuario ?? ''),
    categoria: String(row.categoria ?? ''),
    cidade: String(row.cidade ?? ''),
    documento_frente_url: row.documento_frente_url != null ? String(row.documento_frente_url) : null,
    documento_verso_url: row.documento_verso_url != null ? String(row.documento_verso_url) : null,
    comprovante_residencia_url: row.comprovante_residencia_url != null ? String(row.comprovante_residencia_url) : null,
    documento_url: doc || null,
    documento_comercial_url:
      row.documento_comercial_url != null && String(row.documento_comercial_url).trim()
        ? String(row.documento_comercial_url).trim()
        : null,
    fotos_url: parseFotosEmpresa(row),
    docs_verificado: Boolean(row.docs_verificado),
    docs_verificado_por: row.docs_verificado_por ? String(row.docs_verificado_por) : null,
    docs_verificado_em: row.docs_verificado_em ? String(row.docs_verificado_em) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    email: email ?? null,
    whatsapp: row.whatsapp != null && String(row.whatsapp).trim() ? String(row.whatsapp).trim() : null,
    telefone: row.telefone != null && String(row.telefone).trim() ? String(row.telefone).trim() : null,
  }
  return mapEmpresaToCadastroPendente(p)
}
