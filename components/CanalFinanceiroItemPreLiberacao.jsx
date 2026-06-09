'use client'

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { supabase } from '@/lib/supabase'
import { pickFotoTurista } from '@/lib/turistaPreLiberacao'
import {
  TEXTO_PRE_LIBERACAO_CONFIRME,
  textoPreLiberacaoIntro,
} from '@/lib/turistaPreLiberacaoTexto'

const AVATAR_QUADRADO = 'h-full w-full object-cover'

/**
 * @param {{
 *   item: { id: string; titulo: string; mensagem: string | null; created_at: string; metadata?: Record<string, unknown> }
 *   onRespondido: () => void
 * }} props
 */
export default function CanalFinanceiroItemPreLiberacao({ item, onRespondido }) {
  const [loading, setLoading] = useState(false)
  const [respondidoLocal, setRespondidoLocal] = useState('')
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const solicitacaoId = String(meta.solicitacao_id ?? '').trim()
  const respondido = respondidoLocal || String(meta.respondido ?? '').trim()
  const pendente = !respondido

  const turistaUsername = String(meta.turista_username ?? '').trim() || 'turista'
  const turistaNome = String(meta.turista_nome ?? '').trim() || 'Turista'
  const turistaUsuarioId = String(meta.turista_usuario_id ?? '').trim()
  const fotoMetadata =
    meta.turista_foto_url != null && String(meta.turista_foto_url).trim() !== ''
      ? String(meta.turista_foto_url)
      : null
  const [turistaFotoUrl, setTuristaFotoUrl] = useState(/** @type {string | null} */ (fotoMetadata))

  useEffect(() => {
    if (!turistaUsuarioId) {
      setTuristaFotoUrl(fotoMetadata)
      return
    }

    let cancelled = false

    const carregarFoto = async () => {
      const { data } = await supabase
        .from('turistas')
        .select('foto_perfil_url, foto_url')
        .eq('usuario_id', turistaUsuarioId)
        .maybeSingle()

      if (cancelled) return
      setTuristaFotoUrl(pickFotoTurista(data) ?? fotoMetadata)
    }

    void carregarFoto()

    const onVisivel = () => {
      if (document.visibilityState === 'visible') void carregarFoto()
    }
    document.addEventListener('visibilitychange', onVisivel)

    const ch = supabase
      .channel(`pre-lib-turista-foto-${turistaUsuarioId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'turistas',
          filter: `usuario_id=eq.${turistaUsuarioId}`,
        },
        () => {
          void carregarFoto()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisivel)
      void supabase.removeChannel(ch)
    }
  }, [turistaUsuarioId, fotoMetadata])

  const textoIntro = textoPreLiberacaoIntro(turistaUsername)

  const responder = async (acao) => {
    if (!solicitacaoId || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/profissional/pre-liberacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ solicitacao_id: solicitacaoId, acao }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? 'Não foi possível responder.')
        return
      }
      setRespondidoLocal(acao === 'aprovar' ? 'aprovada' : 'recusada')
      notificarBadgeCanais()
      window.dispatchEvent(new Event('turista-gate-refresh'))
      onRespondido()
    } catch {
      window.alert('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-l-4 border-[#00D443] bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00D443]/10 text-[#00D443]">
          <KeyRound size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{item.titulo}</h3>
          {pendente ? (
            <span className="mt-1 inline-block rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">
              Aguardando sua resposta
            </span>
          ) : null}

          <p className="mt-2 text-sm text-gray-600">{textoIntro}</p>

          <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-200">
              <AvatarImage src={turistaFotoUrl} alt="" fill className={AVATAR_QUADRADO} sizes="44px" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">{turistaNome}</p>
              <p className="truncate text-xs text-gray-500">@{turistaUsername}</p>
            </div>
          </div>

          {pendente ? (
            <p className="mt-3 text-sm text-gray-600">{TEXTO_PRE_LIBERACAO_CONFIRME}</p>
          ) : null}

          <p className="mt-2 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>

          {pendente ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void responder('aprovar')}
                className="rounded-lg bg-[#00D443] px-3 py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                Liberar 24h
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void responder('recusar')}
                className="rounded-lg bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          ) : respondido === 'aprovada' ? (
            <div className="mt-3 rounded-lg border border-[#00D443]/30 bg-[#00D443]/5 px-3 py-2.5 text-sm text-gray-700">
              <p className="font-semibold text-[#00A835]">Conta liberada provisoriamente por 24h</p>
              <p className="mt-1 text-gray-600">
                Você será avisado nesta aba sobre os benefícios (comissões) gerados por essa pré-liberação.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-gray-700">
              <p className="font-semibold text-red-700">Pré-liberação recusada</p>
              <p className="mt-1 text-gray-600">
                Você informou que não atendeu ou não conhece este turista. O pedido permanece registrado neste
                histórico.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
