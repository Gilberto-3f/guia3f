'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'guia3f_modo_apresentacao'

/**
 * @typedef {{
 *   tipo: 'turista' | 'profissional' | 'empresa'
 *   categoria: string | null
 *   segmento: string | null
 *   nome: string
 *   iconeKey: string
 * }} PerfilSimulado
 */

/**
 * @typedef {{
 *   modoAtivo: boolean
 *   perfilSimulado: PerfilSimulado | null
 *   contextoUsuarioId: string | null
 *   contextoEmpresaId: string | null
 *   ativarModo: (tipo: PerfilSimulado['tipo'], opcoes?: { categoria?: string | null, segmento?: string | null, nome?: string, iconeKey?: string, categoriaDb?: string | null, segmentoDb?: string | null }) => Promise<void>
 *   desativarModo: () => void
 *   isSimulando: () => boolean
 *   podeInteragir: boolean
 *   avisoBloqueio: string | null
 *   limparAviso: () => void
 *   notificarSomenteLeitura: () => void
 *   loadingAtivacao: boolean
 * }} ModoApresentacaoValue
 */

/** @type {React.Context<ModoApresentacaoValue | null>} */
const ModoApresentacaoContext = createContext(null)

/**
 * @param {unknown} raw
 * @returns {import('./ModoApresentacaoContext.jsx').PerfilSimulado | null}
 */
function parseStored(raw) {
  if (raw == null || typeof raw !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (raw)
  const tipo = o.tipo
  if (tipo !== 'turista' && tipo !== 'profissional' && tipo !== 'empresa') return null
  const legacyIcone = o.icone != null ? String(o.icone) : null
  let iconeKey = o.iconeKey != null ? String(o.iconeKey) : ''
  if (!iconeKey && legacyIcone) {
    iconeKey = tipo === 'empresa' ? 'empresa' : tipo === 'profissional' ? 'profissional' : 'turista'
  }
  if (!iconeKey) iconeKey = tipo === 'empresa' ? 'empresa' : tipo === 'profissional' ? 'profissional' : 'turista'

  return {
    tipo,
    categoria: o.categoria != null ? String(o.categoria) : null,
    segmento: o.segmento != null ? String(o.segmento) : null,
    nome: o.nome != null ? String(o.nome) : 'Perfil',
    iconeKey,
  }
}

/**
 * @returns {{ perfil: import('./ModoApresentacaoContext.jsx').PerfilSimulado | null, contextoUsuarioId: string | null, contextoEmpresaId: string | null } | null}
 */
function readPersistedState() {
  if (typeof window === 'undefined') return null
  try {
    const s = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
    if (!s) return null
    const legacy = /** @type {string} */ (s)
    if (legacy === 'turista' || legacy === 'profissional' || legacy === 'empresa') {
      return {
        perfil: {
          tipo: legacy,
          categoria: null,
          segmento: null,
          nome: legacy === 'turista' ? 'Turista' : legacy === 'empresa' ? 'Empresa' : 'Profissional',
          iconeKey: legacy === 'turista' ? 'turista' : legacy === 'empresa' ? 'empresa' : 'profissional',
        },
        contextoUsuarioId: null,
        contextoEmpresaId: null,
      }
    }
    const j = JSON.parse(s)
    const perfil = parseStored(j.perfil)
    if (!perfil) return null
    const contextoUsuarioId = j.contextoUsuarioId != null ? String(j.contextoUsuarioId) : null
    const contextoEmpresaId = j.contextoEmpresaId != null ? String(j.contextoEmpresaId) : null
    return { perfil, contextoUsuarioId, contextoEmpresaId }
  } catch {
    return null
  }
}

function persistState(perfil, contextoUsuarioId, contextoEmpresaId) {
  try {
    const payload = JSON.stringify({
      perfil,
      contextoUsuarioId,
      contextoEmpresaId,
    })
    sessionStorage.setItem(STORAGE_KEY, payload)
    localStorage.setItem(STORAGE_KEY, payload)
  } catch {
    /* ignore */
  }
}

function clearPersisted() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ children: React.ReactNode }} props
 */
export function ModoApresentacaoProvider({ children }) {
  const [modoAtivo, setModoAtivo] = useState(false)
  /** @type {[import('./ModoApresentacaoContext.jsx').PerfilSimulado | null, React.Dispatch<React.SetStateAction<import('./ModoApresentacaoContext.jsx').PerfilSimulado | null>>]} */
  const [perfilSimulado, setPerfilSimulado] = useState(/** @type {import('./ModoApresentacaoContext.jsx').PerfilSimulado | null} */ (null))
  const [contextoUsuarioId, setContextoUsuarioId] = useState(/** @type {string | null} */ (null))
  const [contextoEmpresaId, setContextoEmpresaId] = useState(/** @type {string | null} */ (null))
  const [loadingAtivacao, setLoadingAtivacao] = useState(false)
  const [avisoBloqueio, setAvisoBloqueio] = useState(/** @type {string | null} */ (null))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const p = readPersistedState()
    if (p?.perfil) {
      setModoAtivo(true)
      setPerfilSimulado(p.perfil)
      setContextoUsuarioId(p.contextoUsuarioId)
      setContextoEmpresaId(p.contextoEmpresaId)
    }
    setHydrated(true)
  }, [])

  const limparAviso = useCallback(() => setAvisoBloqueio(null), [])

  const notificarSomenteLeitura = useCallback(() => {
    setAvisoBloqueio('Modo apresentação: apenas visualização.')
    window.setTimeout(() => setAvisoBloqueio(null), 3200)
  }, [])

  const desativarModo = useCallback(() => {
    setModoAtivo(false)
    setPerfilSimulado(null)
    setContextoUsuarioId(null)
    setContextoEmpresaId(null)
    clearPersisted()
  }, [])

  /**
   * @param {import('./ModoApresentacaoContext.jsx').PerfilSimulado['tipo']} tipo
   * @param {{ categoria?: string | null, segmento?: string | null, nome?: string, iconeKey?: string, categoriaDb?: string | null, segmentoDb?: string | null }} [opcoes]
   */
  const ativarModo = useCallback(async (tipo, opcoes = {}) => {
    const nome = opcoes.nome ?? 'Perfil'
    const iconeKey =
      opcoes.iconeKey ??
      (tipo === 'empresa' ? 'empresa' : tipo === 'profissional' ? 'profissional' : 'turista')
    const categoria = opcoes.categoria ?? null
    const segmento = opcoes.segmento ?? null
    const categoriaDb = opcoes.categoriaDb ?? null
    const segmentoDb = opcoes.segmentoDb ?? null

    setLoadingAtivacao(true)
    let ctxUid = /** @type {string | null} */ (null)
    let ctxEmp = /** @type {string | null} */ (null)

    try {
      if (tipo === 'profissional' && categoriaDb) {
        const { data, error } = await supabase
          .from('profissionais')
          .select('usuario_id')
          .contains('categorias', [categoriaDb])
          .limit(1)
          .maybeSingle()
        if (!error && data?.usuario_id != null) ctxUid = String(data.usuario_id)
      } else if (tipo === 'empresa' && segmentoDb) {
        const { data, error } = await supabase
          .from('empresas')
          .select('id, usuario_id')
          .eq('categoria', segmentoDb)
          .limit(1)
          .maybeSingle()
        if (!error && data) {
          if (data.id != null) ctxEmp = String(data.id)
          if (data.usuario_id != null) ctxUid = String(data.usuario_id)
        }
      }

      const perfil = /** @type {import('./ModoApresentacaoContext.jsx').PerfilSimulado} */ ({
        tipo,
        categoria,
        segmento,
        nome,
        iconeKey,
      })

      setPerfilSimulado(perfil)
      setContextoUsuarioId(ctxUid)
      setContextoEmpresaId(ctxEmp)
      setModoAtivo(true)
      persistState(perfil, ctxUid, ctxEmp)
    } finally {
      setLoadingAtivacao(false)
    }
  }, [])

  const isSimulando = useCallback(() => modoAtivo, [modoAtivo])

  const podeInteragir = !modoAtivo

  const value = useMemo(
    () => ({
      modoAtivo: hydrated ? modoAtivo : false,
      perfilSimulado: hydrated ? perfilSimulado : null,
      contextoUsuarioId: hydrated ? contextoUsuarioId : null,
      contextoEmpresaId: hydrated ? contextoEmpresaId : null,
      ativarModo,
      desativarModo,
      isSimulando,
      podeInteragir: hydrated ? podeInteragir : true,
      avisoBloqueio,
      limparAviso,
      notificarSomenteLeitura,
      loadingAtivacao,
    }),
    [
      hydrated,
      modoAtivo,
      perfilSimulado,
      contextoUsuarioId,
      contextoEmpresaId,
      ativarModo,
      desativarModo,
      isSimulando,
      podeInteragir,
      avisoBloqueio,
      limparAviso,
      notificarSomenteLeitura,
      loadingAtivacao,
    ]
  )

  return <ModoApresentacaoContext.Provider value={value}>{children}</ModoApresentacaoContext.Provider>
}

/**
 * @returns {ModoApresentacaoValue}
 */
export function useModoApresentacao() {
  const ctx = useContext(ModoApresentacaoContext)
  if (ctx) return ctx
  return {
    modoAtivo: false,
    perfilSimulado: null,
    contextoUsuarioId: null,
    contextoEmpresaId: null,
    ativarModo: async () => {},
    desativarModo: () => {},
    isSimulando: () => false,
    podeInteragir: true,
    avisoBloqueio: null,
    limparAviso: () => {},
    notificarSomenteLeitura: () => {},
    loadingAtivacao: false,
  }
}
