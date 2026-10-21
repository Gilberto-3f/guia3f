'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  adminNivelTemBlocoFixo,
  adminPodeTrocarBlocoCanais,
  lerEcossistemaIdAdmin,
} from '@/lib/adminEcossistema'
import { GUIA_CANAIS_BADGE_EVENT } from '@/lib/canais-badge-events'
import type { EcossistemaBloco } from '@/lib/ecossistemas'
import {
  ECOSSISTEMA_CANAIS_ADM_EVENT,
  gravarEcossistemaCanaisAdmId,
  lerEcossistemaCanaisAdmId,
} from '@/lib/ecossistemaCanaisAdmStorage'

export function useEcossistemaCanaisAdm() {
  const [lista, setLista] = useState<EcossistemaBloco[]>([])
  const [ativoId, setAtivoIdState] = useState<string | null>(null)
  const [podeTrocar, setPodeTrocar] = useState(false)
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const [{ data: sessionData }, ecoRes] = await Promise.all([
          supabase.auth.getSession(),
          fetch('/api/ecossistemas'),
        ])
        const json = (await ecoRes.json().catch(() => ({}))) as { ecossistemas?: EcossistemaBloco[] }
        const todos = Array.isArray(json.ecossistemas) ? json.ecossistemas : []
        const uid = sessionData.session?.user?.id
        let nivel = 0
        let cargo: string | null = null
        let fixo: string | null = null
        if (uid) {
          const { data } = await supabase
            .from('usuarios')
            .select('admin_level, admin_permissoes, ecossistema_id')
            .eq('id', uid)
            .maybeSingle()
          nivel = Number(data?.admin_level ?? 0)
          const perms = data?.admin_permissoes
          if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
            cargo = (perms as { cargo?: string }).cargo ?? null
          }
          fixo = lerEcossistemaIdAdmin(data)
        }
        const padrao = todos.find((e) => e.padrao) ?? todos[0] ?? null
        const trocar = adminPodeTrocarBlocoCanais(nivel, cargo)
        let id: string | null = padrao?.id ?? null
        if (adminNivelTemBlocoFixo(nivel)) {
          id = todos.find((e) => e.id === fixo)?.id ?? padrao?.id ?? null
        } else if (trocar) {
          const stored = lerEcossistemaCanaisAdmId()
          id = todos.find((e) => e.id === stored)?.id ?? padrao?.id ?? null
        }
        if (cancel) return
        setLista(todos)
        setPodeTrocar(trocar)
        setAtivoIdState(id)
      } catch {
        if (!cancel) {
          setLista([])
          setAtivoIdState(null)
          setPodeTrocar(false)
        }
      } finally {
        if (!cancel) setCarregou(true)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const setAtivoId = useCallback(
    (id: string) => {
      if (!podeTrocar) return
      if (!lista.some((e) => e.id === id)) return
      setAtivoIdState(id)
      gravarEcossistemaCanaisAdmId(id)
      window.dispatchEvent(new Event(GUIA_CANAIS_BADGE_EVENT))
    },
    [lista, podeTrocar],
  )

  useEffect(() => {
    const onExt = (e: Event) => {
      if (!podeTrocar) return
      const id = String((e as CustomEvent<{ id?: string }>).detail?.id ?? '').trim()
      if (id && lista.some((eco) => eco.id === id)) setAtivoIdState(id)
    }
    window.addEventListener(ECOSSISTEMA_CANAIS_ADM_EVENT, onExt)
    return () => window.removeEventListener(ECOSSISTEMA_CANAIS_ADM_EVENT, onExt)
  }, [lista, podeTrocar])

  const ativo = useMemo(() => lista.find((e) => e.id === ativoId) ?? null, [lista, ativoId])

  return { lista, ativo, setAtivoId, podeTrocar, carregou }
}
