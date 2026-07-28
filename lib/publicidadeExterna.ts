import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertFotosNovasCompativeis,
  erroUploadFotoAmigavel,
  faltouCampo,
  faltouFotosMinimas,
  relancarErroFotoComIndice,
} from '@/lib/mensagensCadastroEmpresa'

const BUCKET = 'empresas'
export const PUBLICIDADE_EXTERNA_TITULO_MAX = 30
export const PUBLICIDADE_EXTERNA_DESC_MAX = 750
export const PUBLICIDADE_EXTERNA_FOTOS_MIN = 1
export const PUBLICIDADE_EXTERNA_FOTOS_MAX = 5

export type PublicidadeExternaCard = {
  id: string
  titulo: string
  descricao: string
  fotos: string[]
  ordem: number
  created_at: string
  updated_at: string
}

export type PublicidadeExternaConfig = {
  id: number
  whatsapp: string | null
  updated_at: string
}

function nomeSeguroArquivo(file: File): string {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const base = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  return base || `foto.${ext}`
}

export function pathFotoPublicidadeExterna(cardId: string, fileName: string): string {
  return `empresas/publicidade-externa/${cardId}/${fileName}`
}

export async function uploadFotoPublicidadeExterna(
  supabase: SupabaseClient,
  cardId: string,
  file: File,
): Promise<string> {
  const nome = `${Date.now()}_${nomeSeguroArquivo(file)}`
  const path = pathFotoPublicidadeExterna(cardId, nome)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw erroUploadFotoAmigavel(error)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFotosPublicidadeExterna(
  supabase: SupabaseClient,
  cardId: string,
  files: File[],
): Promise<string[]> {
  assertFotosNovasCompativeis(files)
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    try {
      urls.push(await uploadFotoPublicidadeExterna(supabase, cardId, files[i]))
    } catch (e) {
      relancarErroFotoComIndice(e, i)
    }
  }
  return urls
}

export function validarFormPublicidadeExterna(input: {
  titulo: string
  descricao: string
  totalFotos: number
}): string | null {
  const titulo = input.titulo.trim()
  if (!titulo) return faltouCampo('Título')
  if (titulo.length > PUBLICIDADE_EXTERNA_TITULO_MAX) {
    return `O título deve ter no máximo ${PUBLICIDADE_EXTERNA_TITULO_MAX} caracteres.`
  }
  if (input.descricao.length > PUBLICIDADE_EXTERNA_DESC_MAX) {
    return `A descrição deve ter no máximo ${PUBLICIDADE_EXTERNA_DESC_MAX} caracteres.`
  }
  if (input.totalFotos === 0) return faltouCampo('Foto')
  if (input.totalFotos < PUBLICIDADE_EXTERNA_FOTOS_MIN) {
    return faltouFotosMinimas(PUBLICIDADE_EXTERNA_FOTOS_MIN)
  }
  if (input.totalFotos > PUBLICIDADE_EXTERNA_FOTOS_MAX) {
    return `No máximo ${PUBLICIDADE_EXTERNA_FOTOS_MAX} fotos.`
  }
  return null
}

export async function listarCardsPublicidadeExterna(
  supabase: SupabaseClient,
): Promise<PublicidadeExternaCard[]> {
  const { data, error } = await supabase
    .from('publicidade_externa_cards')
    .select('*')
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapCard(r as Record<string, unknown>))
}

export async function buscarConfigPublicidadeExterna(
  supabase: SupabaseClient,
): Promise<PublicidadeExternaConfig | null> {
  const { data, error } = await supabase
    .from('publicidade_externa_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: Number(data.id),
    whatsapp: data.whatsapp != null ? String(data.whatsapp) : null,
    updated_at: String(data.updated_at ?? ''),
  }
}

export async function salvarWhatsappPublicidadeExterna(
  supabase: SupabaseClient,
  whatsapp: string | null,
): Promise<void> {
  const valor = whatsapp != null && String(whatsapp).trim() !== '' ? String(whatsapp).trim() : null
  const { error } = await supabase.from('publicidade_externa_config').upsert({
    id: 1,
    whatsapp: valor,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

function mapCard(r: Record<string, unknown>): PublicidadeExternaCard {
  const fotosRaw = r.fotos
  const fotos = Array.isArray(fotosRaw)
    ? fotosRaw.map((u) => String(u ?? '').trim()).filter(Boolean)
    : []
  return {
    id: String(r.id),
    titulo: String(r.titulo ?? ''),
    descricao: String(r.descricao ?? ''),
    fotos,
    ordem: Number(r.ordem) || 0,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function salvarOrdemCardsPublicidadeExterna(
  supabase: SupabaseClient,
  idsOrdenados: string[],
): Promise<void> {
  await Promise.all(
    idsOrdenados.map(async (id, index) => {
      const { error } = await supabase
        .from('publicidade_externa_cards')
        .update({ ordem: index, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    }),
  )
}
