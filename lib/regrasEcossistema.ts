export type RegraEcossistema = {
  id: string
  titulo: string
  texto: string
}

function novoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `regra-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Converte o campo `regras_ecossistema` (JSON ou texto legado) em lista de regras. */
export function parseRegrasEcossistema(raw: string | null | undefined): RegraEcossistema[] {
  const s = String(raw ?? '').trim()
  if (!s) return []

  try {
    const parsed = JSON.parse(s) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
        .map((item, i) => ({
          id: typeof item.id === 'string' && item.id ? item.id : novoId(),
          titulo: String(item.titulo ?? `Regra ${i + 1}`).trim() || `Regra ${i + 1}`,
          texto: String(item.texto ?? ''),
        }))
    }
  } catch {
    /* texto legado */
  }

  if (/^##\s*Regras do Ecossistema/i.test(s) && /Em construção/i.test(s)) {
    return []
  }

  return [{ id: novoId(), titulo: 'Regra 1', texto: s }]
}

export function serializeRegrasEcossistema(regras: RegraEcossistema[]): string {
  return JSON.stringify(
    regras.map((r) => ({
      id: r.id,
      titulo: r.titulo.trim() || 'Sem título',
      texto: r.texto,
    }))
  )
}

export function criarRegraEcossistemaVazia(ordem: number): RegraEcossistema {
  return {
    id: novoId(),
    titulo: `Regra ${ordem}`,
    texto: '',
  }
}
