const PREFIX = 'guia-agendamento-draft:'

export type StoryMetaAgendamento = {
  texto_sobreposto: {
    texto: string | null
    posicao_x: number
    posicao_y: number
    link_posicao_x: number
    link_posicao_y: number
    fundo_fit: string
    fundo_scale: number
    fundo_pan_x_pct: number
    fundo_pan_y_pct: number
    texto_scale: number
  }
  link?: string | null
  marcacoes?: unknown[]
}

export type AgendamentoDraftStory = {
  kind: 'story'
  conteudoUrl: string
  texto: string
  story_meta: StoryMetaAgendamento
  previewUrl: string
}

export type AgendamentoDraftFoto = {
  kind: 'foto'
  conteudoUrl: string
  texto: string
  previewUrl: string
}

export type AgendamentoDraft = AgendamentoDraftStory | AgendamentoDraftFoto

function chave(cardKey: string) {
  return `${PREFIX}${cardKey}`
}

export function salvarDraftAgendamento(cardKey: string, draft: AgendamentoDraft): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(chave(cardKey), JSON.stringify(draft))
  } catch {
    /* quota */
  }
}

export function lerDraftAgendamento(cardKey: string): AgendamentoDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(chave(cardKey))
    if (!raw) return null
    return JSON.parse(raw) as AgendamentoDraft
  } catch {
    return null
  }
}

export function removerDraftAgendamento(cardKey: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(chave(cardKey))
  } catch {
    /* noop */
  }
}

export function consumirDraftAgendamento(cardKey: string): AgendamentoDraft | null {
  const draft = lerDraftAgendamento(cardKey)
  if (draft) removerDraftAgendamento(cardKey)
  return draft
}

/** URL de retorno após editar story/foto no fluxo de agendamento. */
export function urlRetornoAgendamento(cardKey: string): string {
  const params = new URLSearchParams({ agendar: cardKey, secao: 'agendar', aba: 'programar' })
  return `/empresa/menu/feed-stories?${params.toString()}`
}

const CARD_PREFIX = 'guia-agendamento-card:'

export type CardAgendamentoSnapshot = {
  tipo: 'story' | 'foto' | 'texto'
  texto: string
  agendadoPara: string
}

export function salvarSnapshotCardAgendamento(cardKey: string, snapshot: CardAgendamentoSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${CARD_PREFIX}${cardKey}`, JSON.stringify(snapshot))
  } catch {
    /* noop */
  }
}

export function lerSnapshotCardAgendamento(cardKey: string): CardAgendamentoSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${CARD_PREFIX}${cardKey}`)
    if (!raw) return null
    return JSON.parse(raw) as CardAgendamentoSnapshot
  } catch {
    return null
  }
}

export function removerSnapshotCardAgendamento(cardKey: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(`${CARD_PREFIX}${cardKey}`)
  } catch {
    /* noop */
  }
}
