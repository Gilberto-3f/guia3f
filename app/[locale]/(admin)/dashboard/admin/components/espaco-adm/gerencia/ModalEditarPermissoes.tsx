'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Admin } from '../../../hooks/useGerenciaAdm'

type Props = {
  aberto: boolean
  onClose: () => void
  admin: Admin | null
  onSave: (updates: Partial<Admin>) => Promise<void>
}

type PermissoesGranulares = {
  modulos?: string[]
  recursos?: string[]
  comunidade?: string | null
}

function asPermissoesGranulares(value: unknown): PermissoesGranulares {
  if (!value || typeof value !== 'object') return {}
  const v = value as Record<string, unknown>
  return {
    modulos: Array.isArray(v.modulos) ? (v.modulos.filter((x) => typeof x === 'string') as string[]) : [],
    recursos: Array.isArray(v.recursos) ? (v.recursos.filter((x) => typeof x === 'string') as string[]) : [],
    comunidade: typeof v.comunidade === 'string' ? v.comunidade : null,
  }
}

export function ModalEditarPermissoes({ aberto, onClose, admin, onSave }: Props) {
  const [nivel, setNivel] = useState(2)
  const [comunidade, setComunidade] = useState('')
  const [modulos, setModulos] = useState<string[]>([])
  const [recursos, setRecursos] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!admin) return
    setNivel(admin.admin_level || 2)
    setComunidade(admin.comunidade || '')
    const p = asPermissoesGranulares(admin.permissoes)
    setModulos(p.modulos ?? [])
    setRecursos(p.recursos ?? [])
  }, [admin])

  const modulosDisponiveis = useMemo(
    () => [
      'visao_geral',
      'verificacao_turistas',
      'verificacao_profissionais',
      'verificacao_empresas',
      'denuncias_turistas',
      'denuncias_profissionais',
      'denuncias_empresas',
      'espaco_graficos',
      'espaco_empresas',
      'espaco_financeiro',
      'config_apis',
      'config_geral',
      'config_seguranca',
    ],
    []
  )

  const recursosDisponiveis = useMemo(
    () => [
      'aprovar',
      'reprovar',
      'resolver',
      'advertir',
      'suspender',
      'banir',
      'arquivar',
      'editar_planos',
      'editar_comissoes',
      'exportar_logs',
    ],
    []
  )

  const toggle = (list: string[], value: string, checked: boolean) => {
    if (checked) return list.includes(value) ? list : [...list, value]
    return list.filter((x) => x !== value)
  }

  const handleSalvar = async () => {
    if (!admin) return
    setSalvando(true)
    try {
      await onSave({
        admin_level: nivel,
        cargo: nivel === 2 ? 'MODERADOR' : nivel === 3 ? 'FINANCEIRO' : 'SUPORTE',
        comunidade: nivel === 2 ? (comunidade || null) : null,
        permissoes: { modulos, recursos, comunidade: nivel === 2 ? (comunidade || null) : null },
      })
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto || !admin) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#001f3f]">Editar permissões</h3>
          <button type="button" onClick={onClose} className="text-gray-500">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nível</label>
            <select
              value={nivel}
              onChange={(e) => setNivel(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
            >
              <option value={2}>Moderador</option>
              <option value={3}>Financeiro</option>
              <option value={4}>Suporte</option>
            </select>
          </div>

          {nivel === 2 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Comunidade</label>
              <select
                value={comunidade}
                onChange={(e) => setComunidade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
              >
                <option value="">Selecione uma comunidade</option>
                <option value="guias">Guias de Turismo</option>
                <option value="taxistas">Taxistas</option>
                <option value="apps">Motoristas de App</option>
                <option value="vans">Motoristas de Van</option>
                <option value="anfitrioes">Anfitriões</option>
              </select>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Módulos</label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {modulosDisponiveis.map((mod) => (
                <label key={mod} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={modulos.includes(mod)}
                    onChange={(e) => setModulos((prev) => toggle(prev, mod, e.target.checked))}
                  />
                  <span className="text-sm text-gray-800">{mod.replaceAll('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Recursos</label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {recursosDisponiveis.map((rec) => (
                <label key={rec} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recursos.includes(rec)}
                    onChange={(e) => setRecursos((prev) => toggle(prev, rec, e.target.checked))}
                  />
                  <span className="text-sm text-gray-800">{rec.replaceAll('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="flex-1 rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

