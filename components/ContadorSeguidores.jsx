'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PopupSeguidores from '@/components/PopupSeguidores'

/**
 * @param {{ empresaId: string, total: number }} props
 */
export default function ContadorSeguidores({ empresaId, total }) {
  const [popupAberto, setPopupAberto] = useState(false)
  const [totalExibido, setTotalExibido] = useState(total)

  useEffect(() => {
    setTotalExibido(total)
  }, [total])

  const atualizarTotalDoServidor = useCallback(async () => {
    if (!empresaId) return
    const { count, error } = await supabase
      .from('favoritos')
      .select('id', { count: 'exact', head: true })
      .eq('alvo_id', empresaId)
      .eq('alvo_tipo', 'empresa')
    if (error) return
    setTotalExibido(typeof count === 'number' && !Number.isNaN(count) ? count : 0)
  }, [empresaId])

  useEffect(() => {
    const onPerfil = () => {
      void atualizarTotalDoServidor()
    }
    window.addEventListener('perfil-atualizado', onPerfil)
    return () => window.removeEventListener('perfil-atualizado', onPerfil)
  }, [atualizarTotalDoServidor])

  return (
    <>
      <button
        type="button"
        onClick={() => setPopupAberto(true)}
        className="flex items-center gap-1 text-gray-500 transition-colors hover:text-[#0097b2]"
      >
        <Users size={16} aria-hidden />
        <span className="text-sm">{totalExibido}</span>
        <span className="text-xs">seguidores</span>
      </button>

      <PopupSeguidores
        isOpen={popupAberto}
        onClose={() => setPopupAberto(false)}
        empresaId={empresaId}
      />
    </>
  )
}
