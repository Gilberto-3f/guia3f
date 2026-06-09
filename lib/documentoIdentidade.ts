/** Normaliza número de documento (CPF/RG/CI) para comparação entre contas. */
export function normalizarDocumentoIdentidade(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Mínimo de caracteres alfanuméricos após normalização. */
export const DOCUMENTO_IDENTIDADE_MIN_LEN = 5

export function documentoIdentidadeValido(raw: string | null | undefined): boolean {
  return normalizarDocumentoIdentidade(raw).length >= DOCUMENTO_IDENTIDADE_MIN_LEN
}
