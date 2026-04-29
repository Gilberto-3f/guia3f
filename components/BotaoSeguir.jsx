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
            .eq('empresa_id', id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('favoritos').insert({
            usuario_id: session.user.id,
            empresa_id: id,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível seguir agora.'
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  const wrapperClass =
    layout === 'inline'
      ? 'flex shrink-0 flex-col items-end gap-1'
      : 'flex flex-col items-end gap-1'

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || !podeInteragir}
        className={
          buttonClassName.trim()
            ? buttonClassName
            : [
                'flex min-w-[124px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                seguindo
                  ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
                  : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
              ].join(' ')
        }
      >
        {leadingIcon === 'heart' && !seguindo ? <Heart size={16} className="text-white" aria-hidden /> : null}
        <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
      </button>
      {erro ? <span className="max-w-[240px] text-right text-xs text-red-600">{erro}</span> : null}
    </div>
  )
}
