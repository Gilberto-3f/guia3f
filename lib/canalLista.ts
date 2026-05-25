import type { SupabaseClient } from '@supabase/supabase-js'

export type UltimaMensagemCanal = {
  preview: string
  created_at: string
}

/**
 * @param {string | null | undefined} iso
 */
export function formatarListaHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const hoje = new Date()
  if (date.toDateString() === hoje.toDateString()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  if (date.toDateString() === ontem.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * @param {string | null | undefined} texto
 * @param {string | null | undefined} anexoTipo
 */
export function resumoMensagem(texto: string | null | undefined, anexoTipo: string | null | undefined): string {
  const t = (texto ?? '').trim()
  if (t) return t.length > 72 ? `${t.slice(0, 72)}…` : t
  if (anexoTipo === 'imagem') return '📷 Foto'
  if (anexoTipo === 'documento') return '📎 Anexo'
  return ''
}

/**
 * Última mensagem por canal (primeira ocorrência após ordenar desc).
 */
export async function buscarUltimasMensagensCanais(
  supabase: SupabaseClient,
  canalIds: string[],
): Promise<Record<string, UltimaMensagemCanal>> {
  if (canalIds.length === 0) return {}

  const { data, error } = await supabase
    .from('mensagens_canal')
    .select('canal_id, texto, anexo_tipo, created_at')
    .in('canal_id', canalIds)
    .order('created_at', { ascending: false })
    .limit(Math.min(canalIds.length * 3, 400))

  if (error) {
    console.error('buscarUltimasMensagensCanais:', error)
    return {}
  }

  const map: Record<string, UltimaMensagemCanal> = {}
  for (const row of data ?? []) {
    const cid = String(row.canal_id)
    if (map[cid]) continue
    map[cid] = {
      preview: resumoMensagem(
        row.texto != null ? String(row.texto) : null,
        row.anexo_tipo != null ? String(row.anexo_tipo) : null,
      ),
      created_at: String(row.created_at ?? ''),
    }
  }
  return map
}

/**
 * @param {string | null | undefined} ultimaMensagemEm
 * @param {string | null | undefined} vistoEm
 */
export function canalTemNaoLidas(ultimaMensagemEm: string | null | undefined, vistoEm: string | null | undefined): boolean {
  if (!ultimaMensagemEm) return false
  if (!vistoEm) return true
  return new Date(ultimaMensagemEm).getTime() > new Date(vistoEm).getTime()
}
