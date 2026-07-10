import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'empresas'

function nomeSeguroArquivo(file: File): string {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const base = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  return base || `foto.${ext}`
}

/** Path: empresas/{empresaId}/acomodacoes/{acomodacaoId}/{arquivo} */
export function pathFotoAcomodacao(
  empresaId: string,
  acomodacaoId: string,
  fileName: string,
): string {
  return `empresas/${empresaId}/acomodacoes/${acomodacaoId}/${fileName}`
}

export async function uploadFotoAcomodacao(
  supabase: SupabaseClient,
  empresaId: string,
  acomodacaoId: string,
  file: File,
): Promise<string> {
  const nome = `${Date.now()}_${nomeSeguroArquivo(file)}`
  const path = pathFotoAcomodacao(empresaId, acomodacaoId, nome)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFotosAcomodacao(
  supabase: SupabaseClient,
  empresaId: string,
  acomodacaoId: string,
  files: File[],
): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    urls.push(await uploadFotoAcomodacao(supabase, empresaId, acomodacaoId, file))
  }
  return urls
}
