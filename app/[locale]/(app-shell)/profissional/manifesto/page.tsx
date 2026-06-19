'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ClipboardList, MapPin } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import type { ManifestoProfRow } from '@/app/api/profissional/manifesto/route'

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ManifestoProfissionalPage() {
  const router = useRouter()
  const [manifestos, setManifestos] = useState<ManifestoProfRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/profissional/manifesto')
      if (res.status === 403) {
        setErro('Acesso restrito a profissionais com placa vermelha.')
        return
      }
      const json = (await res.json()) as { ok?: boolean; manifestos?: ManifestoProfRow[]; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao carregar manifesto.')
        return
      }
      setManifestos(json.manifestos ?? [])
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 bg-[#0097b2] px-2 pb-3 pt-safe text-white shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">Manifesto</h1>
          <p className="truncate text-xs text-white/80">Turistas contratados via recomendação</p>
        </div>
        <ClipboardList className="h-6 w-6 shrink-0 opacity-80" aria-hidden />
      </header>

      <main className="flex-1 p-4">
        <p className="mb-4 text-sm text-gray-600">
          Lista de turistas que contrataram seus serviços — dados de atendimento, atrativos e ponto de partida para
          execução do roteiro.
        </p>

        {loading ? (
          <p className="py-12 text-center text-sm text-gray-500">Carregando manifesto...</p>
        ) : erro ? (
          <p className="py-12 text-center text-sm text-rose-600">{erro}</p>
        ) : manifestos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
            Nenhum turista no manifesto ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {manifestos.map((m) => {
              const dados = m.dados_atendimento
              const atrativos = Array.isArray(dados.atrativos) ? dados.atrativos.map(String) : []
              return (
                <li key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{m.turista?.nome ?? 'Turista'}</p>
                      <p className="text-sm text-[#0097b2]">{m.turista?.username ?? '—'}</p>
                    </div>
                    <span className="rounded-full bg-[#0097b2]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0097b2]">
                      {m.status}
                    </span>
                  </div>
                  {dados.documento ? (
                    <p className="mt-2 text-xs text-gray-600">Documento: {String(dados.documento)}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-500">
                    Atendimento: {formatarDataHora(String(dados.data_hora_atendimento ?? m.created_at))}
                  </p>
                  {dados.ponto_partida ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                      <MapPin className="h-3.5 w-3.5 text-[#0097b2]" aria-hidden />
                      Partida: {String(dados.ponto_partida)}
                    </p>
                  ) : null}
                  {atrativos.length > 0 ? (
                    <p className="mt-1 text-xs text-gray-600">Atrativos: {atrativos.join(', ')}</p>
                  ) : null}
                  {m.indicador_nome ? (
                    <p className="mt-2 text-xs text-gray-500">Indicado por: {m.indicador_nome}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-gray-400">PAX: {m.pax_qtd}</p>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
