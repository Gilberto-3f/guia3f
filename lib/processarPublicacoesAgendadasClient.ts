/** Dispara processamento de publicações vencidas e recarrega feed/stories se houve publicação. */
export async function tentarProcessarPublicacoesAgendadas(): Promise<{
  ok: boolean
  processadas?: number
  erros?: number
} | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/publicacoes-agendadas/processar', { method: 'POST' })
    const data = (await res.json()) as { ok?: boolean; processadas?: number; erros?: number }
    if (!res.ok || !data?.ok) return { ok: false, processadas: 0, erros: data?.erros ?? 0 }
    const n = Number(data.processadas) || 0
    if (n > 0) {
      window.dispatchEvent(new Event('guia-feed-posts-reload'))
      window.dispatchEvent(new Event('guia-feed-rede-reload'))
      window.dispatchEvent(new Event('guia-stories-bar-reload'))
      window.dispatchEvent(new Event('guia-empresa-publicacoes-reload'))
    }
    return { ok: true, processadas: n, erros: Number(data.erros) || 0 }
  } catch {
    return null
  }
}
