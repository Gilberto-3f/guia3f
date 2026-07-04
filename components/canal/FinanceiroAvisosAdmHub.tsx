'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'

type AvisoHub = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  created_at: string
  lido: boolean
}

/**
 * Cards informativos no topo do Canal Financeiro ADM (ADM GERAL + ADM Financeiro).
 */
export default function FinanceiroAvisosAdmHub() {
  const [avisos, setAvisos] = useState<AvisoHub[]>([])
  const [loading, setLoading] = useState(true)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/financeiro-avisos-hub')
      const json = (await res.json()) as { ok?: boolean; avisos?: AvisoHub[] }
      if (json.ok && Array.isArray(json.avisos)) {
        setAvisos(json.avisos)
      } else {
        setAvisos([])
      }
    } catch {
      setAvisos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const marcarLido = async (id: string) => {
    setMarcandoId(id)
    try {
      const res = await fetch('/api/admin/financeiro-avisos-hub', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, lido: true } : a)))
      }
    } finally {
      setMarcandoId(null)
    }
  }

  if (loading) {
    return (
      <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando avisos…
      </div>
    )
  }

  if (avisos.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={`rounded-xl border bg-white p-4 shadow-sm ${
            !aviso.lido ? 'border-l-4 border-[#00D443]' : 'border-gray-200'
          }`}
        >
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0097b2]/10">
              <CalendarClock className="h-5 w-5 text-[#0097b2]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900">{aviso.titulo}</h3>
                {!aviso.lido ? (
                  <span className="rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">Nova</span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-gray-700">{aviso.mensagem}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/admin?tab=espaco-adm&sub=financeiro"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0097b2] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  ESPAÇO ADM · Gestão de Assinaturas
                </Link>
                {!aviso.lido ? (
                  <button
                    type="button"
                    disabled={marcandoId === aviso.id}
                    onClick={() => void marcarLido(aviso.id)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-50"
                  >
                    {marcandoId === aviso.id ? 'Marcando…' : 'Marcar como lida'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
