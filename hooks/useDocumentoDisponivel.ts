'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  documentoIdentidadeValido,
  DOCUMENTO_IDENTIDADE_MIN_LEN,
  normalizarDocumentoIdentidade,
} from '@/lib/documentoIdentidade'

export type DocumentoStatus = 'idle' | 'checking' | 'available' | 'unavailable'

const MSG = {
  rulesHint: `Informe pelo menos ${DOCUMENTO_IDENTIDADE_MIN_LEN} caracteres do número do documento.`,
  checking: 'Verificando documento...',
  available: 'Documento disponível para cadastro.',
  unavailable: 'Este documento já está vinculado a outra conta.',
  validateError: 'Não foi possível validar o documento. Tente novamente.',
} as const

export function useDocumentoDisponivel(
  documento: string,
  usuarioId: string | null | undefined
) {
  const [status, setStatus] = useState<DocumentoStatus>('idle')
  const [feedback, setFeedback] = useState('')

  const documentoLimpo = useMemo(() => documento.trim(), [documento])
  const documentoNorm = useMemo(
    () => normalizarDocumentoIdentidade(documentoLimpo),
    [documentoLimpo]
  )

  useEffect(() => {
    if (!documentoLimpo) {
      setStatus('idle')
      setFeedback('')
      return
    }

    if (!documentoIdentidadeValido(documentoLimpo)) {
      setStatus('unavailable')
      setFeedback(MSG.rulesHint)
      return
    }

    let ativo = true
    setStatus('checking')
    setFeedback(MSG.checking)

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ documento: documentoLimpo })
        if (usuarioId) params.set('usuarioId', usuarioId)

        const res = await fetch(`/api/cadastro/documento-disponivel?${params.toString()}`)
        const json = (await res.json().catch(() => ({}))) as {
          available?: boolean
          reason?: string
        }

        if (!ativo) return

        if (!res.ok || json.reason === 'error') {
          setStatus('unavailable')
          setFeedback(MSG.validateError)
          return
        }

        if (json.available) {
          setStatus('available')
          setFeedback(MSG.available)
        } else {
          setStatus('unavailable')
          setFeedback(MSG.unavailable)
        }
      } catch {
        if (!ativo) return
        setStatus('unavailable')
        setFeedback(MSG.validateError)
      }
    }, 400)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [documentoLimpo, documentoNorm, usuarioId])

  return { documentoLimpo, documentoNorm, status, feedback }
}
