'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from '../../hooks/usePermissao'
import { useDenunciasToolbar } from '../../context/DenunciasToolbarContext'
import { useAdminNav } from '../../context/AdminNavContext'
import type { DenunciaPerfil } from '../../types/admin.types'
import ListaDenuncias from './ListaDenuncias'
import { DenunciasAuditoria } from './DenunciasAuditoria'

function coerceSub(sub: string): DenunciaPerfil {
  if (sub === 'profissionais' || sub === 'empresas' || sub === 'auditoria') return sub
  return 'turistas'
}

export function DenunciasContainer({ sub }: { sub: string }) {
  const { selectSub } = useAdminNav()
  const { nivel, getComunidade } = usePermissao()
  const { setBadgesPendentes, setBadgesExclusao } = useDenunciasToolbar()

  const perfilAtivo = coerceSub(sub)
  const nivelNum = typeof nivel === 'string' ? parseInt(nivel, 10) : nivel
  const podeVerProfissionais = nivelNum === 1 || nivelNum === 2
  const podeVerEmpresas = nivelNum === 1 || nivelNum === 3

  useEffect(() => {
    if (perfilAtivo === 'profissionais' && !podeVerProfissionais) {
      selectSub('denuncias', 'turistas')
    }
    if (perfilAtivo === 'empresas' && !podeVerEmpresas) {
      selectSub('denuncias', 'turistas')
    }
  }, [perfilAtivo, podeVerEmpresas, podeVerProfissionais, selectSub])

  useEffect(() => {
    const run = async () => {
      const pendentes: Partial<Record<'turistas' | 'profissionais' | 'empresas' | 'auditoria', number>> = {}
      const exclusoes = { turistas: 0, profissionais: 0, empresas: 0 }

      const [{ count: t }, { count: p }, { count: e }, { count: arq }] = await Promise.all([
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'turista')
          .eq('status', 'pendente'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'profissional')
          .eq('status', 'pendente'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'empresa')
          .eq('status', 'pendente'),
        supabase.from('denuncias').select('*', { count: 'exact', head: true }).eq('status', 'arquivada'),
      ])

      pendentes.turistas = t ?? 0
      pendentes.profissionais = p ?? 0
      pendentes.empresas = e ?? 0
      pendentes.auditoria = arq ?? 0

      const [{ count: exT }, { count: exP }, { count: exE }] = await Promise.all([
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'turista')
          .eq('medida_tipo', 'excluir_cadastro')
          .neq('status', 'arquivada'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'profissional')
          .eq('medida_tipo', 'excluir_cadastro')
          .neq('status', 'arquivada'),
        supabase
          .from('denuncias')
          .select('*', { count: 'exact', head: true })
          .eq('denunciado_tipo', 'empresa')
          .eq('medida_tipo', 'excluir_cadastro')
          .neq('status', 'arquivada'),
      ])

      exclusoes.turistas = exT ?? 0
      exclusoes.profissionais = exP ?? 0
      exclusoes.empresas = exE ?? 0

      if (nivelNum === 2) {
        exclusoes.empresas = 0
        pendentes.empresas = 0
      }
      if (nivelNum === 3) {
        pendentes.turistas = 0
        pendentes.profissionais = 0
        exclusoes.turistas = 0
        exclusoes.profissionais = 0
      }
      if (nivelNum === 4) {
        pendentes.profissionais = 0
        pendentes.empresas = 0
        exclusoes.profissionais = 0
        exclusoes.empresas = 0
      }

      const comunidade = String(getComunidade() ?? '').toLowerCase()
      if (nivelNum === 2 && comunidade) {
        const { data: profs } = await supabase.from('profissionais').select('id, categorias')
        const allowed = new Set(
          (profs ?? [])
            .filter(
              (pRow: { categorias?: unknown[] }) =>
                Array.isArray(pRow.categorias) &&
                pRow.categorias.map((c) => String(c).toLowerCase()).includes(comunidade),
            )
            .map((pRow: { id: string }) => pRow.id),
        )
        const [{ data: dsPend }, { data: dsEx }] = await Promise.all([
          supabase
            .from('denuncias')
            .select('denunciado_id')
            .eq('denunciado_tipo', 'profissional')
            .eq('status', 'pendente'),
          supabase
            .from('denuncias')
            .select('denunciado_id')
            .eq('denunciado_tipo', 'profissional')
            .eq('medida_tipo', 'excluir_cadastro')
            .neq('status', 'arquivada'),
        ])
        pendentes.profissionais = (dsPend ?? []).filter((d: { denunciado_id: string }) =>
          allowed.has(d.denunciado_id),
        ).length
        exclusoes.profissionais = (dsEx ?? []).filter((d: { denunciado_id: string }) =>
          allowed.has(d.denunciado_id),
        ).length
      }

      setBadgesPendentes(pendentes)
      setBadgesExclusao(exclusoes)
    }
    void run()
  }, [getComunidade, nivelNum, setBadgesExclusao, setBadgesPendentes])

  if (perfilAtivo === 'auditoria') {
    return (
      <div className="space-y-4">
        <DenunciasAuditoria />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ListaDenuncias perfil={perfilAtivo} status="todas" busca="" />
    </div>
  )
}
