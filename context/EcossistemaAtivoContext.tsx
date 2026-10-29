'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { buscarUsuarioCached } from '@/lib/usuarioSessionCache'
import {
  escolherBlocoInicial,
  podeEscolherEcossistemaHome,
  type EcossistemaBloco,
} from '@/lib/ecossistemas'
import { gravarEcossistemaAtivoId, lerEcossistemaAtivoId } from '@/lib/ecossistemaAtivoStorage'
import { marcarEcoSplash } from '@/lib/appSplashReady'

type EcossistemaAtivoValue = {
  listaHome: EcossistemaBloco[]
  ativo: EcossistemaBloco | null
  setAtivoId: (id: string) => void
  podeEscolher: boolean
  carregou: boolean
}

const Ctx = createContext<EcossistemaAtivoValue | null>(null)

export function EcossistemaAtivoProvider({ children }: { children: ReactNode }) {
  const [listaHome, setListaHome] = useState<EcossistemaBloco[]>([])
  const [ativo, setAtivo] = useState<EcossistemaBloco | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const [{ data: sessionData }, ecoRes] = await Promise.all([
          supabase.auth.getSession(),
          fetch('/api/ecossistemas'),
        ])
        const uid = sessionData.session?.user?.id
        let roleLida: string | null = null
        if (uid) {
          const { data } = await buscarUsuarioCached(supabase, uid, 'role')
          roleLida = data?.role != null ? String(data.role) : null
        }
        const json = (await ecoRes.json().catch(() => ({}))) as { ecossistemas?: EcossistemaBloco[] }
        const todos = Array.isArray(json.ecossistemas) ? json.ecossistemas : []
        if (cancel) return
        setRole(roleLida)
        const inicial = escolherBlocoInicial(todos, lerEcossistemaAtivoId())
        const home = todos.filter((e) => e.disponivel_home)
        setListaHome(home)
        setAtivo(inicial)
        if (inicial && podeEscolherEcossistemaHome(roleLida)) {
          gravarEcossistemaAtivoId(inicial.id)
        }
      } catch {
        if (!cancel) {
          setListaHome([])
          setAtivo(null)
        }
      } finally {
        if (!cancel) {
          setCarregou(true)
          marcarEcoSplash()
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const setAtivoId = useCallback(
    (id: string) => {
      const next = listaHome.find((e) => e.id === id)
      if (!next) return
      setAtivo(next)
      gravarEcossistemaAtivoId(next.id)
    },
    [listaHome],
  )

  const value = useMemo<EcossistemaAtivoValue>(
    () => ({
      listaHome,
      ativo,
      setAtivoId,
      podeEscolher: podeEscolherEcossistemaHome(role),
      carregou,
    }),
    [listaHome, ativo, setAtivoId, role, carregou],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEcossistemaAtivo(): EcossistemaAtivoValue {
  const ctx = useContext(Ctx)
  if (!ctx) {
    return {
      listaHome: [],
      ativo: null,
      setAtivoId: () => {},
      podeEscolher: false,
      carregou: false,
    }
  }
  return ctx
}
