import { useCallback, useEffect, useMemo, useState } from 'react'

export type EmpresaPreviewDraft = Partial<{
  nome_fantasia: string
  nome_usuario: string
  foto_url: string | null
  descricao_longa: string | null
  categoria: string
  cidade: string
  endereco: string
  telefone: string | null
  whatsapp: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  preco_ticket_inteira: number | null
  preco_ticket_meia: number | null
  preco_diaria: number | null
}>

function safeParse(raw: string | null) {
  if (!raw) return null
  try {
    const j = JSON.parse(raw)
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    return j as Record<string, unknown>
  } catch {
    return null
  }
}

function storageKey(userId: string, empresaId: string) {
  return `guia3f_empresa_preview_draft:${userId}:${empresaId}`
}

export function useEmpresaPreviewDraft(opts: { userId: string | null; empresaId: string | null }) {
  const { userId, empresaId } = opts
  const [draft, setDraft] = useState<EmpresaPreviewDraft | null>(null)

  const key = useMemo(() => {
    if (!userId || !empresaId) return null
    return storageKey(userId, empresaId)
  }, [userId, empresaId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!key) {
      setDraft(null)
      return
    }
    const raw = localStorage.getItem(key)
    const parsed = safeParse(raw)
    setDraft((parsed ?? null) as EmpresaPreviewDraft | null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [key])

  const salvar = useCallback(
    (patch: EmpresaPreviewDraft) => {
      if (!key) return
      setDraft((prev) => {
        const next = { ...(prev ?? {}), ...(patch ?? {}) }
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [key]
  )

  const limpar = useCallback(() => {
    if (!key) return
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    setDraft(null)
  }, [key])

  return { draft, salvar, limpar }
}

