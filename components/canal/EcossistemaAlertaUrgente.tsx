'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'

type AlertaUrgente = {
  id: string
  membro: { nome: string; username: string }
}

/**
 * Popup global para ADMs quando um turista aciona CHAMAR ADM (socorro).
 */
export default function EcossistemaAlertaUrgente() {
  const router = useRouter()
  const [alertas, setAlertas] = useState<AlertaUrgente[]>([])
  const [visivel, setVisivel] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ecossistema-alertas-urgentes')
      if (res.status === 401 || res.status === 403) return
      const json = (await res.json()) as { ok?: boolean; alertas?: AlertaUrgente[] }
      if (json.ok && json.alertas && json.alertas.length > 0) {
        setAlertas(json.alertas)
        setVisivel(true)
      } else {
        setAlertas([])
        setVisivel(false)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void carregar()
    const t = setInterval(() => void carregar(), 12000)
    return () => clearInterval(t)
  }, [carregar])

  const dispensar = async (conversaId: string, abrirCanal: boolean) => {
    await fetch('/api/admin/ecossistema-alertas-urgentes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: conversaId }),
    })
    setVisivel(false)
    setAlertas((prev) => prev.filter((a) => a.id !== conversaId))
    if (abrirCanal) router.push('/canal')
  }

  if (!visivel || alertas.length === 0) return null

  const atual = alertas[0]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-labelledby="alerta-urgente-titulo"
        className="w-full max-w-md rounded-2xl border-2 border-red-500 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="alerta-urgente-titulo" className="text-lg font-bold text-red-700">
              ATENÇÃO
            </h2>
            <p className="mt-2 text-sm text-gray-800">
              Usuário <strong>{atual.membro.username}</strong> solicitou ajuda emergencial de um ADM.
            </p>
            <p className="mt-1 text-xs text-gray-600">{atual.membro.nome}</p>
          </div>
          <button
            type="button"
            onClick={() => void dispensar(atual.id, false)}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void dispensar(atual.id, true)}
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-700"
          >
            Abrir Mensageiro ECOSSISTEMA
          </button>
          <button
            type="button"
            onClick={() => void dispensar(atual.id, false)}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Dispensar aviso
          </button>
        </div>
      </div>
    </div>
  )
}
