'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { categoriasIncluemAnfitriao, lerModoAnfitriaoStorage } from '@/lib/anfitriaoDualMode'
import { categoriasIncluemGuia, lerModoGuiaStorage } from '@/lib/guiaDualMode'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'

export type EmpresaMenuGate = 'loading' | 'forbidden' | 'pending' | 'ok'

/**
 * Menu empresa, publicidade, etc.: só após ADM aprovar cadastro (usuario ativo + empresa aprovada + docs).
 * Profissional anfitrião em modo hospedagem usa a empresa `somente_anfitriao` vinculada.
 */
export function useEmpresaMenuGate(): EmpresaMenuGate {
  const router = useRouter()
  const [gate, setGate] = useState<EmpresaMenuGate>('loading')

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) {
        if (ativo) setGate('forbidden')
        return
      }
      const { data: userData } = await supabase.from('usuarios').select('role, status').eq('id', uid).maybeSingle()
      const role = userData?.role != null ? String(userData.role) : null
      const st =
        userData && typeof userData === 'object' && 'status' in userData && userData.status != null
          ? String(userData.status)
          : null

      let empData: Record<string, unknown> | null = null

      if (role === 'empresa') {
        const { data } = await supabase
          .from('empresas')
          .select('status, docs_verificado, aprovado_em, verificado_em, somente_anfitriao')
          .eq('usuario_id', uid)
          .maybeSingle()
        empData = data && typeof data === 'object' ? data : null
      } else if (role === 'profissional') {
        const { data: prof } = await supabase
          .from('profissionais')
          .select('categorias, empresa_hospedagem_id, empresa_agencia_id')
          .eq('usuario_id', uid)
          .maybeSingle()
        const cats = Array.isArray(prof?.categorias)
          ? prof.categorias.filter((c): c is string => typeof c === 'string')
          : []
        const empHospId = prof?.empresa_hospedagem_id != null ? String(prof.empresa_hospedagem_id) : null
        const empAgenciaId = prof?.empresa_agencia_id != null ? String(prof.empresa_agencia_id) : null

        let empId: string | null = null
        if (categoriasIncluemAnfitriao(cats) && empHospId && lerModoAnfitriaoStorage() === 'hospedagem') {
          empId = empHospId
        } else if (categoriasIncluemGuia(cats) && empAgenciaId && lerModoGuiaStorage() === 'agencia') {
          empId = empAgenciaId
        }

        if (!empId) {
          if (ativo) setGate('forbidden')
          return
        }
        const { data } = await supabase
          .from('empresas')
          .select('status, docs_verificado, aprovado_em, verificado_em, somente_anfitriao, somente_guia')
          .eq('id', empId)
          .maybeSingle()
        empData = data && typeof data === 'object' ? data : null
      } else {
        if (ativo) setGate('forbidden')
        return
      }

      const empRow = empData
        ? {
            status: empData.status != null ? String(empData.status) : null,
            docs_verificado: Boolean(empData.docs_verificado),
            aprovado_em: empData.aprovado_em != null ? String(empData.aprovado_em) : null,
            verificado_em: empData.verificado_em != null ? String(empData.verificado_em) : null,
          }
        : null
      if (!empresaRecursosLiberados(st, empRow)) {
        if (ativo) setGate('pending')
        return
      }
      if (ativo) setGate('ok')
    }
    void boot()

    const onRef = () => void boot()
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)
    window.addEventListener('anfitriao-modo-change', onRef)

    return () => {
      ativo = false
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
      window.removeEventListener('anfitriao-modo-change', onRef)
    }
  }, [])

  useEffect(() => {
    if (gate === 'forbidden') router.push('/login')
  }, [gate, router])

  return gate
}
