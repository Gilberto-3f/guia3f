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
  categoriasIncluemGuia,
  gravarModoGuiaStorage,
  lerModoGuiaStorage,
  resolverVarianteUiGuia,
  type ModoGuia,
} from '@/lib/guiaDualMode'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

export type EmpresaAgenciaResumo = {
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

type GuiaModoValue = {
  ehGuia: boolean
  modo: ModoGuia
  modoEfetivo: ModoGuia
  setModo: (m: ModoGuia) => void
  empresaAgenciaId: string | null
  empresaAgencia: EmpresaAgenciaResumo | null
  empresaAgenciaLiberada: boolean
  varianteUi: string | null
  podeAlternarAgencia: boolean
  /** false enquanto categorias/empresa agência ainda carregam. */
  dadosProntos: boolean
  recarregar: () => Promise<void>
}

const GuiaModoContext = createContext<GuiaModoValue | null>(null)

export function GuiaModoProvider({ children }: { children: ReactNode }) {
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const { userRole, usuarioStatus, profRow, loading: gateLoading } = useProfissionalGate()
  const [modo, setModoState] = useState<ModoGuia>(() => lerModoGuiaStorage())
  const [empresaAgenciaId, setEmpresaAgenciaId] = useState<string | null>(null)
  const [empresaAgencia, setEmpresaAgencia] = useState<EmpresaAgenciaResumo | null>(null)
  const [profCategorias, setProfCategorias] = useState<string[]>([])
  const [guiaDadosProntos, setGuiaDadosProntos] = useState(false)

  const ehGuia =
    userRole === 'profissional' &&
    categoriasIncluemGuia(
      profCategorias.length
        ? profCategorias
        : (profRow as { categorias?: string[] } | null)?.categorias,
    )

  const recarregar = useCallback(async () => {
    if (userRole !== 'profissional') {
      setProfCategorias([])
      setEmpresaAgenciaId(null)
      setEmpresaAgencia(null)
      setGuiaDadosProntos(true)
      return
    }

    const prof = profRow as {
      categorias?: string[]
      empresa_agencia_id?: string | null
    } | null
    const cats = Array.isArray(prof?.categorias)
      ? prof.categorias.filter((c): c is string => typeof c === 'string')
      : []
    setProfCategorias(cats)

    const empId = prof?.empresa_agencia_id != null ? String(prof.empresa_agencia_id) : null
    setEmpresaAgenciaId(empId)

    if (!empId) {
      setEmpresaAgencia(null)
      setGuiaDadosProntos(true)
      return
    }

    const { data: emp } = await supabase
      .from('empresas')
      .select(
        'id, status, docs_verificado, aprovado_em, verificado_em, nome_fantasia, nome_usuario, somente_guia, foto_url, documentos_enviados_em, documento_comercial_url, comprovante_residencia_url',
      )
      .eq('id', empId)
      .maybeSingle()

    if (!emp?.id) {
      setEmpresaAgencia(null)
      setGuiaDadosProntos(true)
      return
    }

    setEmpresaAgencia({
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
    setGuiaDadosProntos(true)
  }, [userRole, profRow])

  useEffect(() => {
    if (gateLoading) return
    if (userRole !== 'profissional') {
      setProfCategorias([])
      setEmpresaAgenciaId(null)
      setEmpresaAgencia(null)
      setGuiaDadosProntos(true)
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
    window.addEventListener('guia-modo-refresh', onRef)
    return () => {
      window.removeEventListener('perfil-atualizado', onRef)
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('profissional-gate-refresh', onRef)
      window.removeEventListener('guia-modo-refresh', onRef)
    }
  }, [recarregar])

  useEffect(() => {
    if (!ehGuia) {
      setModoState('guia')
      return
    }
    if (!guiaDadosProntos) return
    let stored = lerModoGuiaStorage()
    if (
      stored === 'agencia' &&
      (!empresaAgenciaId || !empresaRecursosLiberados(usuarioStatus, empresaAgencia))
    ) {
      stored = 'guia'
      gravarModoGuiaStorage('guia')
    }
    setModoState(stored)
  }, [ehGuia, guiaDadosProntos, empresaAgenciaId, empresaAgencia, usuarioStatus])

  const setModo = useCallback(
    (next: ModoGuia) => {
      if (!ehGuia) return
      if (
        next === 'agencia' &&
        (!empresaAgenciaId || !empresaRecursosLiberados(usuarioStatus, empresaAgencia))
      ) {
        return
      }
      setModoState(next)
      gravarModoGuiaStorage(next)
      window.dispatchEvent(new Event('guia-modo-change'))
    },
    [ehGuia, empresaAgenciaId, empresaAgencia, usuarioStatus],
  )

  const empresaAgenciaLiberada = empresaRecursosLiberados(usuarioStatus, empresaAgencia)

  const modoEfetivo: ModoGuia =
    ehGuia && modo === 'agencia' && empresaAgenciaLiberada ? 'agencia' : 'guia'

  const varianteUi = resolverVarianteUiGuia({
    userRole,
    modoApresentacaoTipo: modoAtivo && perfilSimulado ? perfilSimulado.tipo : null,
    ehGuia,
    modoGuia: ehGuia ? modoEfetivo : null,
  })

  const podeAlternarAgencia = Boolean(ehGuia && empresaAgenciaId)

  const value = useMemo(
    () => ({
      ehGuia: Boolean(ehGuia),
      modo,
      modoEfetivo,
      setModo,
      empresaAgenciaId,
      empresaAgencia,
      empresaAgenciaLiberada,
      varianteUi,
      podeAlternarAgencia,
      dadosProntos: guiaDadosProntos,
      recarregar,
    }),
    [
      ehGuia,
      modo,
      modoEfetivo,
      setModo,
      empresaAgenciaId,
      empresaAgencia,
      empresaAgenciaLiberada,
      varianteUi,
      podeAlternarAgencia,
      guiaDadosProntos,
      recarregar,
    ],
  )

  return <GuiaModoContext.Provider value={value}>{children}</GuiaModoContext.Provider>
}

export function useGuiaModo(): GuiaModoValue {
  const ctx = useContext(GuiaModoContext)
  if (ctx) return ctx
  return {
    ehGuia: false,
    modo: 'guia',
    modoEfetivo: 'guia',
    setModo: () => {},
    empresaAgenciaId: null,
    empresaAgencia: null,
    empresaAgenciaLiberada: false,
    varianteUi: null,
    podeAlternarAgencia: false,
    dadosProntos: true,
    recarregar: async () => {},
  }
}
