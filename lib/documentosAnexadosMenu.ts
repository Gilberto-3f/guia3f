import type { SupabaseClient } from '@supabase/supabase-js'

/** Profissional enviou os três documentos obrigatórios ao storage. */
export async function profissionalTemDocumentosAnexados(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profissionais')
    .select('documento_frente_url, comprovante_residencia_url, comprovante_profissao_url')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (!data) return false
  const id = String(data.documento_frente_url ?? '').trim()
  const end = String(data.comprovante_residencia_url ?? '').trim()
  const prof = String(data.comprovante_profissao_url ?? '').trim()
  return Boolean(id && end && prof)
}

/** Empresa enviou comprovante de endereço e documento comercial. */
export async function empresaTemDocumentosAnexados(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('empresas')
    .select('comprovante_residencia_url, documento_comercial_url')
    .eq('id', empresaId)
    .maybeSingle()

  if (!data) return false
  const end = String(data.comprovante_residencia_url ?? '').trim()
  const com = String(data.documento_comercial_url ?? '').trim()
  return Boolean(end && com)
}
