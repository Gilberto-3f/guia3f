import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertFotosNovasCompativeis,
  erroUploadFotoAmigavel,
  relancarErroFotoComIndice,
} from '@/lib/mensagensCadastroEmpresa'

const BUCKET = 'empresas'

function nomeSeguroArquivo(file: File): string {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const base = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  return base || `foto.${ext}`
}

/** Path: empresas/{empresaId}/atrativos/{experienciaId}/{arquivo} */
export function pathFotoAtrativo(
  empresaId: string,
  experienciaId: string,
  fileName: string,
): string {
  return `empresas/${empresaId}/atrativos/${experienciaId}/${fileName}`
}

export async function uploadFotoAtrativo(
  supabase: SupabaseClient,
  empresaId: string,
  experienciaId: string,
  file: File,
): Promise<string> {
  const nome = `${Date.now()}_${nomeSeguroArquivo(file)}`
  const path = pathFotoAtrativo(empresaId, experienciaId, nome)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw erroUploadFotoAmigavel(error)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFotosAtrativo(
  supabase: SupabaseClient,
  empresaId: string,
  experienciaId: string,
  files: File[],
): Promise<string[]> {
  assertFotosNovasCompativeis(files)
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    try {
      urls.push(await uploadFotoAtrativo(supabase, empresaId, experienciaId, files[i]))
    } catch (e) {
      relancarErroFotoComIndice(e, i)
    }
  }
  return urls
}
