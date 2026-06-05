import { profissionalRecursosLiberados, type LinhaProfissionalGate } from '@/lib/verificacao-documentos'
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
