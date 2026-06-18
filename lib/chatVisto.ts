/** Converte ISO de leitura em timestamp (ms). */
export function vistoEmParaMs(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

export type MensagemComRemetente = {
  id: string
  remetente_id: string
  created_at: string
}

/**
 * ID da última mensagem enviada pelo viewer que já foi vista pelo outro participante.
 * `vistoEmOutroMs` vem de ecossistema_conversa_leitura / financeiro_conversa_leitura do outro lado.
 */
export function idUltimaMensagemPropriaVistaPeloOutro(
  mensagens: MensagemComRemetente[],
  viewerUserId: string,
  vistoEmOutroMs: number,
): string | null {
  if (vistoEmOutroMs <= 0 || !viewerUserId) return null

  let ultimaId: string | null = null
  for (const m of mensagens) {
    if (String(m.remetente_id) !== viewerUserId) continue
    const created = vistoEmParaMs(m.created_at)
    if (created > 0 && vistoEmOutroMs >= created) {
      ultimaId = m.id
    }
  }
  return ultimaId
}
