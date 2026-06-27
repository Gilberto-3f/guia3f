import {
  empresaRecursosLiberados,
  profissionalRecursosLiberados,
  type LinhaEmpresaGate,
  type LinhaProfissionalGate,
} from '@/lib/verificacao-documentos'
import {
  turistaCadastroVerificadoPeloAdm,
  turistaRecursosLiberados,
  type TuristaDocsRow,
  type UsuarioTuristaGate,
} from '@/lib/turistaAcesso'

export type FaseVerificacaoConta = 'liberado' | 'aguardando_adm' | 'pendente_docs'

export function turistaDocumentosEnviados(row: TuristaDocsRow | null | undefined): boolean {
  if (!row) return false
  const frente = String(row.documento_frente_url ?? '').trim()
  const verso = String(row.documento_verso_url ?? '').trim()
  return Boolean(frente && verso)
}

export function profissionalDocumentosEnviados(prof: LinhaProfissionalGate | null | undefined): boolean {
  if (!prof) return false
  if (prof.documentos_enviados_em) return true
  return Boolean(String(prof.documento_frente_url ?? '').trim())
}

export function empresaDocumentosEnviados(
  emp: {
    documentos_enviados_em?: string | null
    documento_comercial_url?: string | null
    comprovante_residencia_url?: string | null
  } | null
    | undefined,
): boolean {
  if (!emp) return false
  if (String(emp.documentos_enviados_em ?? '').trim()) return true
  if (String(emp.documento_comercial_url ?? '').trim()) return true
  return false
}

export function faseVerificacaoTurista(
  u: UsuarioTuristaGate | null | undefined,
  tur: TuristaDocsRow | null | undefined,
): FaseVerificacaoConta {
  if (!u || String(u.role ?? '') !== 'turista') return 'liberado'
  if (turistaRecursosLiberados(u)) return 'liberado'
  if (turistaDocumentosEnviados(tur)) return 'aguardando_adm'
  return 'pendente_docs'
}

/** Fase do feed social: exige liberação definitiva do ADM (pré-liberação 24h não conta). */
export function faseFeedSocialTurista(
  u: UsuarioTuristaGate | null | undefined,
  tur: TuristaDocsRow | null | undefined,
): FaseVerificacaoConta {
  if (!u || String(u.role ?? '') !== 'turista') return 'liberado'
  if (turistaCadastroVerificadoPeloAdm(u)) return 'liberado'
  if (turistaDocumentosEnviados(tur)) return 'aguardando_adm'
  return 'pendente_docs'
}

export function faseVerificacaoProfissional(
  usuarioStatus: string | null | undefined,
  prof: LinhaProfissionalGate | null | undefined,
): FaseVerificacaoConta {
  if (!prof) return 'pendente_docs'
  if (profissionalRecursosLiberados(usuarioStatus, prof)) return 'liberado'
  if (profissionalDocumentosEnviados(prof)) return 'aguardando_adm'
  return 'pendente_docs'
}

/** Feed social do profissional: mesma regra de verificação definitiva. */
export function faseFeedSocialProfissional(
  usuarioStatus: string | null | undefined,
  prof: LinhaProfissionalGate | null | undefined,
): FaseVerificacaoConta {
  return faseVerificacaoProfissional(usuarioStatus, prof)
}

export function faseVerificacaoEmpresa(
  usuarioStatus: string | null | undefined,
  emp: LinhaEmpresaGate | null | undefined,
): FaseVerificacaoConta {
  if (!emp) return 'pendente_docs'
  if (empresaRecursosLiberados(usuarioStatus, emp)) return 'liberado'
  if (empresaDocumentosEnviados(emp)) return 'aguardando_adm'
  return 'pendente_docs'
}
