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
import { primeiraCidadeAtuacao, resolverEcoCanaisPorCidade } from '@/lib/ecoCanaisPorCidade'
import { gravarEcossistemaAtivoId, lerEcossistemaAtivoId } from '@/lib/ecossistemaAtivoStorage'
import { marcarEcoSplash } from '@/lib/appSplashReady'

async function blocoDoCadastro(
  uid: string,
  role: string | null,
  todos: EcossistemaBloco[],
): Promise<EcossistemaBloco | null> {
  if (role === 'empresa') {
    const { data: emp } = await supabase.from('empresas').select('cidade').eq('usuario_id', uid).maybeSingle()
    return resolverEcoCanaisPorCidade(emp?.cidade != null ? String(emp.cidade) : '', todos)
  }
  if (role === 'profissional') {
    const { data: prof } = await supabase
      .from('profissionais')
      .select('cidade_atuacao')
      .eq('usuario_id', uid)
      .maybeSingle()
    return resolverEcoCanaisPorCidade(primeiraCidadeAtuacao(prof?.cidade_atuacao), todos)
  }
  return null
}

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
    const ac = new AbortController()
    const abortTimer = window.setTimeout(() => ac.abort(), 10_000)

    const lerCacheLocal = (): EcossistemaBloco[] => {
      try {
        const raw = sessionStorage.getItem('guia_ecos_catalogo_v1')
        if (!raw) return []
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed) ? (parsed as EcossistemaBloco[]) : []
      } catch {
        return []
      }
    }

    const fetchCatalogo = async (signal?: AbortSignal): Promise<EcossistemaBloco[]> => {
      const ecoRes = await fetch('/api/ecossistemas', { signal, cache: 'no-store' }).catch(() => null)
      const json = (ecoRes ? await ecoRes.json().catch(() => ({})) : {}) as {
        ecossistemas?: EcossistemaBloco[]
      }
      return Array.isArray(json.ecossistemas) ? json.ecossistemas : []
    }

    ;(async () => {
      try {
        const todosCache = lerCacheLocal()
        // Sessão primeiro: o catálogo (service role) não disputa o Postgres
        // com o POST /token do refresh depois do idle.
        const { data: sessionData } = await supabase.auth.getSession()
        if (cancel) return
        const primeira = await fetchCatalogo(ac.signal)
        let todos = primeira.length > 0 ? primeira : todosCache
        if (todos.length === 0) {
          todos = await fetchCatalogo()
        }
        if (todos.length > 0) {
          try {
            sessionStorage.setItem('guia_ecos_catalogo_v1', JSON.stringify(todos))
          } catch {
            /* ignore */
          }
        }
        const uid = sessionData.session?.user?.id
        let roleLida: string | null = null
        if (uid) {
          const { data } = await buscarUsuarioCached(supabase, uid, 'role')
          roleLida = data?.role != null ? String(data.role) : null
        }
        if (cancel) return
        setRole(roleLida)
        const home = todos.filter((e) => e.disponivel_home !== false)
        setListaHome(home.length > 0 ? home : todos)

        let inicial: EcossistemaBloco | null = null
        if (uid && !podeEscolherEcossistemaHome(roleLida)) {
          inicial = await blocoDoCadastro(uid, roleLida, todos)
        } else {
          inicial = escolherBlocoInicial(todos, lerEcossistemaAtivoId())
          if (inicial) gravarEcossistemaAtivoId(inicial.id)
        }
        if (cancel) return
        setAtivo(inicial)
      } catch {
        if (!cancel) {
          setListaHome([])
          setAtivo(null)
        }
      } finally {
        window.clearTimeout(abortTimer)
        if (!cancel) {
          setCarregou(true)
          marcarEcoSplash()
        }
      }
    })()
    return () => {
      cancel = true
      window.clearTimeout(abortTimer)
      ac.abort()
    }
  }, [])

  const setAtivoId = useCallback(
    (id: string) => {
      if (!podeEscolherEcossistemaHome(role)) return
      const next = listaHome.find((e) => e.id === id)
      if (!next) return
      setAtivo(next)
      gravarEcossistemaAtivoId(next.id)
    },
    [listaHome, role],
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
