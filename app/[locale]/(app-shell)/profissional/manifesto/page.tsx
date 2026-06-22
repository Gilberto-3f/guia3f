'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Info,
  Loader2,
  MapPin,
  Plus,
  Route,
  Users,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import PopupEnderecoAtrativo from '@/components/manifesto/PopupEnderecoAtrativo'
import PopupParadasPassageiro from '@/components/manifesto/PopupParadasPassageiro'
import type { ManifestoDiarioRow } from '@/app/api/profissional/manifesto/route'
import type { PassageiroDisponivelRow } from '@/app/api/profissional/manifesto/passageiros-disponiveis/route'
import type { AtrativoDisponivelRow } from '@/app/api/profissional/manifesto/atrativos-disponiveis/route'
import type { ParadaItinerarioRow } from '@/lib/itinerarioParadas'

function formatarData(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatarDataNasc(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
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

function paradasDoPassageiro(m: ManifestoDiarioRow, turistaId: string | null): ParadaItinerarioRow[] {
  if (!turistaId) return []
  return m.itinerario.filter((p) => p.turista_id === turistaId)
}

function resumoItinerarioUnico(paradas: ParadaItinerarioRow[]): ParadaItinerarioRow[] {
  const map = new Map<string, ParadaItinerarioRow>()
  for (const p of paradas) {
    if (!map.has(p.empresa_id)) map.set(p.empresa_id, p)
  }
  return [...map.values()]
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
  const [modalParadas, setModalParadas] = useState<{
    manifestoId: string
    turistaId: string
    turistaNome: string
  } | null>(null)
  const [modalAddParadas, setModalAddParadas] = useState<{
    manifestoId: string
    turistaId: string
    turistaNome: string
  } | null>(null)
  const [paradasDisp, setParadasDisp] = useState<AtrativoDisponivelRow[]>([])
  const [paradasSel, setParadasSel] = useState<Set<string>>(new Set())
  const [salvandoParadas, setSalvandoParadas] = useState(false)
  const [popupEndereco, setPopupEndereco] = useState<ParadaItinerarioRow | null>(null)

  const manifestoExpandido = useMemo(
    () => manifestos.find((m) => m.id === expandido) ?? null,
    [manifestos, expandido],
  )

  const paradasInfoPassageiro = useMemo(() => {
    if (!modalParadas || !manifestoExpandido) return []
    return paradasDoPassageiro(manifestoExpandido, modalParadas.turistaId)
  }, [modalParadas, manifestoExpandido])

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
        body: JSON.stringify({ turista_ids: [...selecionados] }),
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

  const abrirAddParadas = async (manifestoId: string, turistaId: string, turistaNome: string) => {
    setModalAddParadas({ manifestoId, turistaId, turistaNome })
    setParadasSel(new Set())
    try {
      const res = await fetch('/api/profissional/manifesto/atrativos-disponiveis')
      const json = (await res.json()) as { atrativos?: AtrativoDisponivelRow[] }
      setParadasDisp(json.atrativos ?? [])
    } catch {
      setParadasDisp([])
    }
  }

  const salvarParadas = async () => {
    if (!modalAddParadas || paradasSel.size === 0) return
    setSalvandoParadas(true)
    try {
      const res = await fetch(`/api/profissional/manifesto/${modalAddParadas.manifestoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paradas: [...paradasSel].map((empresa_id) => ({
            empresa_id,
            turista_id: modalAddParadas.turistaId,
          })),
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Erro ao adicionar paradas.')
        return
      }
      setModalAddParadas(null)
      await carregar()
    } finally {
      setSalvandoParadas(false)
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
      if (!json.ok) setErro(json.error ?? 'Erro no check-in.')
      else await carregar()
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
      if (!json.ok) setErro(json.error ?? 'Erro ao concluir.')
      else await carregar()
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

  const podeConcluir = (m: ManifestoDiarioRow) => {
    if (m.eh_guia && m.qtd_paradas > 0) {
      return m.itinerario.every((p) => p.visitado || p.checkin_confirmado)
    }
    return m.qtd_passageiros > 0
  }

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
          <p className="truncate text-xs text-white/80">Lista de passageiros + resumo do itinerário</p>
        </div>
        <ClipboardList className="h-6 w-6 shrink-0 opacity-80" aria-hidden />
      </header>

      <main className="flex-1 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600">PAX para aduanas e roteiro de paradas do dia.</p>
          <button
            type="button"
            onClick={() => void abrirNovo()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#00D443] px-3 py-2 text-xs font-bold uppercase text-white hover:opacity-95"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo manifesto
          </button>
        </div>

        {erro ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{erro}</p> : null}

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
              const resumoParadas = resumoItinerarioUnico(m.itinerario)

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
                          {m.qtd_passageiros} PAX
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Route className="h-3.5 w-3.5" aria-hidden />
                          {m.qtd_paradas} paradas
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
                      {/* —— MANIFESTO (PAX) —— */}
                      <div className="mt-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0097b2]">
                          <Users className="h-4 w-4" aria-hidden />
                          Lista de passageiros
                        </p>
                        {m.passageiros.length === 0 ? (
                          <p className="text-sm text-gray-500">Nenhum passageiro.</p>
                        ) : (
                          <ul className="space-y-2">
                            {m.passageiros.map((p) => {
                              const handle = p.username?.replace(/^@+/, '')
                              return (
                                <li
                                  key={p.id}
                                  className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0097b2] text-sm font-bold text-white">
                                    {p.ordem}
                                  </span>
                                  <AvatarImage
                                    src={p.foto_url}
                                    alt=""
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-900">
                                      {p.nome_social || handle ? `@${handle ?? ''}` : p.nome}
                                    </p>
                                    <p className="text-sm text-gray-800">{p.nome}</p>
                                    <p className="mt-1 text-xs text-gray-600">
                                      Nasc.: {formatarDataNasc(p.data_nascimento)} · Doc.: {p.documento ?? '—'}
                                    </p>
                                    <p className="text-[10px] text-gray-500">Entrada: {p.contratacao_rotulo}</p>
                                    {!p.contratacao_validada ? (
                                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                        Dados pendentes
                                      </span>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      p.turista_id
                                        ? setModalParadas({
                                            manifestoId: m.id,
                                            turistaId: p.turista_id,
                                            turistaNome: p.nome,
                                          })
                                        : undefined
                                    }
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/10 text-[#0097b2] hover:bg-[#0097b2]/20"
                                    aria-label={`Itinerário de ${p.nome}`}
                                    title="Paradas deste passageiro"
                                  >
                                    <Info className="h-5 w-5" />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>

                      {/* —— ITINERÁRIO —— */}
                      <div className="mt-5">
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0097b2]">
                          <MapPin className="h-4 w-4" aria-hidden />
                          Resumo do itinerário
                        </p>

                        {m.status === 'rascunho' && m.passageiros.some((p) => p.turista_id) ? (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {m.passageiros.map((p) =>
                              p.turista_id ? (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => void abrirAddParadas(m.id, p.turista_id!, p.nome)}
                                  className="rounded-lg border border-[#0097b2]/30 bg-[#0097b2]/5 px-3 py-1.5 text-xs font-semibold text-[#0097b2]"
                                >
                                  + Paradas — {p.nome.split(' ')[0]}
                                </button>
                              ) : null,
                            )}
                          </div>
                        ) : null}

                        {resumoParadas.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
                            Nenhuma parada no itinerário.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {resumoParadas.map((par) => (
                              <button
                                key={par.empresa_id}
                                type="button"
                                onClick={() => setPopupEndereco(par)}
                                className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-center hover:border-[#0097b2]/40 hover:bg-[#0097b2]/5"
                              >
                                <AvatarImage
                                  src={par.empresa_foto}
                                  alt=""
                                  width={56}
                                  height={56}
                                  className="h-14 w-14 rounded-lg object-cover"
                                />
                                <span className="line-clamp-2 text-xs font-semibold text-gray-900">
                                  {par.empresa_nome}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                    par.visitado ? 'bg-[#00D443]/15 text-[#15803d]' : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {par.visitado ? 'Visitado' : 'Agendado'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {m.eh_guia && m.itinerario.length > 0 && m.status !== 'concluido' && m.status !== 'cancelado' ? (
                          <ul className="mt-4 space-y-2">
                            {m.itinerario.map((par) => (
                              <li
                                key={par.id}
                                className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{par.empresa_nome}</p>
                                  <p className="text-xs text-gray-500">{par.categoria}</p>
                                </div>
                                {!par.visitado ? (
                                  <button
                                    type="button"
                                    disabled={acaoId === `${m.id}-${par.empresa_id}`}
                                    onClick={() => void confirmarCheckIn(m.id, par.empresa_id, par.turista_id)}
                                    className="shrink-0 rounded-lg bg-[#0097b2] px-3 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                                  >
                                    {acaoId === `${m.id}-${par.empresa_id}` ? (
                                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                                    ) : (
                                      'Confirmar check-in'
                                    )}
                                  </button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {m.status === 'rascunho' ? (
                          <button
                            type="button"
                            disabled={acaoId === `confirmar-${m.id}`}
                            onClick={() => void confirmarManifesto(m.id)}
                            className="rounded-lg bg-[#00D443] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                          >
                            Confirmar manifesto
                          </button>
                        ) : null}
                        {m.status !== 'concluido' && m.status !== 'cancelado' && podeConcluir(m) ? (
                          <button
                            type="button"
                            disabled={acaoId === `concluir-${m.id}`}
                            onClick={() => void concluirManifesto(m.id)}
                            className="rounded-lg bg-[#00D443] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                          >
                            Concluir manifesto
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
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Novo manifesto</h2>
            <p className="mt-1 text-sm text-gray-600">Selecione passageiros para a lista PAX de hoje.</p>
            {passageirosDisp.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Nenhum passageiro disponível.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {passageirosDisp.map((p) => (
                  <li key={p.turista_id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(p.turista_id)}
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
                ))}
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

      {modalAddParadas ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Paradas — {modalAddParadas.turistaNome}</h2>
            <p className="mt-1 text-sm text-gray-600">Adicione atrativos ao itinerário deste passageiro.</p>
            {paradasDisp.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Nenhum atrativo disponível.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {paradasDisp.map((a) => (
                  <li key={a.empresa_id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3">
                      <input
                        type="checkbox"
                        checked={paradasSel.has(a.empresa_id)}
                        onChange={() => {
                          setParadasSel((prev) => {
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
                        <p className="text-xs text-gray-500">{a.categoria}</p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModalAddParadas(null)}
                className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoParadas || paradasSel.size === 0}
                onClick={() => void salvarParadas()}
                className="flex-1 rounded-lg bg-[#00D443] py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {salvandoParadas ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PopupParadasPassageiro
        aberto={modalParadas != null}
        onFechar={() => setModalParadas(null)}
        passageiroNome={modalParadas?.turistaNome ?? ''}
        paradas={paradasInfoPassageiro}
      />

      <PopupEnderecoAtrativo
        aberto={popupEndereco != null}
        onFechar={() => setPopupEndereco(null)}
        empresaId={popupEndereco?.empresa_id ?? null}
        preview={
          popupEndereco
            ? {
                nome_fantasia: popupEndereco.empresa_nome,
                foto_url: popupEndereco.empresa_foto,
              }
            : null
        }
      />
    </div>
  )
}
