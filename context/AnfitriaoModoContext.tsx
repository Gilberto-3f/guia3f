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
  categoriasIncluemAnfitriao,
  gravarModoAnfitriaoStorage,
  lerModoAnfitriaoStorage,
  resolverVarianteUi,
  type ModoAnfitriao,
} from '@/lib/anfitriaoDualMode'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

export type EmpresaHospedagemResumo = {
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

type AnfitriaoModoValue = {
  ehAnfitriao: boolean
  /** Modo persistido (localStorage). */
  modo: ModoAnfitriao
  /** Modo efetivo para UI (respeita liberação da hospedagem). */
  modoEfetivo: ModoAnfitriao
  setModo: (m: ModoAnfitriao) => void
  empresaHospedagemId: string | null
  empresaHospedagem: EmpresaHospedagemResumo | null
  empresaHospedagemLiberada: boolean
  varianteUi: string | null
  podeAlternarHospedagem: boolean
  recarregar: () => Promise<void>
}

const AnfitriaoModoContext = createContext<AnfitriaoModoValue | null>(null)

export function AnfitriaoModoProvider({ children }: { children: ReactNode }) {
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const { userRole, usuarioStatus, profRow, loading: gateLoading } = useProfissionalGate()
  const [modo, setModoState] = useState<ModoAnfitriao>('anfitriao')
  const [empresaHospedagemId, setEmpresaHospedagemId] = useState<string | null>(null)
  const [empresaHospedagem, setEmpresaHospedagem] = useState<EmpresaHospedagemResumo | null>(null)
  const [profCategorias, setProfCategorias] = useState<string[]>([])
  const [anfitriaoDadosProntos, setAnfitriaoDadosProntos] = useState(false)

  const ehAnfitriao =
    userRole === 'profissional' &&
    categoriasIncluemAnfitriao(profCategorias.length ? profCategorias : (profRow as { categorias?: string[] } | null)?.categorias)

  const recarregar = useCallback(async () => {
    if (userRole !== 'profissional') {
      setProfCategorias([])
      setEmpresaHospedagemId(null)
      setEmpresaHospedagem(null)
      setAnfitriaoDadosProntos(true)
      return
    }

    const prof = profRow as { categorias?: string[]; empresa_hospedagem_id?: string | null } | null
    const cats = Array.isArray(prof?.categorias)
      ? prof.categorias.filter((c): c is string => typeof c === 'string')
      : []
    setProfCategorias(cats)

    const empId = prof?.empresa_hospedagem_id != null ? String(prof.empresa_hospedagem_id) : null
    setEmpresaHospedagemId(empId)

    if (!empId) {
      setEmpresaHospedagem(null)
      setAnfitriaoDadosProntos(true)
      return
    }

    const { data: emp } = await supabase
      .from('empresas')
      .select(
        'id, status, docs_verificado, aprovado_em, verificado_em, nome_fantasia, nome_usuario, somente_anfitriao, foto_url, documentos_enviados_em, documento_comercial_url, comprovante_residencia_url',
      )
      .eq('id', empId)
      .maybeSingle()

    if (!emp?.id) {
      setEmpresaHospedagem(null)
      setAnfitriaoDadosProntos(true)
      return
    }

    setEmpresaHospedagem({
      id: String(emp.id),
      status: emp.status != null ? String(emp.status) : null,
      docs_verificado: Boolean(emp.docs_verificado),
      aprovado_em: emp.aprovado_em != null ? String(emp.aprovado_em) : null,
      verificado_em: emp.verificado_em != null ? String(emp.verificado_em) : null,
      nome_fantasia: emp.nome_fantasia != null ? String(emp.nome_fantasia) : null,
      nome_usuario: emp.nome_usuario != null ? String(emp.nome_usuario) : null,
      foto_url: emp.foto_url != null && String(emp.foto_url).trim() !== '' ? String(emp.foto_url) : null,
      documentos_enviados_em:
        emp.documentos_enviados_em != null ? String(emp.documentos_enviados_em) : null,
      documento_comercial_url:
        emp.documento_comercial_url != null ? String(emp.documento_comercial_url) : null,
      comprovante_residencia_url:
        emp.comprovante_residencia_url != null ? String(emp.comprovante_residencia_url) : null,
    })
    setAnfitriaoDadosProntos(true)
  }, [userRole, profRow])

  useEffect(() => {
    if (gateLoading) return
    if (userRole !== 'profissional') {
      setProfCategorias([])
      setEmpresaHospedagemId(null)
      setEmpresaHospedagem(null)
      setAnfitriaoDadosProntos(true)
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
    window.addEventListener('anfitriao-modo-refresh', onRef)
    return () => {
      window.removeEventListener('perfil-atualizado', onRef)
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('profissional-gate-refresh', onRef)
      window.removeEventListener('anfitriao-modo-refresh', onRef)
    }
  }, [recarregar])

  useEffect(() => {
    if (!ehAnfitriao) {
      setModoState('anfitriao')
      return
    }
    if (!anfitriaoDadosProntos) return
    let stored = lerModoAnfitriaoStorage()
    if (stored === 'hospedagem' && (!empresaHospedagemId || !empresaRecursosLiberados(usuarioStatus, empresaHospedagem))) {
      stored = 'anfitriao'
      gravarModoAnfitriaoStorage('anfitriao')
    }
    setModoState(stored)
  }, [ehAnfitriao, anfitriaoDadosProntos, empresaHospedagemId, empresaHospedagem, usuarioStatus])

  const setModo = useCallback(
    (next: ModoAnfitriao) => {
      if (!ehAnfitriao) return
      if (next === 'hospedagem' && (!empresaHospedagemId || !empresaRecursosLiberados(usuarioStatus, empresaHospedagem))) return
      setModoState(next)
      gravarModoAnfitriaoStorage(next)
      window.dispatchEvent(new Event('anfitriao-modo-change'))
    },
    [ehAnfitriao, empresaHospedagemId, empresaHospedagem, usuarioStatus],
  )

  const empresaHospedagemLiberada = empresaRecursosLiberados(usuarioStatus, empresaHospedagem)

  const modoEfetivo: ModoAnfitriao =
    ehAnfitriao && modo === 'hospedagem' && empresaHospedagemLiberada ? 'hospedagem' : 'anfitriao'

  const varianteUi = resolverVarianteUi({
    userRole,
    modoApresentacaoTipo: modoAtivo && perfilSimulado ? perfilSimulado.tipo : null,
    ehAnfitriao,
    modoAnfitriao: ehAnfitriao ? modoEfetivo : null,
  })

  const podeAlternarHospedagem = Boolean(ehAnfitriao && empresaHospedagemId)

  const value = useMemo(
    () => ({
      ehAnfitriao: Boolean(ehAnfitriao),
      modo,
      modoEfetivo,
      setModo,
      empresaHospedagemId,
      empresaHospedagem,
      empresaHospedagemLiberada,
      varianteUi,
      podeAlternarHospedagem,
      recarregar,
    }),
    [
      ehAnfitriao,
      modo,
      modoEfetivo,
      setModo,
      empresaHospedagemId,
      empresaHospedagem,
      empresaHospedagemLiberada,
      varianteUi,
      podeAlternarHospedagem,
      recarregar,
    ],
  )

  return <AnfitriaoModoContext.Provider value={value}>{children}</AnfitriaoModoContext.Provider>
}

export function useAnfitriaoModo(): AnfitriaoModoValue {
  const ctx = useContext(AnfitriaoModoContext)
  if (ctx) return ctx
  return {
    ehAnfitriao: false,
    modo: 'anfitriao',
    modoEfetivo: 'anfitriao',
    setModo: () => {},
    empresaHospedagemId: null,
    empresaHospedagem: null,
    empresaHospedagemLiberada: false,
    varianteUi: null,
    podeAlternarHospedagem: false,
    recarregar: async () => {},
  }
}
