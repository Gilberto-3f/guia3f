/** Mensagens amigáveis nos formulários de cadastro da empresa (sem jargão técnico). */

export const MSG_FOTO_INCOMPATIVEL = 'Formato de foto incompatível, troque ou exclua.'

/** Destaque visual da foto rejeitada (border — ring some com overflow-hidden). */
export const CLS_FOTO_REJEITADA = 'border-2 border-red-500'

const MIME_FOTO_ACEITOS = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])
const EXT_FOTO_ACEITAS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export function faltouCampo(nomeCampo: string): string {
  return `Faltou preencher o campo "${nomeCampo}"`
}

/** Mensagem quando há foto(s) mas ainda falta atingir o mínimo. */
export function faltouFotosMinimas(min: number): string {
  return min <= 1
    ? faltouCampo('Foto')
    : `Envie no mínimo ${min} fotos.`
}

/** Valida se o arquivo é um formato de imagem aceito pelo storage. */
export function fotoArquivoCompativel(file: File): boolean {
  if (!file || file.size <= 0) return false
  const type = String(file.type ?? '').toLowerCase().trim()
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (
    type.includes('avif') ||
    type.includes('heic') ||
    type.includes('heif') ||
    ext === 'avif' ||
    ext === 'heic' ||
    ext === 'heif'
  ) {
    return false
  }
  if (type && MIME_FOTO_ACEITOS.has(type)) return true
  if (EXT_FOTO_ACEITAS.has(ext)) return true
  return false
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

/** Lança ErroFotoIncompativel no primeiro arquivo incompatível (antes de qualquer upload). */
export function assertFotosNovasCompativeis(files: File[]): void {
  for (let i = 0; i < files.length; i++) {
    if (!fotoArquivoCompativel(files[i])) {
      throw new ErroFotoIncompativel(i)
    }
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
