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
import {
  categoriasIncluemVan,
  gravarModoVanStorage,
  lerModoVanStorage,
  resolverVarianteUiVan,
  type ModoVan,
} from '@/lib/vanDualMode'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

export type EmpresaAgenciaVanResumo = {
  id: string
  status: string | null
  docs_verificado: boolean
  aprovado_em: string | null
  verificado_em: string | null
  nome_fantasia: string | null
  nome_usuario: string | null
  foto_url: string | null
  documentos_enviados_em: string | null
  documento_comercial_url: string | null
  comprovante_residencia_url: string | null
}

type VanModoValue = {
  ehVan: boolean
  modo: ModoVan
  modoEfetivo: ModoVan
  setModo: (m: ModoVan) => void
  empresaAgenciaVanId: string | null
  empresaAgenciaVan: EmpresaAgenciaVanResumo | null
  empresaAgenciaVanLiberada: boolean
  varianteUi: string | null
  podeAlternarAgencia: boolean
  /** false enquanto categorias/empresa agência ainda carregam. */
  dadosProntos: boolean
  recarregar: () => Promise<void>
}

const VanModoContext = createContext<VanModoValue | null>(null)

export function VanModoProvider({ children }: { children: ReactNode }) {
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const { userRole, usuarioStatus, profRow, loading: gateLoading } = useProfissionalGate()
  const [modo, setModoState] = useState<ModoVan>(() => lerModoVanStorage())
  const [empresaAgenciaVanId, setEmpresaAgenciaVanId] = useState<string | null>(null)
  const [empresaAgenciaVan, setEmpresaAgenciaVan] = useState<EmpresaAgenciaVanResumo | null>(null)
  const [profCategorias, setProfCategorias] = useState<string[]>([])
  const [vanDadosProntos, setVanDadosProntos] = useState(false)

  const ehVan =
    userRole === 'profissional' &&
    categoriasIncluemVan(
      profCategorias.length
        ? profCategorias
        : (profRow as { categorias?: string[] } | null)?.categorias,
    )

  const recarregar = useCallback(async () => {
    if (userRole !== 'profissional') {
      setProfCategorias([])
      setEmpresaAgenciaVanId(null)
      setEmpresaAgenciaVan(null)
      setVanDadosProntos(true)
      return
    }

    const prof = profRow as {
      categorias?: string[]
      empresa_agencia_van_id?: string | null
    } | null
    const cats = Array.isArray(prof?.categorias)
      ? prof.categorias.filter((c): c is string => typeof c === 'string')
      : []
    setProfCategorias(cats)

    const empId = prof?.empresa_agencia_van_id != null ? String(prof.empresa_agencia_van_id) : null
    setEmpresaAgenciaVanId(empId)

    if (!empId) {
      setEmpresaAgenciaVan(null)
      setVanDadosProntos(true)
      return
    }

    const { data: emp } = await supabase
      .from('empresas')
      .select(
        'id, status, docs_verificado, aprovado_em, verificado_em, nome_fantasia, nome_usuario, somente_van, foto_url, documentos_enviados_em, documento_comercial_url, comprovante_residencia_url',
      )
      .eq('id', empId)
      .maybeSingle()

    if (!emp?.id) {
      setEmpresaAgenciaVan(null)
      setVanDadosProntos(true)
      return
    }

    setEmpresaAgenciaVan({
      id: String(emp.id),
      status: emp.status != null ? String(emp.status) : null,
      docs_verificado: Boolean(emp.docs_verificado),
      aprovado_em: emp.aprovado_em != null ? String(emp.aprovado_em) : null,
      verificado_em: emp.verificado_em != null ? String(emp.verificado_em) : null,
      nome_fantasia: emp.nome_fantasia != null ? String(emp.nome_fantasia) : null,
      nome_usuario: emp.nome_usuario != null ? String(emp.nome_usuario) : null,
      foto_url:
        emp.foto_url != null && String(emp.foto_url).trim() !== ''
          ? String(emp.foto_url)
          : null,
      documentos_enviados_em:
        emp.documentos_enviados_em != null ? String(emp.documentos_enviados_em) : null,
      documento_comercial_url:
        emp.documento_comercial_url != null ? String(emp.documento_comercial_url) : null,
      comprovante_residencia_url:
        emp.comprovante_residencia_url != null ? String(emp.comprovante_residencia_url) : null,
    })
    setVanDadosProntos(true)
  }, [userRole, profRow])

  useEffect(() => {
    if (gateLoading) return
    if (userRole !== 'profissional') {
      setProfCategorias([])
      setEmpresaAgenciaVanId(null)
      setEmpresaAgenciaVan(null)
      setVanDadosProntos(true)
      return
    }
    if (!profRow) return
    void recarregar()
  }, [gateLoading, userRole, profRow, recarregar])

  useEffect(() => {
    const onRef = () => void recarregar()
    window.addEventListener('perfil-atualizado', onRef)
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('profissional-gate-refresh', onRef)
    window.addEventListener('van-modo-refresh', onRef)
    return () => {
      window.removeEventListener('perfil-atualizado', onRef)
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('profissional-gate-refresh', onRef)
      window.removeEventListener('van-modo-refresh', onRef)
    }
  }, [recarregar])

  useEffect(() => {
    if (!ehVan) {
      setModoState('van')
      return
    }
    if (!vanDadosProntos) return
    let stored = lerModoVanStorage()
    if (
      stored === 'agencia' &&
      (!empresaAgenciaVanId || !empresaRecursosLiberados(usuarioStatus, empresaAgenciaVan))
    ) {
      stored = 'van'
      gravarModoVanStorage('van')
    }
    setModoState(stored)
  }, [ehVan, vanDadosProntos, empresaAgenciaVanId, empresaAgenciaVan, usuarioStatus])

  const setModo = useCallback(
    (next: ModoVan) => {
      if (!ehVan) return
      if (
        next === 'agencia' &&
        (!empresaAgenciaVanId || !empresaRecursosLiberados(usuarioStatus, empresaAgenciaVan))
      ) {
        return
      }
      setModoState(next)
      gravarModoVanStorage(next)
      window.dispatchEvent(new Event('van-modo-change'))
    },
    [ehVan, empresaAgenciaVanId, empresaAgenciaVan, usuarioStatus],
  )

  const empresaAgenciaVanLiberada = empresaRecursosLiberados(usuarioStatus, empresaAgenciaVan)

  const modoEfetivo: ModoVan =
    ehVan && modo === 'agencia' && empresaAgenciaVanLiberada ? 'agencia' : 'van'

  const varianteUi = resolverVarianteUiVan({
    userRole,
    modoApresentacaoTipo: modoAtivo && perfilSimulado ? perfilSimulado.tipo : null,
    ehVan,
    modoVan: ehVan ? modoEfetivo : null,
  })

  const podeAlternarAgencia = Boolean(ehVan && empresaAgenciaVanId)

  const value = useMemo(
    () => ({
      ehVan: Boolean(ehVan),
      modo,
      modoEfetivo,
      setModo,
      empresaAgenciaVanId,
      empresaAgenciaVan,
      empresaAgenciaVanLiberada,
      varianteUi,
      podeAlternarAgencia,
      dadosProntos: vanDadosProntos,
      recarregar,
    }),
    [
      ehVan,
      modo,
      modoEfetivo,
      setModo,
      empresaAgenciaVanId,
      empresaAgenciaVan,
      empresaAgenciaVanLiberada,
      varianteUi,
      podeAlternarAgencia,
      vanDadosProntos,
      recarregar,
    ],
  )

  return <VanModoContext.Provider value={value}>{children}</VanModoContext.Provider>
}

export function useVanModo(): VanModoValue {
  const ctx = useContext(VanModoContext)
  if (ctx) return ctx
  return {
    ehVan: false,
    modo: 'van',
    modoEfetivo: 'van',
    setModo: () => {},
    empresaAgenciaVanId: null,
    empresaAgenciaVan: null,
    empresaAgenciaVanLiberada: false,
    varianteUi: null,
    podeAlternarAgencia: false,
    dadosProntos: true,
    recarregar: async () => {},
  }
}
