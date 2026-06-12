import type { SupabaseClient } from '@supabase/supabase-js'

export type ConteudoDenunciaPreview = {
  titulo: string
  texto?: string | null
  imagemUrl?: string | null
  videoUrl?: string | null
  nota?: number | null
  meta?: string | null
}

const TITULO_POR_TIPO: Record<string, string> = {
  post: 'Post Denunciado',
  comentario: 'Comentário Denunciado',
  story: 'Story Denunciado',
  avaliacao: 'Avaliação Denunciada',
}

export function tituloDenunciaConteudo(conteudoTipo: string | null | undefined, denunciadoTipo?: string): string {
  if (conteudoTipo && TITULO_POR_TIPO[conteudoTipo]) return TITULO_POR_TIPO[conteudoTipo]
  if (denunciadoTipo === 'story') return 'Story Denunciado'
  return 'Denúncia de perfil'
}

export async function carregarConteudoDenuncia(
  supabase: SupabaseClient,
  params: {
    conteudoTipo: string | null
    conteudoId: string | null
    denunciadoTipo?: string
    denunciadoId?: string
  },
): Promise<ConteudoDenunciaPreview | null> {
  const tipo = params.conteudoTipo
  const id = params.conteudoId?.trim()
  if (!tipo || !id) {
    if (params.denunciadoTipo === 'story' && params.denunciadoId) {
      const { data } = await supabase.from('stories').select('conteudo_url, legenda').eq('id', params.denunciadoId).maybeSingle()
      if (!data) return { titulo: 'Story Denunciado', texto: 'Conteúdo indisponível' }
      const url = data.conteudo_url != null ? String(data.conteudo_url) : null
      const isVideo = url ? /\.(mp4|webm|mov)(\?|$)/i.test(url) : false
      return {
        titulo: 'Story Denunciado',
        texto: data.legenda != null ? String(data.legenda) : null,
        imagemUrl: !isVideo ? url : null,
        videoUrl: isVideo ? url : null,
      }
    }
    return null
  }

  if (tipo === 'post') {
    const { data } = await supabase.from('posts').select('texto, foto_url, conteudo_url, tipo').eq('id', id).maybeSingle()
    if (!data) return { titulo: 'Post Denunciado', texto: 'Conteúdo removido ou indisponível' }
    const postTipo = String(data.tipo ?? '').toLowerCase()
    const media = data.conteudo_url ?? data.foto_url
    const titulo = postTipo === 'avaliacao' ? 'Avaliação Denunciada' : media ? 'Foto Denunciada' : 'Post Denunciado'
    return {
      titulo,
      texto: data.texto != null ? String(data.texto) : null,
      imagemUrl: media != null ? String(media) : null,
    }
  }

  if (tipo === 'comentario') {
    const { data } = await supabase.from('comentarios').select('texto').eq('id', id).maybeSingle()
    return {
      titulo: 'Comentário Denunciado',
      texto: data?.texto != null ? String(data.texto) : 'Comentário removido ou indisponível',
    }
  }

  if (tipo === 'story') {
    const { data } = await supabase.from('stories').select('conteudo_url, legenda').eq('id', id).maybeSingle()
    if (!data) return { titulo: 'Story Denunciado', texto: 'Conteúdo indisponível' }
    const url = data.conteudo_url != null ? String(data.conteudo_url) : null
    const isVideo = url ? /\.(mp4|webm|mov)(\?|$)/i.test(url) : false
    return {
      titulo: 'Story Denunciado',
      texto: data.legenda != null ? String(data.legenda) : null,
      imagemUrl: !isVideo ? url : null,
      videoUrl: isVideo ? url : null,
    }
  }

  if (tipo === 'avaliacao') {
    const { data } = await supabase.from('avaliacoes').select('nota, feedback, avaliador_tipo').eq('id', id).maybeSingle()
    return {
      titulo: 'Avaliação Denunciada',
      texto: data?.feedback != null ? String(data.feedback) : null,
      nota: data?.nota != null ? Number(data.nota) : null,
      meta: data?.avaliador_tipo != null ? `Avaliador: ${String(data.avaliador_tipo)}` : null,
    }
  }

  return null
}
