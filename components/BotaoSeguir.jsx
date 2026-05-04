'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

/**
 * @param {{
 *   empresaId?: string,
 *   alvoId?: string,
 *   alvoTipo?: 'empresa' | 'usuario',
 *   seguidoTipo?: string | null,
 *   isFollowing?: boolean,
 *   onToggle?: (seguindo: boolean) => void
 *   layout?: 'default' | 'inline'
 *   buttonClassName?: string
 *   leadingIcon?: 'heart' | 'none'
 *   showInlineError?: boolean
 *   size?: 'default' | 'compact'
 * }} props
 */
export default function BotaoSeguir({
  empresaId,
  alvoId,
  alvoTipo,
  seguidoTipo = null,
  isFollowing: initialFollowing = false,
  onToggle,
  layout = 'default',
  buttonClassName = '',
  leadingIcon = 'heart',
  showInlineError = true,
  size = 'default',
}) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const [seguindo, setSeguindo] = useState(initialFollowing)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    setSeguindo(initialFollowing)
  }, [initialFollowing])
  const [loading, setLoading] = useState(false)

  const handleToggle = async (e) => {
    e.stopPropagation()
    setErro(null)
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setErro('Entre na sua conta para seguir.')
        setLoading(false)
        return
      }

      const tipo = alvoTipo || (empresaId ? 'empresa' : 'usuario')
      const id = tipo === 'empresa' ? String(empresaId || alvoId || '') : String(alvoId || '')
      if (!id) {
        setErro('Ação indisponível.')
        return
      }

      if (tipo === 'empresa') {
        if (seguindo) {
          const { error } = await supabase
            .from('favoritos')
            .delete()
            .eq('usuario_id', session.user.id)
            .eq('alvo_id', id)
            .eq('alvo_tipo', 'empresa')
          if (error) throw error
        } else {
          const { error } = await supabase.from('favoritos').insert({
            usuario_id: session.user.id,
            alvo_id: id,
            alvo_tipo: 'empresa',
          })
          if (error) throw error
        }
      } else {
        if (id === session.user.id) return
        if (seguindo) {
          const { error } = await supabase.from('redecontatos').delete().eq('seguidor_id', session.user.id).eq('seguido_id', id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('redecontatos')
            .insert({ seguidor_id: session.user.id, seguido_id: id, seguido_tipo: seguidoTipo || 'user' })
          if (error) throw error
        }
      }

      const novo = !seguindo
      setSeguindo(novo)
      onToggle?.(novo)
      window.dispatchEvent(new Event('perfil-atualizado'))
      if (tipo === 'empresa') {
        window.dispatchEvent(new Event('guia-feed-rede-reload'))
      }
    } catch (err) {
      let msg = 'Não foi possível concluir a ação. Tente de novo.'
      if (err instanceof Error) {
        const raw = err.message
        const lower = raw.toLowerCase()
        if (lower.includes('duplicate') || lower.includes('unique')) {
          msg = 'Você já segue este perfil.'
        } else if (lower.includes('violates') || lower.includes('permission') || lower.includes('policy')) {
          msg = 'Sem permissão para esta ação.'
        } else if (raw.trim()) {
          msg = raw
        }
      }
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  const wrapperClass =
    layout === 'inline'
      ? 'flex shrink-0 flex-col items-end gap-1'
      : 'flex flex-col items-end gap-1'

  const defaultBtn =
    size === 'compact'
      ? [
          'flex min-w-[72px] max-w-[100px] items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1 text-[11px] font-semibold transition-colors',
          seguindo
            ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
            : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
        ].join(' ')
      : [
          'flex min-w-[84px] items-center justify-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors',
          seguindo
            ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
            : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
        ].join(' ')

  const iconSize = size === 'compact' ? 12 : 14

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || !podeInteragir}
        title={!showInlineError && erro ? erro : undefined}
        aria-label={seguindo ? 'Deixar de seguir' : 'Seguir'}
        className={buttonClassName.trim() ? buttonClassName : defaultBtn}
      >
        {leadingIcon === 'heart' && !seguindo ? (
          <Heart size={iconSize} className="text-white" aria-hidden />
        ) : null}
        <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
      </button>
      {showInlineError && erro ? (
        <span className="max-w-[240px] text-right text-xs text-red-600">{erro}</span>
      ) : null}
      {!showInlineError && erro ? (
        <span className="sr-only" role="status">
          {erro}
        </span>
      ) : null}
    </div>
  )
}
