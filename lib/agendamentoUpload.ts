import { supabase } from '@/lib/supabase'

/** Upload de mídia para agendamento (story ou foto). */
export async function uploadMidiaAgendada(
  usuarioId: string,
  tipo: 'story' | 'foto',
  arquivo: File | Blob,
  nomeArquivo?: string,
): Promise<string> {
  const bucket = tipo === 'story' ? 'stories' : 'posts'
  const ext =
    arquivo instanceof File
      ? arquivo.name.split('.').pop() || 'jpg'
      : 'jpg'
  const path = `${usuarioId}/agendados/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const contentType =
    arquivo instanceof File ? arquivo.type || 'image/jpeg' : 'image/jpeg'
  const { error } = await supabase.storage.from(bucket).upload(path, arquivo, {
    upsert: false,
    contentType,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
