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

/** Path: empresas/{empresaId}/servicos/{servicoId}/{arquivo} */
export function pathFotoServicoLocal(empresaId: string, servicoId: string, fileName: string): string {
  return `empresas/${empresaId}/servicos/${servicoId}/${fileName}`
}

export async function uploadFotoServicoLocal(
  supabase: SupabaseClient,
  empresaId: string,
  servicoId: string,
  file: File,
): Promise<string> {
  if (!file || file.size <= 0) {
    throw new Error('Arquivo de imagem inválido. Escolha outra foto.')
  }
  const nome = `${Date.now()}_${nomeSeguroArquivo(file)}`
  const path = pathFotoServicoLocal(empresaId, servicoId, nome)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) {
    throw new Error(
      error.message?.includes('mime') || error.message?.includes('type')
        ? 'Esta foto não foi aceita. Use JPG ou PNG e tente novamente.'
        : `Foto não aceita: ${error.message}`,
    )
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFotosServicoLocal(
  supabase: SupabaseClient,
  empresaId: string,
  servicoId: string,
  files: File[],
): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    urls.push(await uploadFotoServicoLocal(supabase, empresaId, servicoId, file))
  }
  return urls
}
