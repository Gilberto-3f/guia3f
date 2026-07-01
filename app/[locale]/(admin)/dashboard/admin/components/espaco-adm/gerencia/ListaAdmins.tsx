'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import {
  rotuloComunidadeModerador,
  rotuloFuncaoAdmin,
  rotuloPaisModerador,
} from '@/lib/adminConvites'
import { CardUsuarioConvite } from './CardUsuarioConvite'

const COR_LOGO = '#0097b2'

function rotuloCargo(admin: {
  admin_level: number
  cargo: string
  comunidade: string | null
  pais: string | null
}): string {
  if (admin.admin_level === 1) return 'ADM GERAL'
  const base = rotuloFuncaoAdmin(admin.admin_level)
  if (admin.admin_level === 2) {
    const com = rotuloComunidadeModerador(admin.comunidade)
    const p = rotuloPaisModerador(admin.pais)
    return [base, com, p].filter(Boolean).join(' · ')
  }
  return base
}

export function ListaAdmins() {
  const { admins, loading, atualizarBonificacao, isAdminGeral } = useGerenciaAdm()
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  if (!isAdminGeral) return null

  if (loading) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Carregando…</div>
  }

  const colaboradores = admins.filter((a) => a.admin_level > 1)

  if (!colaboradores.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
        Nenhum colaborador ADM cadastrado.
      </div>
    )
  }

  const toggle = (id: string) => setAbertos((prev) => ({ ...prev, [id]: !prev[id] }))

  const confirmarPct = async (id: string) => {
    const raw = pctDraft[id] ?? ''
    const pct = Number(raw.replace(',', '.'))
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return
    setSalvando(id)
    try {
      await atualizarBonificacao(id, pct)
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="space-y-3">
      {colaboradores.map((a) => {
        const aberto = Boolean(abertos[a.id])
        const pctAtual =
          a.participacao_percentual != null && Number.isFinite(a.participacao_percentual)
            ? String(a.participacao_percentual)
            : ''
        return (
          <div key={a.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="p-4">
              <CardUsuarioConvite
                nomeSocial={a.nome_social || a.nome}
                username={a.username || a.email.split('@')[0] || 'usuario'}
                fotoUrl={a.foto_url}
              />
              <p className="mt-3 text-center text-sm font-bold" style={{ color: COR_LOGO }}>
                {rotuloCargo(a)}
              </p>
              <button
                type="button"
                onClick={() => toggle(a.id)}
                className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                aria-expanded={aberto}
              >
                Bonificação (%)
                {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {aberto ? (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Participação nos lucros (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder={pctAtual || '0'}
                    value={pctDraft[a.id] ?? pctAtual}
                    onChange={(e) => setPctDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={salvando === a.id}
                    onClick={() => void confirmarPct(a.id)}
                    className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: COR_LOGO }}
                  >
                    {salvando === a.id ? '…' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
