'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'guia3f_modo_apresentacao_v2'
const LEGACY_STORAGE_KEY = 'guia3f_modo_apresentacao'

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
function parseStoredPerfil(raw) {
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
 * Garante uma linha `empresas` de preview (somente_modo_apresentacao) do próprio ADM, por categoria/segmento.
 * Nunca reutiliza empresa ou usuario_id de terceiros.
 * @param {string} adminUserId
 * @param {string} segmentoDb ex.: gastronomia
 * @param {string} nomeExibicao
 * @returns {Promise<string | null>} id da empresa preview ou null
 */
async function ensureEmpresaPreviewAdm(adminUserId, segmentoDb, nomeExibicao) {
  const cat = String(segmentoDb || 'gastronomia').trim() || 'gastronomia'
  const nomeFantasia = `Preview · ${String(nomeExibicao || 'Empresa').trim()}`
  const nomeUsuarioBase = `pv_${adminUserId.replace(/-/g, '').slice(0, 12)}`

  const { data: existente, error: selErr } = await supabase
    .from('empresas')
    .select('id, nome_usuario')
    .eq('usuario_id', adminUserId)
    .eq('somente_modo_apresentacao', true)
    .maybeSingle()

  if (selErr) {
    console.error('[modo apresentação] ensureEmpresaPreviewAdm select:', selErr)
    return null
  }

  if (existente?.id) {
    const { error: upErr } = await supabase
      .from('empresas')
      .update({
        categoria: cat,
        nome_fantasia: nomeFantasia,
        somente_modo_apresentacao: true,
      })
      .eq('id', String(existente.id))
    if (upErr) {
      console.error('[modo apresentação] ensureEmpresaPreviewAdm update:', upErr)
      return null
    }
    return String(existente.id)
  }

  let nomeUsuario = nomeUsuarioBase.slice(0, 20)
  const payload = {
    usuario_id: adminUserId,
    nome_fantasia: nomeFantasia,
    nome_usuario: nomeUsuario,
    categoria: cat,
    cidade: '—',
    endereco: '—',
    descricao_curta: 'Demonstração (modo apresentação). Visível só para si.',
    somente_modo_apresentacao: true,
  }

  let ins = await supabase.from('empresas').insert(payload)
  if (ins.error?.message?.includes('nome_usuario') || ins.error?.code === '23505') {
    const suf = `${Date.now().toString(36).slice(-5)}`
    nomeUsuario = `pv${adminUserId.replace(/-/g, '').slice(0, 8)}${suf}`.slice(0, 20)
    ins = await supabase.from('empresas').insert({ ...payload, nome_usuario: nomeUsuario })
  }
  if (ins.error) {
    console.error('[modo apresentação] ensureEmpresaPreviewAdm insert:', ins.error)
    return null
  }
  const row = ins.data
  const id = row && typeof row === 'object' && 'id' in row ? String(/** @type {{ id: unknown }} */ (row).id) : null
  return id
}

/**
 * @returns {{ perfil: import('./ModoApresentacaoContext.jsx').PerfilSimulado | null, contextoUsuarioId: string | null, contextoEmpresaId: string | null } | null}
 */
function readPersistedState() {
  if (typeof window === 'undefined') return null
  try {
    let s = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY)
    if (!s) {
      const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
      if (!legacy) return null
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
      try {
        const j = JSON.parse(legacy)
        const perfil = parseStoredPerfil(j.perfil)
        if (!perfil) return null
        return {
          perfil,
          contextoUsuarioId: null,
          contextoEmpresaId: null,
        }
      } catch {
        return null
      }
    }
    if (s === 'turista' || s === 'profissional' || s === 'empresa') {
      return {
        perfil: {
          tipo: s,
          categoria: null,
          segmento: null,
          nome: s === 'turista' ? 'Turista' : s === 'empresa' ? 'Empresa' : 'Profissional',
          iconeKey: s === 'turista' ? 'turista' : s === 'empresa' ? 'empresa' : 'profissional',
        },
        contextoUsuarioId: null,
        contextoEmpresaId: null,
      }
    }
    const j = JSON.parse(s)
    const perfil = parseStoredPerfil(j.perfil)
    if (!perfil) return null
    const contextoEmpresaId = j.contextoEmpresaId != null ? String(j.contextoEmpresaId) : null
    return { perfil, contextoUsuarioId: null, contextoEmpresaId }
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
    try {
      sessionStorage.removeItem(LEGACY_STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

function clearPersisted() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
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
      setContextoUsuarioId(null)
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
      opcoes.iconeKey ?? (tipo === 'empresa' ? 'empresa' : tipo === 'profissional' ? 'profissional' : 'turista')
    const categoria = opcoes.categoria ?? null
    const segmento = opcoes.segmento ?? null
    const segmentoDb = opcoes.segmentoDb ?? null

    setLoadingAtivacao(true)
    let ctxUid = /** @type {string | null} */ (null)
    let ctxEmp = /** @type {string | null} */ (null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const myUid = session?.user?.id != null ? String(session.user.id) : null

      if (tipo === 'empresa' && segmentoDb && myUid) {
        const empId = await ensureEmpresaPreviewAdm(myUid, segmentoDb, nome)
        ctxEmp = empId
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
