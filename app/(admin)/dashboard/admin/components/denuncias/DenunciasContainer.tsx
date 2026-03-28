'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from '../../hooks/usePermissao'
import SubabasDenuncias from './SubabasDenuncias'
import StatusDenuncia from './StatusDenuncia'
import ListaDenuncias from './ListaDenuncias'

function coerceSub(sub: string): 'turistas' | 'profissionais' | 'empresas' {
  if (sub === 'profissionais' || sub === 'empresas') return sub
  return 'turistas'
}

export function DenunciasContainer({ sub }: { sub: string }) {
  const { nivel, getComunidade } = usePermissao()
  const [perfilAtivo, setPerfilAtivo] = useState<'turistas' | 'profissionais' | 'empresas'>(coerceSub(sub))
  const [statusAtivo, setStatusAtivo] = useState<'pendente' | 'em_investigacao' | 'encerrada' | 'arquivada' | 'todas'>('pendente')
  const [periodo, setPeriodo] = useState<'hoje' | '7d' | '30d'>('7d')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [badges, setBadges] = useState<Partial<Record<'turistas' | 'profissionais' | 'empresas', number>>>({})

  const podeVerProfissionais = nivel === 1 || nivel === 2
  const podeVerEmpresas = nivel === 1 || nivel === 3

  useEffect(() => {
    const next = coerceSub(sub)
    setPerfilAtivo(next)
  }, [sub])

  useEffect(() => {
    if (perfilAtivo === 'profissionais' && !podeVerProfissionais) setPerfilAtivo('turistas')
    if (perfilAtivo === 'empresas' && !podeVerEmpresas) setPerfilAtivo('turistas')
  }, [perfilAtivo, podeVerEmpresas, podeVerProfissionais])

  useEffect(() => {
    const run = async () => {
      const base: Partial<Record<'turistas' | 'profissionais' | 'empresas', number>> = {}
      const [{ count: t }, { count: p }, { count: e }] = await Promise.all([
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'turista'),
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'profissional'),
        supabase.from('denuncias').select('*', { head: true, count: 'exact' }).eq('denunciado_tipo', 'empresa'),
      ])
      base.turistas = t ?? 0
      base.profissionais = p ?? 0
      base.empresas = e ?? 0

      if (nivel === 2) {
        base.empresas = 0
      }
      if (nivel === 3) {
        base.turistas = 0
        base.profissionais = 0
      }
      if (nivel === 4) {
        base.profissionais = 0
        base.empresas = 0
      }

      const comunidade = String(getComunidade() ?? '').toLowerCase()
      if (nivel === 2 && comunidade) {
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
  }, [getComunidade, nivel])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <SubabasDenuncias
            perfilAtivo={perfilAtivo}
            onPerfilChange={setPerfilAtivo}
            podeVerProfissionais={podeVerProfissionais}
            podeVerEmpresas={podeVerEmpresas}
            badges={badges}
          />
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
      </div>
      <ListaDenuncias perfil={perfilAtivo} status={statusAtivo} periodo={periodo} busca={busca} categoria={categoria} />
    </div>
  )
}
