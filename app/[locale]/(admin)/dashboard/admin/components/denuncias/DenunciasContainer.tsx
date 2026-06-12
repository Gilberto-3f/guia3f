'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from '../../hooks/usePermissao'
import { useDenunciasToolbar } from '../../context/DenunciasToolbarContext'
import { useAdminNav } from '../../context/AdminNavContext'
import type { DenunciaPerfil } from '../../types/admin.types'
import StatusDenuncia from './StatusDenuncia'
import ListaDenuncias from './ListaDenuncias'

function coerceSub(sub: string): DenunciaPerfil {
  if (sub === 'profissionais' || sub === 'empresas' || sub === 'stories') return sub
  return 'turistas'
}

export function DenunciasContainer({ sub }: { sub: string }) {
  const { selectSub } = useAdminNav()
  const { nivel, getComunidade } = usePermissao()
  const { setBadges } = useDenunciasToolbar()

  const perfilAtivo = coerceSub(sub)

  const nivelNum = typeof nivel === 'string' ? parseInt(nivel, 10) : nivel

  const podeVerProfissionais = nivelNum === 1 || nivelNum === 2
  const podeVerEmpresas = nivelNum === 1 || nivelNum === 3
  const podeVerStories = nivelNum === 1 || nivelNum === 2

  const [statusAtivo, setStatusAtivo] = useState<'pendente' | 'em_investigacao' | 'encerrada' | 'arquivada' | 'todas'>('pendente')
  const [periodo, setPeriodo] = useState<'hoje' | '7d' | '30d'>('7d')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  useEffect(() => {
    if (perfilAtivo === 'profissionais' && !podeVerProfissionais) {
      selectSub('denuncias', 'turistas')
    }
    if (perfilAtivo === 'empresas' && !podeVerEmpresas) {
      selectSub('denuncias', 'turistas')
    }
    if (perfilAtivo === 'stories' && !podeVerStories) {
      selectSub('denuncias', 'turistas')
    }
  }, [perfilAtivo, podeVerEmpresas, podeVerProfissionais, podeVerStories, selectSub])

  useEffect(() => {
    const run = async () => {
      const base: Partial<Record<'turistas' | 'profissionais' | 'empresas' | 'stories', number>> = {}
      const [{ count: t }, { count: p }, { count: e }, { count: st }] = await Promise.all([
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'turista'),
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'profissional'),
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'empresa'),
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'story'),
      ])
      base.turistas = t ?? 0
      base.profissionais = p ?? 0
      base.empresas = e ?? 0
      base.stories = nivelNum === 1 || nivelNum === 2 ? st ?? 0 : 0

      if (nivelNum === 2) {
        base.empresas = 0
      }
      if (nivelNum === 3) {
        base.turistas = 0
        base.profissionais = 0
        base.stories = 0
      }
      if (nivelNum === 4) {
        base.profissionais = 0
        base.empresas = 0
        base.stories = 0
      }

      const comunidade = String(getComunidade() ?? '').toLowerCase()
      if (nivelNum === 2 && comunidade) {
        const { data: profs } = await supabase.from('profissionais').select('id, categorias')
        const allowed = new Set(
          (profs ?? [])
            .filter((pRow: { categorias?: unknown[] }) => Array.isArray(pRow.categorias) && pRow.categorias.map((c) => String(c).toLowerCase()).includes(comunidade))
            .map((pRow: { id: string }) => pRow.id)
        )
        const { data: ds } = await supabase.from('denuncias').select('denunciado_id').eq('denunciado_tipo', 'profissional')
        base.profissionais = (ds ?? []).filter((d: { denunciado_id: string }) => allowed.has(d.denunciado_id)).length
      }
      setBadges(base)
    }
    void run()
  }, [getComunidade, nivelNum, setBadges])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <StatusDenuncia
          statusAtivo={statusAtivo}
          onStatusChange={setStatusAtivo}
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          busca={busca}
          onBuscaChange={setBusca}
          categoria={categoria}
          onCategoriaChange={setCategoria}
          perfil={perfilAtivo}
        />
      </div>
      <ListaDenuncias perfil={perfilAtivo} status={statusAtivo} periodo={periodo} busca={busca} categoria={categoria} />
    </div>
  )
}
