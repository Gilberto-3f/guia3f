'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Ban, FileWarning, MessageSquareWarning, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MOTIVOS_DENUNCIA_CONTEUDO, enviarDenunciaConteudo } from '@/lib/denunciarConteudo'

const COR_LOGO = '#0097b2'

const ICONES_MOTIVO = {
  informacao_falsa: AlertTriangle,
  odio: Ban,
  ilicitio: FileWarning,
  outro: MessageSquareWarning,
}

/**
 * @param {{
 *   aberto: boolean
 *   onClose: () => void
 *   conteudoTipo: 'post' | 'comentario' | 'story' | 'avaliacao'
 *   conteudoId: string
 *   denunciadoUsuarioId: string
 *   onSucesso?: () => void
 * }} props
 */
export default function ModalDenunciarConteudo({
  aberto,
  onClose,
  conteudoTipo,
  conteudoId,
  denunciadoUsuarioId,
  onSucesso,
}) {
  const [motivoId, setMotivoId] = useState(/** @type {string | null} */ (null))
  const [detalheOutro, setDetalheOutro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) {
      setMotivoId(null)
      setDetalheOutro('')
      setErro('')
      setEnviando(false)
    }
  }, [aberto])

  if (!aberto) return null

  const modoOutro = motivoId === 'outro'

  const enviar = async () => {
    if (!motivoId) {
      setErro('Selecione um motivo para a denúncia.')
      return
    }
    if (motivoId === 'outro' && !detalheOutro.trim()) {
      setErro('Descreva o motivo da denúncia.')
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setErro('Inicie sessão para denunciar.')
        return
      }
      const res = await enviarDenunciaConteudo(supabase, {
        denuncianteId: session.user.id,
        denunciadoUsuarioId,
        conteudoTipo,
        conteudoId,
        motivoId,
        detalheOutro: detalheOutro.trim(),
      })
      if (!res.ok) {
        setErro(res.error)
        return
      }
      onSucesso?.()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar denúncia.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={() => !enviando && onClose()} />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl shadow-xl"
        style={{ backgroundColor: COR_LOGO }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-denunciar-titulo"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="modal-denunciar-titulo" className="text-lg font-bold text-white">
              Denunciar
            </h2>
            {!modoOutro ? (
              <p className="mt-1 text-sm text-white/90">Porque você está denunciando essa publicação?</p>
            ) : (
              <p className="mt-1 text-sm text-white/90">Descreva o motivo da denúncia (até 350 caracteres)</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="rounded-full p-1.5 text-white/90 hover:bg-white/15"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          {!modoOutro ? (
            <div className="space-y-2">
              {MOTIVOS_DENUNCIA_CONTEUDO.map((m) => {
                const Icon = ICONES_MOTIVO[m.id] ?? AlertTriangle
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMotivoId(m.id)}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-white transition',
                      motivoId === m.id ? 'bg-white/25 ring-2 ring-white/40' : 'bg-white/10 hover:bg-white/20',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                    {m.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={detalheOutro}
                onChange={(e) => setDetalheOutro(e.target.value.slice(0, 350))}
                rows={5}
                maxLength={350}
                placeholder="Descreva o motivo…"
                className="w-full resize-none rounded-xl border-0 bg-white/15 px-4 py-3 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <p className="text-right text-xs text-white/70">{detalheOutro.length}/350</p>
              <button
                type="button"
                onClick={() => setMotivoId(null)}
                className="text-sm font-medium text-white/90 underline hover:text-white"
              >
                Voltar às opções
              </button>
            </div>
          )}

          {erro ? <p className="mt-3 text-sm font-medium text-amber-200">{erro}</p> : null}
        </div>

        <div className="border-t border-white/20 px-5 py-4">
          {modoOutro || motivoId ? (
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando || !motivoId || (motivoId === 'outro' && !detalheOutro.trim())}
              className="w-full rounded-xl bg-white py-3 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
              style={{ color: COR_LOGO }}
            >
              {enviando ? 'Enviando…' : 'Denunciar'}
            </button>
          ) : (
            <p className="text-center text-xs text-white/70">Selecione um motivo acima</p>
          )}
        </div>
      </div>
    </div>
  )
}
