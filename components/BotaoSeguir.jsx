'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

/**
 * @param {{
 *   empresaId: string,
 *   isFollowing?: boolean,
 *   onToggle?: () => void
 * }} props
 */
export default function BotaoSeguir({ empresaId, isFollowing: initialFollowing = false, onToggle }) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const [seguindo, setSeguindo] = useState(initialFollowing)

  useEffect(() => {
    setSeguindo(initialFollowing)
  }, [initialFollowing])
  const [loading, setLoading] = useState(false)

  const handleToggle = async (e) => {
    e.stopPropagation()
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
        setLoading(false)
        return
      }

      if (seguindo) {
        await supabase
          .from('favoritos')
          .delete()
          .eq('usuario_id', session.user.id)
          .eq('empresa_id', empresaId)
      } else {
        await supabase.from('favoritos').insert({
          usuario_id: session.user.id,
          empresa_id: empresaId,
        })
      }

      setSeguindo(!seguindo)
      onToggle?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || !podeInteragir}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        seguindo
          ? 'border-red-200 bg-red-50 text-red-500'
          : 'border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Heart size={16} className={seguindo ? 'fill-red-500' : ''} aria-hidden />
      <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
    </button>
  )
}
