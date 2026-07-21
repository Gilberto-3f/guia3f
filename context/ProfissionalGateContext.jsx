'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { diasAteRevisaoDocumentos, empresaRecursosLiberados, profissionalRecursosLiberados } from '@/lib/verificacao-documentos'
import { turistaRecursosLiberados } from '@/lib/turistaAcesso'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { gravarPerfilBarraCache, lerPerfilBarraCache } from '@/lib/perfilBarraCache'
import { buscarUsuarioCached } from '@/lib/usuarioSessionCache'

const ProfissionalGateContext = createContext(null)

/** @param {{ foto_perfil_url?: unknown, foto_url?: unknown } | null | undefined} row */
function pickFotoPerfilRow(row) {
  if (!row || typeof row !== 'object') return null
  const fp = row.foto_perfil_url != null && String(row.foto_perfil_url).trim() !== '' ? String(row.foto_perfil_url) : null
  if (fp) return fp
  const leg = row.foto_url != null && String(row.foto_url).trim() !== '' ? String(row.foto_url) : null
  return leg
}

/** Hidratação síncrona a partir do sessionStorage (retorno ao app). */
function estadoInicialGate() {
  if (typeof window === 'undefined') {
    return { loading: true, userRole: null, fotoPerfilBarra: null, empresaIdBarra: null }
  }
  const cached = lerPerfilBarraCache()
  if (!cached) {
    return { loading: true, userRole: null, fotoPerfilBarra: null, empresaIdBarra: null }
  }
  return {
    loading: false,
    userRole: cached.role,
    fotoPerfilBarra:
      cached.role === 'profissional'
        ? cached.fotoProfSocialUrl ?? cached.fotoUrl
        : cached.fotoUrl,
    empresaIdBarra: cached.empresaId,
  }
}

/** @param {string} uid */
async function carregarUsuarioGate(uid) {
  const full = await buscarUsuarioCached(
    supabase,
    uid,
    'status, role, documentacao_validada_adm, turista_pre_liberado_ate',
  )

  if (
    full.error &&
    (full.error.code === '42703' || String(full.error.message ?? '').includes('does not exist'))
  ) {
    const slim = await buscarUsuarioCached(supabase, uid, 'status, role')
    const u = slim.data && typeof slim.data === 'object' ? slim.data : null
    if (!u) return { data: null, error: slim.error }
    return {
      data: {
        ...u,
        documentacao_validada_adm: false,
        turista_pre_liberado_ate: null,
      },
      error: null,
    }
  }

  return { data: full.data, error: full.error }
}

export function ProfissionalGateProvider({ children }) {
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const gateInicial = useMemo(() => estadoInicialGate(), [])
  const [loading, setLoading] = useState(gateInicial.loading)
  const [usuarioStatus, setUsuarioStatus] = useState(/** @type {string | null} */ (null))
  const [userRole, setUserRole] = useState(/** @type {string | null} */ (gateInicial.userRole))
  const [profRow, setProfRow] = useState(null)
  const [empRow, setEmpRow] = useState(null)
  const [turistaGate, setTuristaGate] = useState(null)
  const [turistaDocsRow, setTuristaDocsRow] = useState(null)
  const [fotoPerfilBarra, setFotoPerfilBarra] = useState(/** @type {string | null} */ (gateInicial.fotoPerfilBarra))
  const [empresaIdBarra, setEmpresaIdBarra] = useState(/** @type {string | null} */ (gateInicial.empresaIdBarra))
  const gateCarregadoUmaVez = useRef(false)
  /** @type {React.MutableRefObject<Promise<void> | null>} */
  const inflightGateRef = useRef(null)
  const lastGateAtRef = useRef(0)

  const refreshGate = useCallback(async (opts = {}) => {
    const force = Boolean(opts && typeof opts === 'object' && 'force' in opts && opts.force)
    const now = Date.now()
    // Visibility/poll: no máximo 1 refresh completo a cada 45s (evita saturar Auth/REST no idle)
    if (!force && inflightGateRef.current) {
      await inflightGateRef.current
      return
    }
    if (!force && now - lastGateAtRef.current < 45_000 && gateCarregadoUmaVez.current) {
      return
    }

    const run = async () => {
    lastGateAtRef.current = Date.now()
    if (!gateCarregadoUmaVez.current && !lerPerfilBarraCache()) setLoading(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null

    if (uid) {
      const cached = lerPerfilBarraCache()
      if (cached?.userId === uid) {
        if (cached.role) setUserRole(cached.role)
        const fotoBarra =
          cached.role === 'profissional' ? cached.fotoProfSocialUrl ?? cached.fotoUrl : cached.fotoUrl
        if (fotoBarra) setFotoPerfilBarra(fotoBarra)
        if (cached.empresaId) setEmpresaIdBarra(cached.empresaId)
      }
    }

    if (!uid) {
      setUsuarioStatus(null)
      setUserRole(null)
      setProfRow(null)
      setEmpRow(null)
      setTuristaGate(null)
      setTuristaDocsRow(null)
      setFotoPerfilBarra(null)
      setEmpresaIdBarra(null)
      setLoading(false)
      return
    }

    const { data: u } = await carregarUsuarioGate(uid)
    const ur = u && typeof u === 'object' ? u : null
    setUsuarioStatus(ur && 'status' in ur && ur.status != null ? String(ur.status) : null)
    setUserRole(ur && 'role' in ur && ur.role != null ? String(ur.role) : null)

    const role = ur && 'role' in ur && ur.role != null ? String(ur.role) : null

    /** @type {string | null} */
    let fotoCache = null
    /** @type {string | null} */
    let empresaIdCache = null
    /** @type {string | null} */
    let empresaHospedagemIdCache = null
    /** @type {string | null} */
    let empresaFotoCache = null

    if (role === 'profissional') {
      const { data: p } = await supabase
        .from('profissionais')
        .select(
          'status, docs_verificado, documentos_enviados_em, documento_frente_url, proxima_revisao_docs_em, categorias, empresa_hospedagem_id, foto_perfil_url, foto_url',
        )
        .eq('usuario_id', uid)
        .maybeSingle()
      setProfRow(
        p && typeof p === 'object'
          ? {
              status: p.status != null ? String(p.status) : null,
              docs_verificado: Boolean(p.docs_verificado),
              proxima_revisao_docs_em: p.proxima_revisao_docs_em != null ? String(p.proxima_revisao_docs_em) : null,
              documentos_enviados_em:
                p.documentos_enviados_em != null ? String(p.documentos_enviados_em) : null,
              documento_frente_url:
                p.documento_frente_url != null ? String(p.documento_frente_url) : null,
              categorias: Array.isArray(p.categorias)
                ? p.categorias.filter((c) => typeof c === 'string').map(String)
                : [],
              empresa_hospedagem_id:
                p.empresa_hospedagem_id != null ? String(p.empresa_hospedagem_id) : null,
            }
          : null,
      )
      setEmpRow(null)
      setTuristaGate(null)
      setTuristaDocsRow(null)
      setEmpresaIdBarra(null)
      fotoCache = pickFotoPerfilRow(p)
      setFotoPerfilBarra(fotoCache)
      if (p?.empresa_hospedagem_id != null) {
        empresaHospedagemIdCache = String(p.empresa_hospedagem_id)
        const { data: empH } = await supabase
          .from('empresas')
          .select('foto_url')
          .eq('id', empresaHospedagemIdCache)
          .maybeSingle()
        empresaFotoCache =
          empH?.foto_url != null && String(empH.foto_url).trim() !== '' ? String(empH.foto_url) : null
      }
    } else if (role === 'empresa') {
      const { data: e } = await supabase
        .from('empresas')
        .select('id, status, docs_verificado, aprovado_em, verificado_em, foto_url')
        .eq('usuario_id', uid)
        .maybeSingle()
      setProfRow(null)
      setTuristaGate(null)
      setTuristaDocsRow(null)
      setEmpRow(
        e && typeof e === 'object'
          ? {
              status: e.status != null ? String(e.status) : null,
              docs_verificado: Boolean(e.docs_verificado),
              aprovado_em: e.aprovado_em != null ? String(e.aprovado_em) : null,
              verificado_em: e.verificado_em != null ? String(e.verificado_em) : null,
            }
          : null,
      )
      empresaIdCache = e?.id != null ? String(e.id) : null
      fotoCache = e?.foto_url != null && String(e.foto_url).trim() !== '' ? String(e.foto_url) : null
      setEmpresaIdBarra(empresaIdCache)
      setFotoPerfilBarra(fotoCache)
    } else if (role === 'turista') {
      setProfRow(null)
      setEmpRow(null)
      setTuristaGate(
        ur && typeof ur === 'object'
          ? {
              role: 'turista',
              status: ur.status != null ? String(ur.status) : null,
              documentacao_validada_adm: Boolean(ur.documentacao_validada_adm),
              turista_pre_liberado_ate:
                ur.turista_pre_liberado_ate != null ? String(ur.turista_pre_liberado_ate) : null,
            }
          : null,
      )
      const { data: t } = await supabase
        .from('turistas')
        .select('documento_frente_url, documento_verso_url, docs_verificado, foto_perfil_url, foto_url')
        .eq('usuario_id', uid)
        .maybeSingle()
      setTuristaDocsRow(
        t && typeof t === 'object'
          ? {
              documento_frente_url:
                t.documento_frente_url != null ? String(t.documento_frente_url) : null,
              documento_verso_url:
                t.documento_verso_url != null ? String(t.documento_verso_url) : null,
              docs_verificado: Boolean(t.docs_verificado),
            }
          : null,
      )
      setEmpresaIdBarra(null)
      fotoCache = pickFotoPerfilRow(t)
      setFotoPerfilBarra(fotoCache)
    } else {
      setProfRow(null)
      setEmpRow(null)
      setTuristaGate(null)
      setTuristaDocsRow(null)
      if (role === 'admin') {
        const [profRes, turRes] = await Promise.all([
          supabase.from('profissionais').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
          supabase.from('turistas').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
        ])
        fotoCache = pickFotoPerfilRow(profRes.data) ?? pickFotoPerfilRow(turRes.data)
        setFotoPerfilBarra(fotoCache)
      } else {
        setFotoPerfilBarra(null)
      }
      setEmpresaIdBarra(null)
    }

    gravarPerfilBarraCache({
      userId: uid,
      role,
      fotoUrl: fotoCache,
      fotoProfSocialUrl: role === 'profissional' ? fotoCache : null,
      empresaId: empresaIdCache,
      empresaHospedagemId: empresaHospedagemIdCache,
      empresaFotoUrl: empresaFotoCache,
    })
    gateCarregadoUmaVez.current = true
    setLoading(false)
    }

    inflightGateRef.current = run().finally(() => {
      inflightGateRef.current = null
    })
    await inflightGateRef.current
  }, [])

  useEffect(() => {
    void refreshGate({ force: true })
  }, [refreshGate])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED' ||
        event === 'TOKEN_REFRESHED'
      ) {
        void refreshGate({ force: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [refreshGate])

  useEffect(() => {
    const onRef = () => void refreshGate({ force: true })
    window.addEventListener('profissional-gate-refresh', onRef)
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('turista-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)
    return () => {
      window.removeEventListener('profissional-gate-refresh', onRef)
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('turista-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
    }
  }, [refreshGate])

  /** Atualiza gate quando ADM aprova cadastro (poll leve — perfis fora da publication Realtime). */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshGate()
    }
    document.addEventListener('visibilitychange', onVisible)
    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshGate()
    }, 180_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(pollId)
    }
  }, [refreshGate])

  const roleEfetivo = modoAtivo && perfilSimulado ? perfilSimulado.tipo : userRole

  const value = useMemo(() => {
    const liberadoProf =
      roleEfetivo !== 'profissional' ? true : profissionalRecursosLiberados(usuarioStatus, profRow)
    const liberadoEmp =
      roleEfetivo !== 'empresa' ? true : empresaRecursosLiberados(usuarioStatus, empRow)
    const liberadoTur =
      roleEfetivo !== 'turista' ? true : turistaRecursosLiberados(turistaGate)
    const dias =
      roleEfetivo === 'profissional' && profRow?.proxima_revisao_docs_em
        ? diasAteRevisaoDocumentos(profRow.proxima_revisao_docs_em)
        : null
    return {
      loading,
      usuarioStatus,
      userRole,
      roleEfetivo,
      profRow,
      empRow,
      recursosProfissionaisLiberados: liberadoProf,
      recursosEmpresaLiberados: liberadoEmp,
      recursosTuristaLiberados: liberadoTur,
      diasAteRevisaoDocs: dias,
      perfilEhProfissional: roleEfetivo === 'profissional',
      perfilEhEmpresa: roleEfetivo === 'empresa',
      perfilEhTurista: roleEfetivo === 'turista',
      turistaGate,
      turistaDocsRow,
      fotoPerfilBarra,
      empresaIdBarra,
      refreshGate,
    }
  }, [
    loading,
    usuarioStatus,
    userRole,
    roleEfetivo,
    profRow,
    empRow,
    turistaGate,
    turistaDocsRow,
    fotoPerfilBarra,
    empresaIdBarra,
    refreshGate,
  ])

  return <ProfissionalGateContext.Provider value={value}>{children}</ProfissionalGateContext.Provider>
}

export function useProfissionalGate() {
  const v = useContext(ProfissionalGateContext)
  if (v) return v
  return {
    loading: false,
    usuarioStatus: null,
    userRole: null,
    roleEfetivo: null,
    profRow: null,
    empRow: null,
    recursosProfissionaisLiberados: false,
    recursosEmpresaLiberados: false,
    recursosTuristaLiberados: false,
    diasAteRevisaoDocs: null,
    perfilEhProfissional: false,
    perfilEhEmpresa: false,
    perfilEhTurista: false,
    turistaGate: null,
    turistaDocsRow: null,
    fotoPerfilBarra: null,
    empresaIdBarra: null,
    refreshGate: async () => {},
  }
}
