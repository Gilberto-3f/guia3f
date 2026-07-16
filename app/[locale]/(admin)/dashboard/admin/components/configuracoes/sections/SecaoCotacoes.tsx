'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ConfigAPIs, CotacaoModoConfig } from '../../../types/admin.types'

type CotacaoRow = {
  moeda: string
  valor_brl: number
  atualizado_em?: string | null
  fonte?: string | null
}

const MOEDAS_MANUAL = ['USD', 'EUR', 'ARS', 'PYG'] as const

type Props = {
  localApis: ConfigAPIs
  setLocalApis: (next: ConfigAPIs) => void
  podeEditar: boolean
  onMensagem: (m: { tipo: 'sucesso' | 'erro'; texto: string } | null) => void
}

export function SecaoCotacoes({ localApis, setLocalApis, podeEditar, onMensagem }: Props) {
  const [cotacoes, setCotacoes] = useState<CotacaoRow[]>([])
  const [syncando, setSyncando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregarTabela = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/admin/cotacoes')
      const json = (await res.json()) as {
        ok?: boolean
        cotacoes?: CotacaoRow[]
        syncEm?: string | null
      }
      if (!res.ok || !json.ok) throw new Error('Falha ao carregar cotações')
      setCotacoes(json.cotacoes ?? [])
      if (json.syncEm) {
        setLocalApis({ ...localApis, cotacoes_sync_em: json.syncEm })
      }
    } catch {
      /* mantém estado */
    } finally {
      setCarregando(false)
    }
  }, [localApis, setLocalApis])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setCarregando(true)
      try {
        const res = await fetch('/api/admin/cotacoes')
        const json = (await res.json()) as { ok?: boolean; cotacoes?: CotacaoRow[]; syncEm?: string | null }
        if (cancel || !res.ok || !json.ok) return
        setCotacoes(json.cotacoes ?? [])
      } finally {
        if (!cancel) setCarregando(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const setManualValor = (moeda: string, raw: string) => {
    const n = Number(raw.replace(',', '.'))
    const next = { ...localApis.cotacoes_manual }
    if (Number.isFinite(n) && n > 0) next[moeda] = n
    else delete next[moeda]
    setLocalApis({ ...localApis, cotacoes_manual: next })
  }

  const sincronizarAgora = async () => {
    if (!podeEditar) return
    setSyncando(true)
    onMensagem(null)
    try {
      const patch = await fetch('/api/admin/cotacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: localApis.cotacoes_modo,
          fonteUrl: localApis.cotacoes_fonte_url,
          manual: localApis.cotacoes_manual,
          aplicar: true,
        }),
      })
      const patchJson = (await patch.json()) as { ok?: boolean; error?: string }
      if (!patch.ok || !patchJson.ok) throw new Error(patchJson.error ?? 'Erro ao aplicar')

      onMensagem({ tipo: 'sucesso', texto: 'Cotações sincronizadas.' })
      window.setTimeout(() => onMensagem(null), 3000)

      const res = await fetch('/api/admin/cotacoes')
      const json = (await res.json()) as {
        ok?: boolean
        cotacoes?: CotacaoRow[]
        syncEm?: string | null
      }
      if (res.ok && json.ok) {
        setCotacoes(json.cotacoes ?? [])
        if (json.syncEm) setLocalApis({ ...localApis, cotacoes_sync_em: json.syncEm })
      }
    } catch (e) {
      onMensagem({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao sincronizar cotações',
      })
    } finally {
      setSyncando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-bold text-[#001f3f]">💱 Cotações (Compras CDE)</h3>
      <p className="mb-4 text-xs text-gray-500">
        Valores internos = quantidade da moeda por R$ 1. Cron diário + fallback manual.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">
          Modo
          <select
            value={localApis.cotacoes_modo}
            onChange={(e) =>
              setLocalApis({
                ...localApis,
                cotacoes_modo: e.target.value as CotacaoModoConfig,
              })
            }
            disabled={!podeEditar}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm disabled:opacity-60"
          >
            <option value="api">API (AwesomeAPI)</option>
            <option value="manual">Manual (ADM)</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-700">
          URL da fonte
          <input
            type="text"
            value={localApis.cotacoes_fonte_url}
            onChange={(e) => setLocalApis({ ...localApis, cotacoes_fonte_url: e.target.value })}
            disabled={!podeEditar || localApis.cotacoes_modo !== 'api'}
            className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
          />
        </label>
      </div>

      {localApis.cotacoes_modo === 'manual' ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {MOEDAS_MANUAL.map((m) => (
            <label key={m} className="text-sm font-semibold text-gray-700">
              {m} / R$1
              <input
                type="number"
                step="any"
                min="0"
                value={localApis.cotacoes_manual[m] ?? ''}
                onChange={(e) => setManualValor(m, e.target.value)}
                disabled={!podeEditar}
                className="mt-1 w-full rounded-xl border border-gray-200 p-2 text-sm disabled:opacity-60"
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-600">Tabela atual</span>
          {localApis.cotacoes_sync_em ? (
            <span className="text-[11px] text-gray-400">
              Sync: {new Date(localApis.cotacoes_sync_em).toLocaleString('pt-BR')}
            </span>
          ) : null}
        </div>
        {carregando ? (
          <p className="text-xs text-gray-400">Carregando…</p>
        ) : cotacoes.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma cotação no banco.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 text-xs text-gray-700 md:grid-cols-4">
            {cotacoes.map((c) => (
              <li key={c.moeda} className="rounded-lg border border-gray-100 bg-white px-2 py-1.5">
                <span className="font-bold">{c.moeda}</span>:{' '}
                {Number(c.valor_brl).toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                {c.fonte ? <span className="ml-1 text-gray-400">({c.fonte})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {podeEditar ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void sincronizarAgora()}
            disabled={syncando}
            className="rounded-xl bg-[#00D443] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {syncando ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
