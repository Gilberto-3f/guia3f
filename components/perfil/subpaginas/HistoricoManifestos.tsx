'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ManifestoDiarioRow } from '@/app/api/profissional/manifesto/route'

function formatarData(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { dateStyle: 'medium' })
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Histórico de manifestos diários concluídos (placa vermelha). */
export default function HistoricoManifestos() {
  const [manifestos, setManifestos] = useState<ManifestoDiarioRow[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profissional/manifesto?concluidos=1')
      const json = (await res.json()) as { ok?: boolean; manifestos?: ManifestoDiarioRow[] }
      setManifestos(json.manifestos ?? [])
    } catch {
      setManifestos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="space-y-3 px-1 pb-4">
      <p className="text-sm text-gray-600">
        Histórico de manifestos executados e concluídos — comprovante dos benefícios gerados (comissões e parcerias).
      </p>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Carregando...</p>
      ) : manifestos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
          Nenhum manifesto finalizado ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {manifestos.map((m) => (
            <li key={m.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <p className="font-semibold text-gray-900">{formatarData(m.data_manifesto)}</p>
              <p className="text-xs text-gray-500">
                {m.qtd_passageiros} passageiro(s) · {m.qtd_atrativos} atrativo(s)
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Concluído: {m.concluido_em ? formatarDataHora(m.concluido_em) : '—'}
              </p>
              {m.passageiros.slice(0, 3).map((p) => (
                <p key={p.id} className="text-xs text-[#0097b2]">
                  {p.nome} {p.username ? `(${p.username})` : ''}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
