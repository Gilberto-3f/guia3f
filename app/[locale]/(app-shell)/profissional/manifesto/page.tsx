'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  Users,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import type { ManifestoDiarioRow } from '@/app/api/profissional/manifesto/route'
import type { PassageiroDisponivelRow } from '@/app/api/profissional/manifesto/passageiros-disponiveis/route'
import type { AtrativoDisponivelRow } from '@/app/api/profissional/manifesto/atrativos-disponiveis/route'

function formatarData(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const BADGE_STATUS: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  confirmado: 'bg-blue-100 text-blue-700',
  em_andamento: 'bg-amber-100 text-amber-800',
  concluido: 'bg-[#00D443]/15 text-[#15803d]',
  cancelado: 'bg-red-100 text-red-700',
}

const ROTULO_STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export default function ManifestoProfissionalPage() {
  const router = useRouter()
  const [manifestos, setManifestos] = useState<ManifestoDiarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [passageirosDisp, setPassageirosDisp] = useState<PassageiroDisponivelRow[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [criando, setCriando] = useState(false)
  const [acaoId, setAcaoId] = useState<string | null>(null)
  const [modalAtrativos, setModalAtrativos] = useState<{
    manifestoId: string
    turistaId: string
    turistaNome: string
  } | null>(null)
  const [atrativosDisp, setAtrativosDisp] = useState<AtrativoDisponivelRow[]>([])
  const [atrativosSel, setAtrativosSel] = useState<Set<string>>(new Set())
  const [salvandoAtrativos, setSalvandoAtrativos] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/profissional/manifesto')
      if (res.status === 403) {
        setErro('Acesso restrito a profissionais com placa vermelha (Guia/Van).')
        return
      }
      const json = (await res.json()) as { ok?: boolean; manifestos?: ManifestoDiarioRow[]; error?: string }
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

  const abrirNovo = async () => {
    setModalNovo(true)
    setSelecionados(new Set())
    try {
      const res = await fetch('/api/profissional/manifesto/passageiros-disponiveis')
      const json = (await res.json()) as { passageiros?: PassageiroDisponivelRow[] }
      setPassageirosDisp(json.passageiros ?? [])
    } catch {
      setPassageirosDisp([])
    }
  }

  const criarManifesto = async () => {
    setCriando(true)
    try {
      const res = await fetch('/api/profissional/manifesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turista_ids: [...selecionados],
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao criar manifesto.')
        return
      }
      setModalNovo(false)
      await carregar()
    } catch {
      setErro('Falha ao criar manifesto.')
    } finally {
      setCriando(false)
    }
  }

  const confirmarCheckIn = async (manifestoId: string, empresaId: string, turistaId: string | null) => {
    setAcaoId(`${manifestoId}-${empresaId}`)
    try {
      const metodo = typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'gps' : 'manual'
      const res = await fetch('/api/profissional/manifesto/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifesto_id: manifestoId, empresa_id: empresaId, turista_id: turistaId, metodo }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro no check-in.')
        return
      }
      await carregar()
    } finally {
      setAcaoId(null)
    }
  }

  const concluirManifesto = async (manifestoId: string) => {
    setAcaoId(`concluir-${manifestoId}`)
    try {
      const res = await fetch('/api/profissional/manifesto/concluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifesto_id: manifestoId }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao concluir.')
        return
      }
      await carregar()
    } finally {
      setAcaoId(null)
    }
  }

  const confirmarManifesto = async (manifestoId: string) => {
    setAcaoId(`confirmar-${manifestoId}`)
    try {
      await fetch(`/api/profissional/manifesto/${manifestoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmar: true }),
      })
      await carregar()
    } finally {
      setAcaoId(null)
    }
  }

  const abrirAtrativos = async (
    manifestoId: string,
    turistaId: string | null,
    turistaNome: string,
  ) => {
    if (!turistaId) return
    setModalAtrativos({ manifestoId, turistaId, turistaNome })
    setAtrativosSel(new Set())
    try {
      const res = await fetch('/api/profissional/manifesto/atrativos-disponiveis')
      const json = (await res.json()) as { atrativos?: AtrativoDisponivelRow[] }
      setAtrativosDisp(json.atrativos ?? [])
    } catch {
      setAtrativosDisp([])
    }
  }

  const salvarAtrativos = async () => {
    if (!modalAtrativos || atrativosSel.size === 0) return
    setSalvandoAtrativos(true)
    try {
      const res = await fetch(`/api/profissional/manifesto/${modalAtrativos.manifestoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atrativos: [...atrativosSel].map((empresa_id) => ({
            empresa_id,
            turista_id: modalAtrativos.turistaId,
          })),
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao adicionar atrativos.')
        return
      }
      setModalAtrativos(null)
      await carregar()
    } catch {
      setErro('Falha ao salvar atrativos.')
    } finally {
      setSalvandoAtrativos(false)
    }
  }

  const todosCheckinsFeitos = (m: ManifestoDiarioRow) =>
    m.atrativos.length === 0 || m.atrativos.every((a) => a.visitado || a.checkin_confirmado)

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
          <h1 className="truncate text-lg font-semibold uppercase tracking-wide">Manifesto</h1>
          <p className="truncate text-xs text-white/80">Gerencie seus roteiros diários</p>
        </div>
        <ClipboardList className="h-6 w-6 shrink-0 opacity-80" aria-hidden />
      </header>

      <main className="flex-1 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600">Roteiros diários com passageiros, atrativos e check-ins.</p>
          <button
            type="button"
            onClick={() => void abrirNovo()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#00D443] px-3 py-2 text-xs font-bold uppercase text-white hover:opacity-95"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo manifesto
          </button>
        </div>

        {erro ? (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{erro}</p>
        ) : null}

        {loading ? (
          <p className="py-12 text-center text-sm text-gray-500">Carregando manifestos...</p>
        ) : manifestos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
            Nenhum manifesto ainda. Toque em NOVO MANIFESTO para começar.
          </div>
        ) : (
          <ul className="space-y-3">
            {manifestos.map((m) => {
              const aberto = expandido === m.id
              const badge = BADGE_STATUS[m.status] ?? BADGE_STATUS.rascunho
              const rotulo = ROTULO_STATUS[m.status] ?? m.status
              return (
                <li key={m.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 p-4 text-left"
                    onClick={() => setExpandido(aberto ? null : m.id)}
                    aria-expanded={aberto}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-gray-900">{formatarData(m.data_manifesto)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge}`}>
                          {rotulo}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {m.qtd_passageiros} passageiro{m.qtd_passageiros !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {m.qtd_atrativos} atrativo{m.qtd_atrativos !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    {aberto ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                    )}
                  </button>

                  {aberto ? (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      {m.passageiros.length > 0 ? (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Passageiros</p>
                          <ul className="space-y-2">
                            {m.passageiros.map((p) => (
                              <li key={p.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                                <AvatarImage
                                  src={null}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="h-10 w-10 shrink-0 rounded-full bg-[#0097b2]/10 object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold text-gray-900">{p.nome}</p>
                                  <p className="truncate text-xs text-[#0097b2]">
                                    {p.username?.replace(/^@+/, '') ? `@${p.username.replace(/^@+/, '')}` : '—'}
                                  </p>
                                  <p className="text-[10px] text-gray-500">Entrada: {p.contratacao_rotulo}</p>
                                  {p.profissional_indireto_nome ? (
                                    <p className="text-[10px] text-gray-400">Indicado por: {p.profissional_indireto_nome}</p>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {m.status === 'rascunho' && m.passageiros.length > 0 ? (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                            Adicionar atrativos
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {m.passageiros.map((p) =>
                              p.turista_id ? (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => void abrirAtrativos(m.id, p.turista_id, p.nome)}
                                  className="rounded-lg border border-[#0097b2]/30 bg-[#0097b2]/5 px-3 py-1.5 text-xs font-semibold text-[#0097b2] hover:bg-[#0097b2]/10"
                                >
                                  + Atrativos — {p.nome.split(' ')[0]}
                                </button>
                              ) : null,
                            )}
                          </div>
                        </div>
                      ) : null}

                      {m.atrativos.length > 0 ? (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Atrativos</p>
                          <ul className="space-y-2">
                            {m.atrativos.map((a) => (
                              <li
                                key={a.id}
                                className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="font-medium text-gray-900">{a.empresa_nome}</p>
                                  <p className="text-xs text-gray-500">{a.categoria}</p>
                                  <span
                                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                      a.visitado ? 'bg-[#00D443]/15 text-[#15803d]' : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {a.visitado ? 'Visitado' : 'Agendado'}
                                  </span>
                                </div>
                                {!a.visitado && m.status !== 'concluido' && m.status !== 'cancelado' ? (
                                  <button
                                    type="button"
                                    disabled={acaoId === `${m.id}-${a.empresa_id}`}
                                    onClick={() => void confirmarCheckIn(m.id, a.empresa_id, a.turista_id)}
                                    className="shrink-0 rounded-lg bg-[#0097b2] px-3 py-2 text-xs font-bold uppercase text-white hover:bg-[#007d94] disabled:opacity-50"
                                  >
                                    {acaoId === `${m.id}-${a.empresa_id}` ? (
                                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                                    ) : (
                                      'Confirmar check-in'
                                    )}
                                  </button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {m.status === 'rascunho' ? (
                          <button
                            type="button"
                            disabled={acaoId === `confirmar-${m.id}`}
                            onClick={() => void confirmarManifesto(m.id)}
                            className="rounded-lg bg-[#00D443] px-4 py-2 text-xs font-bold uppercase text-white hover:opacity-95 disabled:opacity-50"
                          >
                            Confirmar manifesto
                          </button>
                        ) : null}
                        {m.status !== 'concluido' &&
                        m.status !== 'cancelado' &&
                        m.atrativos.length > 0 &&
                        todosCheckinsFeitos(m) ? (
                          <button
                            type="button"
                            disabled={acaoId === `concluir-${m.id}`}
                            onClick={() => void concluirManifesto(m.id)}
                            className="rounded-lg bg-[#00D443] px-4 py-2 text-xs font-bold uppercase text-white hover:opacity-95 disabled:opacity-50"
                          >
                            {acaoId === `concluir-${m.id}` ? 'Concluindo...' : 'Concluir manifesto'}
                          </button>
                        ) : null}
                      </div>

                      <p className="mt-3 text-[10px] text-gray-400">Criado: {formatarDataHora(m.criado_em)}</p>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {modalNovo ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
            role="dialog"
            aria-labelledby="novo-manifesto-titulo"
          >
            <h2 id="novo-manifesto-titulo" className="text-lg font-bold text-gray-900">
              Novo manifesto
            </h2>
            <p className="mt-1 text-sm text-gray-600">Selecione passageiros contratados ou agendados para hoje.</p>

            {passageirosDisp.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Nenhum passageiro disponível no momento.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {passageirosDisp.map((p) => {
                  const marcado = selecionados.has(p.turista_id)
                  return (
                    <li key={p.turista_id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => {
                            setSelecionados((prev) => {
                              const next = new Set(prev)
                              if (next.has(p.turista_id)) next.delete(p.turista_id)
                              else next.add(p.turista_id)
                              return next
                            })
                          }}
                          className="h-4 w-4 accent-[#00D443]"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{p.nome}</p>
                          <p className="text-xs text-[#0097b2]">{p.username}</p>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModalNovo(false)}
                className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-semibold text-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={criando || selecionados.size === 0}
                onClick={() => void criarManifesto()}
                className="flex-1 rounded-lg bg-[#00D443] py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {criando ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalAtrativos ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
            role="dialog"
            aria-labelledby="atrativos-manifesto-titulo"
          >
            <h2 id="atrativos-manifesto-titulo" className="text-lg font-bold text-gray-900">
              Atrativos — {modalAtrativos.turistaNome}
            </h2>
            <p className="mt-1 text-sm text-gray-600">Selecione empresas da sua lista de comissões.</p>

            {atrativosDisp.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Nenhum atrativo disponível.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {atrativosDisp.map((a) => {
                  const marcado = atrativosSel.has(a.empresa_id)
                  return (
                    <li key={a.empresa_id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => {
                            setAtrativosSel((prev) => {
                              const next = new Set(prev)
                              if (next.has(a.empresa_id)) next.delete(a.empresa_id)
                              else next.add(a.empresa_id)
                              return next
                            })
                          }}
                          className="h-4 w-4 accent-[#00D443]"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{a.nome_fantasia}</p>
                          <p className="text-xs text-gray-500">
                            {a.categoria}
                            {a.cidade ? ` · ${a.cidade}` : ''}
                          </p>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModalAtrativos(null)}
                className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-semibold text-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoAtrativos || atrativosSel.size === 0}
                onClick={() => void salvarAtrativos()}
                className="flex-1 rounded-lg bg-[#00D443] py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {salvandoAtrativos ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
