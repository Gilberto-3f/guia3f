'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { diasAteRevisaoDocumentos, profissionalRecursosLiberados } from '@/lib/verificacao-documentos'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

const ProfissionalGateContext = createContext(null)

export function ProfissionalGateProvider({ children }) {
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const [loading, setLoading] = useState(true)
  const [usuarioStatus, setUsuarioStatus] = useState(/** @type {string | null} */ (null))
  const [userRole, setUserRole] = useState(/** @type {string | null} */ (null))
  const [profRow, setProfRow] = useState(null)

  const refreshGate = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    if (!uid) {
      setUsuarioStatus(null)
      setUserRole(null)
      setProfRow(null)
      setLoading(false)
      return
    }

    const { data: u } = await supabase.from('usuarios').select('status, role').eq('id', uid).maybeSingle()
    const ur = u && typeof u === 'object' ? u : null
    setUsuarioStatus(ur && 'status' in ur && ur.status != null ? String(ur.status) : null)
    setUserRole(ur && 'role' in ur && ur.role != null ? String(ur.role) : null)

    const role = ur && 'role' in ur && ur.role != null ? String(ur.role) : null
    if (role === 'profissional') {
      const { data: p } = await supabase
        .from('profissionais')
        .select('status, docs_verificado, documentos_enviados_em, proxima_revisao_docs_em')
        .eq('usuario_id', uid)
        .maybeSingle()
      setProfRow(
        p && typeof p === 'object'
          ? {
              status: p.status != null ? String(p.status) : null,
              docs_verificado: Boolean(p.docs_verificado),
              proxima_revisao_docs_em: p.proxima_revisao_docs_em != null ? String(p.proxima_revisao_docs_em) : null,
              documentos_enviados_em: p.documentos_enviados_em != null ? String(p.documentos_enviados_em) : null,
            }
          : null
      )
    } else {
      setProfRow(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshGate()
  }, [refreshGate])

  useEffect(() => {
    const onRef = () => void refreshGate()
    window.addEventListener('profissional-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)
    return () => {
      window.removeEventListener('profissional-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
    }
  }, [refreshGate])

  const roleEfetivo = modoAtivo && perfilSimulado ? perfilSimulado.tipo : userRole

  const value = useMemo(() => {
    const liberado =
      roleEfetivo !== 'profissional' ? true : profissionalRecursosLiberados(usuarioStatus, profRow)
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
      recursosProfissionaisLiberados: liberado,
      diasAteRevisaoDocs: dias,
      perfilEhProfissional: roleEfetivo === 'profissional',
      refreshGate,
    }
  }, [loading, usuarioStatus, userRole, roleEfetivo, profRow, refreshGate])

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
    recursosProfissionaisLiberados: true,
    diasAteRevisaoDocs: null,
    perfilEhProfissional: false,
    refreshGate: async () => {},
  }
}
