'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { carregarContagensMembrosPorCanais } from '@/lib/canalMembrosContagem'

/**
 * Contagem de membros impactados por canal (recarrega ao montar ou quando a lista muda).
 * @param {Array<{ id: string, nome?: string | null, tipo_publico?: string | null, categoria?: string | null, comunidade_prof?: string | null, empresa_id?: string | null, empresa_categoria?: string | null }>} canais
 */
export function useContagemMembrosCanais(canais) {
  const [membrosPorCanal, setMembrosPorCanal] = useState(/** @type {Record<string, number>} */ ({}))

  const idsChave = useMemo(
    () =>
      canais
        .map((c) => c.id)
        .filter((id) => id && !String(id).startsWith('__placeholder'))
        .sort()
        .join(','),
    [canais],
  )

  const recarregar = useCallback(async () => {
    const lista = canais.filter((c) => c.id && !String(c.id).startsWith('__placeholder'))
    if (lista.length === 0) {
      setMembrosPorCanal({})
      return
    }
    const map = await carregarContagensMembrosPorCanais(supabase, lista)
    setMembrosPorCanal(map)
  }, [canais])

  useEffect(() => {
    void recarregar()
  }, [recarregar, idsChave])

  return membrosPorCanal
}
