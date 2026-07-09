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
  if (anexoTipo === 'audio') return '🎤 Áudio'
  if (anexoTipo === 'documento') return '📎 Anexo'
  return ''
}

/**
 * Última mensagem por canal (uma query por canal, em lotes — ordenação confiável na lista).
 */
export async function buscarUltimasMensagensCanais(
  supabase: SupabaseClient,
  canalIds: string[],
): Promise<Record<string, UltimaMensagemCanal>> {
  const unique = [...new Set(canalIds.map((x) => String(x).trim()).filter(Boolean))]
  if (unique.length === 0) return {}

  const map: Record<string, UltimaMensagemCanal> = {}
  const BATCH = 24

  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const rows = await Promise.all(
      chunk.map(async (cid) => {
        const { data, error } = await supabase
          .from('mensagens_canal')
          .select('canal_id, texto, anexo_tipo, created_at')
          .eq('canal_id', cid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) {
          console.warn('buscarUltimasMensagensCanais:', cid, error.message)
          return null
        }
        return data
      }),
    )

    for (const row of rows) {
      if (!row) continue
      const cid = String(row.canal_id ?? '')
      if (!cid || map[cid]) continue
      map[cid] = {
        preview: resumoMensagem(
          row.texto != null ? String(row.texto) : null,
          row.anexo_tipo != null ? String(row.anexo_tipo) : null,
        ),
        created_at: String(row.created_at ?? ''),
      }
    }
  }

  return map
}

/** Atualiza preview da última mensagem após INSERT realtime (evita refetch da lista inteira). */
export function patchUltimaMensagemCanal(
  prev: Record<string, UltimaMensagemCanal>,
  canalId: string,
  row: { texto?: unknown; anexo_tipo?: unknown; created_at?: unknown },
): Record<string, UltimaMensagemCanal> {
  const created = row.created_at != null ? String(row.created_at) : ''
  if (!canalId || !created) return prev
  return {
    ...prev,
    [canalId]: {
      preview: resumoMensagem(row.texto != null ? String(row.texto) : null, row.anexo_tipo != null ? String(row.anexo_tipo) : null),
      created_at: created,
    },
  }
}

type CanalComUltimaMensagem = {
  id: string
  ultima_mensagem_em?: string | null
}

/** Timestamp efetivo da última atividade (coluna do canal + mapa de previews). */
export function timestampUltimaMensagemCanal(
  canal: CanalComUltimaMensagem,
  ultimas?: Record<string, UltimaMensagemCanal>,
): number {
  const fromCol = canal.ultima_mensagem_em ? new Date(canal.ultima_mensagem_em).getTime() : 0
  const fromMap = ultimas?.[canal.id]?.created_at ? new Date(ultimas[canal.id].created_at).getTime() : 0
  const t = Math.max(
    Number.isNaN(fromCol) ? 0 : fromCol,
    Number.isNaN(fromMap) ? 0 : fromMap,
  )
  return t
}

/**
 * Ordena canais por última mensagem recebida (mais recente no topo).
 * Canais sem mensagens ficam no final.
 */
export function ordenarCanaisPorUltimaMensagem<T extends CanalComUltimaMensagem>(
  lista: T[],
  ultimas?: Record<string, UltimaMensagemCanal>,
): T[] {
  return [...lista].sort((a, b) => {
    const ta = timestampUltimaMensagemCanal(a, ultimas)
    const tb = timestampUltimaMensagemCanal(b, ultimas)
    if (tb !== ta) return tb - ta
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * @param {string | null | undefined} ultimaMensagemEm
 * @param {string | null | undefined} vistoEm
 */
export function canalTemNaoLidas(ultimaMensagemEm: string | null | undefined, vistoEm: string | null | undefined): boolean {
  if (!ultimaMensagemEm) return false
  if (!vistoEm) return true
  const ultima = new Date(ultimaMensagemEm).getTime()
  const visto = new Date(vistoEm).getTime()
  if (Number.isNaN(ultima) || Number.isNaN(visto)) return false
  return ultima > visto
}
