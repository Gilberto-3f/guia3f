'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { contarSeguidoresEmpresa } from '@/lib/favoritosEmpresa'
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
    try {
      const count = await contarSeguidoresEmpresa(supabase, empresaId)
      setTotalExibido(count)
    } catch {
      /* mantém total anterior */
    }
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
