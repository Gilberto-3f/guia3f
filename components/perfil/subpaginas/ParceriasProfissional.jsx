'use client'

import { useCallback, useEffect, useState } from 'react'
import { Handshake } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import type { ParceriaEmAndamentoRow } from '@/app/api/profissional/parcerias/route'

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Parcerias em andamento — ganhos de manifesto / hospedagem via recomendação. */
export default function ParceriasProfissional() {
  const [parcerias, setParcerias] = useState<ParceriaEmAndamentoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/profissional/parcerias')
      const json = (await res.json()) as { ok?: boolean; parcerias?: ParceriaEmAndamentoRow[]; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao carregar parcerias.')
        setParcerias([])
        return
      }
      setParcerias(json.parcerias ?? [])
    } catch {
      setErro('Falha de conexão.')
      setParcerias([])
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
        Parcerias em andamento formadas por recomendações. Acompanhe ganhos de manifesto vendido ou hospedagem e
        comissões divididas conforme configuração do ADM.
      </p>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Carregando parcerias...</p>
      ) : erro ? (
        <p className="py-8 text-center text-sm text-rose-600">{erro}</p>
      ) : parcerias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
          Nenhuma parceria em andamento.
        </div>
      ) : (
        <ul className="space-y-2">
          {parcerias.map((p) => {
            const handle = p.parceiro.username ? `@${p.parceiro.username.replace(/^@+/, '')}` : '—'
            return (
              <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <AvatarImage
                    src={p.parceiro.foto_url}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">{p.parceiro.nome}</span>
                      <Handshake className="h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                    </div>
                    <p className="truncate text-sm text-[#0097b2]">{handle}</p>
                    <p className="text-xs text-gray-500">{p.parceiro.categorias}</p>
                    <p className="mt-1 text-xs text-gray-500">Início: {formatarDataHora(p.created_at)}</p>
                    {p.turista ? (
                      <p className="mt-1 text-xs font-medium text-[#15803d]">
                        Turista: {p.turista.nome} ({p.turista.username})
                        {p.contratado_em ? ` · contratado ${formatarDataHora(p.contratado_em)}` : ''}
                      </p>
                    ) : null}
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        p.status === 'em_andamento' ? 'bg-[#0097b2]/15 text-[#0097b2]' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.status === 'em_andamento' ? 'Em andamento' : p.status}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
