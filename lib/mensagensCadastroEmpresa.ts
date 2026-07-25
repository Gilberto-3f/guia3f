/** Mensagens amigáveis nos formulários de cadastro da empresa (sem jargão técnico). */

export const MSG_FOTO_INCOMPATIVEL = 'Formato de foto incompatível, troque ou exclua.'

export function faltouCampo(nomeCampo: string): string {
  return `Faltou preencher o campo "${nomeCampo}"`
}

export function ehErroFormatoFoto(mensagem: string | null | undefined): boolean {
  const m = String(mensagem ?? '').toLowerCase()
  if (!m) return false
  if (m.includes('formato de foto incompatível')) return true
  return (
    m.includes('mime') ||
    m.includes('not supported') ||
    m.includes('unsupported') ||
    m.includes('avif') ||
    m.includes('heic') ||
    m.includes('heif') ||
    (m.includes('type') && (m.includes('image') || m.includes('allowed')))
  )
}

/** Erro de formato com índice da foto nova rejeitada (0-based em `fotosNovas`). */
export class ErroFotoIncompativel extends Error {
  readonly indiceNova: number

  constructor(indiceNova: number) {
    super(MSG_FOTO_INCOMPATIVEL)
    this.name = 'ErroFotoIncompativel'
    this.indiceNova = indiceNova
  }
}

export function indiceFotoRejeitada(e: unknown): number | null {
  if (e instanceof ErroFotoIncompativel) return e.indiceNova
  return null
}

/** Converte erro de storage/upload em mensagem amigável quando for formato de arquivo. */
export function erroUploadFotoAmigavel(error: { message?: string } | null | undefined): Error {
  const raw = String(error?.message ?? '')
  if (ehErroFormatoFoto(raw)) return new Error(MSG_FOTO_INCOMPATIVEL)
  return new Error(raw.trim() || MSG_FOTO_INCOMPATIVEL)
}

/** Relança com índice quando o upload de uma foto da lista falha por formato. */
export function relancarErroFotoComIndice(e: unknown, indiceNova: number): never {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String((e as { message?: unknown }).message ?? '')
        : String(e ?? '')
  if (ehErroFormatoFoto(msg) || e instanceof ErroFotoIncompativel) {
    throw new ErroFotoIncompativel(indiceNova)
  }
  throw e instanceof Error ? e : new Error(msg || MSG_FOTO_INCOMPATIVEL)
}

/** Normaliza erros no catch do salvar (inclui StorageError cru do Supabase). */
export function normalizarErroCadastroEmpresa(e: unknown, fallback: string): string {
  if (e instanceof ErroFotoIncompativel) return MSG_FOTO_INCOMPATIVEL
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String((e as { message?: unknown }).message ?? '')
        : String(e ?? '')
  if (ehErroFormatoFoto(msg)) return MSG_FOTO_INCOMPATIVEL
  return msg.trim() || fallback
}
