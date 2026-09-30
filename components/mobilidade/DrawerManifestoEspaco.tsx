'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronUp, MapPin, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { propsUmToque } from '@/lib/umToque'
import type { ManifestoDiarioRow } from '@/app/api/profissional/manifesto/route'
import type { ParadaItinerarioRow } from '@/lib/itinerarioParadas'
import { MANIFESTO_CAPACIDADE_PADRAO } from '@/lib/mobilidadePainelProfissional'
import {
  avisarCorridaAtivaAtualizada,
  avisarListaIniciada,
  MOBILIDADE_CORRIDA_ATIVA,
} from '@/lib/mobilidadeAtendimentoAtivoEventos'
import {
  FINALIZACAO_OUTRO_MAX,
  type MotivoFinalizacaoSemCheckinId,
} from '@/lib/manifestoFinalizacaoSemCheckin'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  aberto: boolean
  onFechar: () => void
  /** Abre direto na LISTA do manifesto de hoje (atalho flutuante). */
  abrirListaDoDia?: boolean
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatarDataBr(iso: string): string {
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}`
}

function formatarDataBrCompleta(iso: string): string {
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function manifestoVazioHoje(): ManifestoDiarioRow {
  return {
    id: '',
    data_manifesto: hojeIsoLocal(),
    status: 'rascunho',
    criado_em: '',
    confirmado_em: null,
    concluido_em: null,
    lista_iniciada_em: null,
    eh_guia: true,
    qtd_passageiros: 0,
    qtd_paradas: 0,
    passageiros: [],
    itinerario: [],
    atrativos: [],
    finalizacao_sem_checkin: null,
  }
}

function dataEhHoje(iso: string): boolean {
  return String(iso).slice(0, 10) === hojeIsoLocal()
}

/**
 * Drawer Manifesto no Espaço Profissional: lista do dia em destaque + demais datas.
 * Clique → detalhe com abas LISTA e ITINERÁRIO.
 */
export default function DrawerManifestoEspaco({ aberto, onFechar, abrirListaDoDia = false }: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [manifestos, setManifestos] = useState<ManifestoDiarioRow[]>([])
  const [selecionado, setSelecionado] = useState<ManifestoDiarioRow | null>(null)
  const [busyIniciar, setBusyIniciar] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const [resAtivos, resConcluidos] = await Promise.all([
        fetch('/api/profissional/manifesto'),
        fetch('/api/profissional/manifesto?concluidos=1'),
      ])
      const json = (await resAtivos.json()) as {
        ok?: boolean
        manifestos?: ManifestoDiarioRow[]
        error?: string
      }
      if (!resAtivos.ok) {
        setErro(String(json.error ?? t('manifestoErro')))
        setManifestos([])
        return
      }
      const ativos = Array.isArray(json.manifestos) ? json.manifestos : []
      let concluidos: ManifestoDiarioRow[] = []
      if (resConcluidos.ok) {
        const jsonC = (await resConcluidos.json()) as { manifestos?: ManifestoDiarioRow[] }
        concluidos = Array.isArray(jsonC.manifestos) ? jsonC.manifestos : []
      }
      const mapa = new Map<string, ManifestoDiarioRow>()
      for (const m of [...ativos, ...concluidos]) {
        if (m?.id) mapa.set(m.id, m)
      }
      const lista = [...mapa.values()].sort((a, b) =>
        String(b.data_manifesto).localeCompare(String(a.data_manifesto)),
      )
      setManifestos(lista)
      setSelecionado((prev) => {
        const doDiaRow = lista.find((m) => dataEhHoje(m.data_manifesto)) ?? null
        if (prev?.id) return lista.find((m) => m.id === prev.id) ?? prev
        if (prev && !prev.id) return doDiaRow ?? manifestoVazioHoje()
        if (abrirListaDoDia) return doDiaRow ?? manifestoVazioHoje()
        return null
      })
    } catch {
      setErro(t('manifestoErro'))
      setManifestos([])
    } finally {
      setLoading(false)
    }
  }, [t, abrirListaDoDia])

  useEffect(() => {
    if (!aberto) {
      setSelecionado(null)
      return
    }
    void carregar()
    const onRefresh = () => void carregar()
    window.addEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    return () => window.removeEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
  }, [aberto, carregar])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [selecionado?.id, aberto])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !aberto) return
    let startY = 0
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0
    }
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0
      if (el.scrollTop <= 0 && y - startY > 0) e.preventDefault()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [aberto, selecionado])

  const hoje = hojeIsoLocal()
  const doDia = useMemo(
    () => manifestos.find((m) => String(m.data_manifesto).slice(0, 10) === hoje) ?? null,
    [manifestos, hoje],
  )
  const outros = useMemo(
    () => manifestos.filter((m) => String(m.data_manifesto).slice(0, 10) !== hoje),
    [manifestos, hoje],
  )

  const iniciarLista = async () => {
    if (!doDia || busyIniciar) return
    if (doDia.qtd_passageiros < 1) {
      setErro(t('manifestoSemPassageirosIniciar'))
      return
    }
    setBusyIniciar(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/manifesto/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifesto_id: doDia.id }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('manifestoIniciarErro')))
        return
      }
      avisarListaIniciada()
      avisarCorridaAtivaAtualizada()
      onFechar()
    } finally {
      setBusyIniciar(false)
    }
  }

  const abrirListaHoje = () => setSelecionado(doDia ?? manifestoVazioHoje())

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden overscroll-none bg-white"
      style={{ height: 'var(--app-height, 100dvh)', overscrollBehavior: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-manifesto-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <Users className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-manifesto-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {selecionado ? t('manifestoListaPassageiros') : t('espacoAcao.manifesto.titulo')}
          </h2>
          <button
            type="button"
            {...propsUmToque(() => {
              if (selecionado) {
                setSelecionado(null)
                return
              }
              onFechar()
            })}
            className="cursor-pointer rounded-lg p-2 text-white/90 touch-manipulation hover:bg-white/15"
            aria-label={selecionado ? t('retornar') : t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-none px-4 pb-4 ${
          selecionado ? 'pt-2' : 'pt-4'
        }`}
        style={{ overscrollBehavior: 'none', overflowAnchor: 'none' }}
        data-modal-scroll-lock-scrollable
      >
        {erro ? (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{erro}</p>
        ) : null}
        {selecionado ? (
          <DetalheManifesto
            manifesto={selecionado}
            onAtualizar={() => void carregar()}
            onIniciarLista={
              dataEhHoje(selecionado.data_manifesto) &&
              Boolean(selecionado.id) &&
              !selecionado.lista_iniciada_em
                ? () => void iniciarLista()
                : undefined
            }
            busyIniciar={busyIniciar}
          />
        ) : (
          <>
            {loading ? (
              <p className="animate-pulse py-8 text-center text-sm text-gray-400">…</p>
            ) : null}

            {!loading ? (
              <div className="space-y-3">
                <button
                  type="button"
                  {...propsUmToque(abrirListaHoje)}
                  className="w-full cursor-pointer touch-manipulation rounded-2xl px-4 py-4 text-center text-white shadow-md"
                  style={{ backgroundColor: VERDE }}
                >
                  <p className="text-lg font-extrabold uppercase leading-tight tracking-wide">
                    {t('manifestoDeHoje')}
                  </p>
                  <p className="mt-1 text-sm font-normal text-white/90">
                    {doDia
                      ? `${doDia.qtd_passageiros} PAX — ${formatarDataBr(doDia.data_manifesto)}`
                      : `0 PAX — ${formatarDataBr(hoje)}`}
                    {doDia
                      ? ` · ${doDia.qtd_passageiros}/${MANIFESTO_CAPACIDADE_PADRAO}`
                      : ` · 0/${MANIFESTO_CAPACIDADE_PADRAO}`}
                  </p>
                </button>

                <p className="pt-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('manifestoOutrasListas')}
                </p>

                {outros.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">{t('manifestoSemOutras')}</p>
                ) : (
                  outros.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      {...propsUmToque(() => setSelecionado(m))}
                      className="w-full cursor-pointer touch-manipulation rounded-2xl px-4 py-4 text-center text-white shadow-md"
                      style={{ backgroundColor: COR }}
                    >
                      <p className="text-base font-extrabold uppercase leading-tight">
                        {t('manifestoListaPassageiros')}
                      </p>
                      <p className="mt-1 text-sm text-white/90">
                        {formatarDataBrCompleta(m.data_manifesto)} — {m.qtd_passageiros} PAX
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function DetalheManifesto({
  manifesto,
  onAtualizar,
  onIniciarLista,
  busyIniciar = false,
}: {
  manifesto: ManifestoDiarioRow
  onAtualizar: () => void
  onIniciarLista?: () => void
  busyIniciar?: boolean
}) {
  const t = useTranslations('Mobilidade')
  const [aba, setAba] = useState<'lista' | 'itinerario'>('lista')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pagConfirmado, setPagConfirmado] = useState(false)
  const [mostrarMotivo, setMostrarMotivo] = useState(false)
  const [motivoId, setMotivoId] = useState<MotivoFinalizacaoSemCheckinId | null>(null)
  const [motivoDetalhe, setMotivoDetalhe] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [cancelando, setCancelando] = useState<ManifestoDiarioRow['passageiros'][number] | null>(null)
  const [justificativa, setJustificativa] = useState('')

  const listaIniciada = Boolean(manifesto.lista_iniciada_em)
  const ehHoje = dataEhHoje(manifesto.data_manifesto)
  const mostrarAcoes = listaIniciada && ehHoje && String(manifesto.status) !== 'concluido'
  const aguardandoTurista = Boolean(manifesto.finalizacao_sem_checkin?.pendente)

  const empresasUnicas = useMemo(() => {
    const map = new Map<string, ParadaItinerarioRow & { turistas: { id: string; nome: string; username: string | null; foto: string | null }[] }>()
    for (const p of manifesto.itinerario ?? []) {
      const eid = p.empresa_id
      const tid = p.turista_id
      const pass = manifesto.passageiros.find((x) => x.turista_id === tid)
      const turista = {
        id: tid ?? '',
        nome: pass?.nome_social || pass?.nome || t('atendimentoTurista'),
        username: pass?.username ?? null,
        foto: pass?.foto_url ?? null,
      }
      const cur = map.get(eid)
      if (cur) {
        if (turista.id && !cur.turistas.some((x) => x.id === turista.id)) cur.turistas.push(turista)
      } else {
        map.set(eid, { ...p, turistas: turista.id ? [turista] : [] })
      }
    }
    return [...map.values()]
  }, [manifesto, t])

  const receber = async (passageiroId: string) => {
    setBusyId(passageiroId)
    setErroAcao('')
    try {
      const res = await fetch('/api/profissional/manifesto/passageiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passageiro_id: passageiroId, acao: 'receber' }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErroAcao(String(json.error ?? t('manifestoErro')))
        return
      }
      avisarCorridaAtivaAtualizada()
      onAtualizar()
    } finally {
      setBusyId(null)
    }
  }

  const confirmarCancelamento = async () => {
    if (!cancelando) return
    setBusyId(cancelando.id)
    setErroAcao('')
    try {
      const res = await fetch('/api/profissional/manifesto/passageiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passageiro_id: cancelando.id,
          acao: 'cancelar',
          justificativa,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErroAcao(String(json.error ?? t('manifestoErro')))
        return
      }
      setCancelando(null)
      setJustificativa('')
      avisarCorridaAtivaAtualizada()
      onAtualizar()
    } finally {
      setBusyId(null)
    }
  }

  const concluir = async () => {
    if (aguardandoTurista) return
    if (pagConfirmado) {
      setMostrarMotivo(true)
      setErroAcao('')
      return
    }
    setBusyId('concluir')
    setErroAcao('')
    try {
      const res = await fetch('/api/profissional/manifesto/concluir-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifesto_id: manifesto.id,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErroAcao(String(json.error ?? t('concluirErro')))
        return
      }
      avisarCorridaAtivaAtualizada()
      onAtualizar()
    } finally {
      setBusyId(null)
    }
  }

  const confirmarMotivo = async () => {
    if (!motivoId) {
      setErroAcao(t('finalizarSemCheckinEscolha'))
      return
    }
    if (motivoId === 'outro' && !motivoDetalhe.trim()) {
      setErroAcao(t('finalizarSemCheckinOutroObrigatorio'))
      return
    }
    setBusyId('concluir')
    setErroAcao('')
    try {
      const res = await fetch('/api/profissional/manifesto/propor-finalizacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifesto_id: manifesto.id,
          motivo: motivoId,
          detalhe: motivoDetalhe.trim() || null,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErroAcao(String(json.error ?? t('finalizarSemCheckinErro')))
        return
      }
      setMostrarMotivo(false)
      setMotivoId(null)
      setMotivoDetalhe('')
      avisarCorridaAtivaAtualizada()
      onAtualizar()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-gray-600">
        {formatarDataBrCompleta(manifesto.data_manifesto)} · {manifesto.qtd_passageiros} PAX
      </p>

      {onIniciarLista ? (
        <button
          type="button"
          disabled={busyIniciar}
          {...propsUmToque(() => onIniciarLista(), busyIniciar)}
          className="w-full cursor-pointer touch-manipulation rounded-xl py-3 text-sm font-extrabold uppercase tracking-wide text-white disabled:opacity-50"
          style={{ backgroundColor: VERDE }}
        >
          {t('manifestoIniciarLista')}
        </button>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba('lista')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold uppercase text-white ${
            aba === 'lista' ? 'opacity-100' : 'opacity-70'
          }`}
          style={{ backgroundColor: COR }}
        >
          <Users className="h-4 w-4" aria-hidden />
          {t('manifestoAbaLista')}
        </button>
        <button
          type="button"
          onClick={() => setAba('itinerario')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold uppercase text-white ${
            aba === 'itinerario' ? 'opacity-100' : 'opacity-70'
          }`}
          style={{ backgroundColor: COR }}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          {t('manifestoAbaItinerario')}
        </button>
      </div>

      {erroAcao ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{erroAcao}</p>
      ) : null}

      {aba === 'lista' ? (
        <>
          <ul className="space-y-2">
            {manifesto.passageiros.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">{t('manifestoSemPassageiros')}</p>
            ) : (
              manifesto.passageiros.map((p) => (
                <CardPassageiroManifesto
                  key={p.id}
                  passageiro={p}
                  mostrarAcoes={mostrarAcoes}
                  busy={busyId === p.id}
                  onReceber={() => void receber(p.id)}
                  onCancelar={() => {
                    setJustificativa('')
                    setCancelando(p)
                  }}
                />
              ))
            )}
          </ul>

          {mostrarAcoes ? (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              {aguardandoTurista ? (
                <p className="rounded-xl bg-[#0097b2]/10 px-3 py-2.5 text-center text-sm font-semibold text-[#0097b2]">
                  {t('finalizarSemCheckinAguardandoTurista')}
                </p>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={pagConfirmado}
                      onChange={(e) => setPagConfirmado(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t('finalizarSemCheckin')}</span>
                  </label>
                  <button
                    type="button"
                    disabled={busyId != null}
                    {...propsUmToque(() => void concluir(), busyId != null)}
                    className="w-full cursor-pointer touch-manipulation rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                    style={{ backgroundColor: COR }}
                  >
                    {t('concluirAtendimento')}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <ul className="space-y-2">
          {empresasUnicas.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('manifestoSemParadas')}</p>
          ) : (
            empresasUnicas.map((e) => <CardEmpresaItinerario key={e.empresa_id} empresa={e} />)
          )}
        </ul>
      )}

      {cancelando ? (
        <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm font-bold text-gray-900">{t('manifestoJustificativaTitulo')}</p>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder={t('manifestoJustificativaPlaceholder')}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelando(null)
                  setJustificativa('')
                }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600"
              >
                {t('fechar')}
              </button>
              <button
                type="button"
                disabled={justificativa.trim().length < 3 || busyId === cancelando.id}
                onClick={() => void confirmarCancelamento()}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {t('manifestoJustificativaEnviar')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mostrarMotivo ? (
        <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="w-full max-w-md space-y-3 rounded-2xl px-3 py-3 text-white shadow-xl"
            style={{ backgroundColor: COR }}
          >
            <p className="text-sm font-semibold text-white">{t('finalizarSemCheckinMotivoTitulo')}</p>
            <ul className="space-y-1.5">
              {(['cliente_pediu', 'outro'] as const).map((id) => (
                <li key={id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/30 bg-white/10 px-2.5 py-2 text-xs text-white">
                    <input
                      type="radio"
                      name="motivo-sem-checkin"
                      checked={motivoId === id}
                      onChange={() => {
                        setMotivoId(id)
                        if (id !== 'outro') setMotivoDetalhe('')
                      }}
                      className="mt-0.5 accent-white"
                    />
                    <span>
                      {id === 'cliente_pediu'
                        ? t('finalizarSemCheckinClientePediu')
                        : t('finalizarSemCheckinOutro')}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {motivoId === 'outro' ? (
              <label className="block text-xs text-white/90">
                {t('finalizarSemCheckinOutroLabel')}
                <textarea
                  value={motivoDetalhe}
                  onChange={(e) => setMotivoDetalhe(e.target.value.slice(0, FINALIZACAO_OUTRO_MAX))}
                  rows={3}
                  maxLength={FINALIZACAO_OUTRO_MAX}
                  placeholder={t('finalizarSemCheckinOutroPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-white/40 bg-white px-2.5 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-white/50"
                />
              </label>
            ) : null}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => {
                  setMostrarMotivo(false)
                  setMotivoId(null)
                  setMotivoDetalhe('')
                }}
                className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#0097b2] disabled:opacity-50"
              >
                {t('voltar')}
              </button>
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => void confirmarMotivo()}
                className="flex-1 rounded-xl bg-white py-2.5 text-sm font-bold uppercase text-[#0097b2] disabled:opacity-50"
              >
                {t('finalizarSemCheckinConfirmar')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatarDataNasc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function CardPassageiroManifesto({
  passageiro: p,
  mostrarAcoes,
  busy,
  onReceber,
  onCancelar,
}: {
  passageiro: ManifestoDiarioRow['passageiros'][number]
  mostrarAcoes: boolean
  busy: boolean
  onReceber: () => void
  onCancelar: () => void
}) {
  const t = useTranslations('Mobilidade')
  const [aberto, setAberto] = useState(false)
  const handle = String(p.username ?? '')
    .replace(/^@+/, '')
    .trim()
  const nome = p.nome_social || p.nome
  const fila = p.status_fila ?? 'pendente'

  return (
    <li
      className={`overflow-hidden rounded-xl border bg-[#f5f5f5] ${
        fila === 'cancelado' ? 'border-rose-200 opacity-70' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={aberto}
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200">
            {p.foto_url ? (
              <AvatarImage src={p.foto_url} alt="" fill className="object-cover" sizes="48px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#0097b2]">
                {(nome || 'T').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{p.nome}</p>
            {handle ? (
              <UsuarioHandleVerificado
                username={handle}
                verificado={false}
                asButton={false}
                className="text-xs text-gray-500"
              />
            ) : null}
          </div>
          {aberto ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          )}
        </button>
        {mostrarAcoes && fila === 'pendente' ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onReceber}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-50"
              style={{ backgroundColor: VERDE }}
              aria-label={t('manifestoCheckAria')}
            >
              <Check className="h-4 w-4" aria-hidden strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelar}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white disabled:opacity-50"
              aria-label={t('manifestoCancelarAria')}
            >
              <X className="h-4 w-4" aria-hidden strokeWidth={2.5} />
            </button>
          </div>
        ) : mostrarAcoes && fila === 'recebido' ? (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: VERDE }}
          >
            <Check className="h-4 w-4" aria-hidden />
          </span>
        ) : mostrarAcoes && fila === 'cancelado' ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white">
            <X className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      {aberto ? (
        <div className="space-y-1 border-t border-gray-200/80 px-3 py-2.5 text-xs text-gray-600">
          <p>
            <span className="font-semibold text-gray-700">Nasc.:</span> {formatarDataNasc(p.data_nascimento)}
          </p>
          <p>
            <span className="font-semibold text-gray-700">Doc.:</span> {p.documento?.trim() || '—'}
          </p>
          {p.contratacao_rotulo ? (
            <p className="text-[10px] text-gray-500">Entrada: {p.contratacao_rotulo}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function CardEmpresaItinerario({
  empresa,
}: {
  empresa: ParadaItinerarioRow & {
    turistas: { id: string; nome: string; username: string | null; foto: string | null }[]
  }
}) {
  const t = useTranslations('Mobilidade')
  const [aberto, setAberto] = useState(false)
  const handleEmpresa = '' // username empresa não vem na row; só nome

  return (
    <li className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {empresa.empresa_foto ? (
            <AvatarImage src={empresa.empresa_foto} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#0097b2]">
              {(empresa.empresa_nome || 'E').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{empresa.empresa_nome}</p>
          {handleEmpresa ? (
            <p className="truncate text-xs text-gray-500">@{handleEmpresa}</p>
          ) : (
            <p className="truncate text-xs text-gray-500">{empresa.categoria}</p>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
        )}
      </button>
      {aberto ? (
        <div className="border-t border-gray-100 bg-[#f5f5f5] px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-gray-600">{t('manifestoQuemDesejaVisitar')}</p>
          {empresa.turistas.length === 0 ? (
            <p className="text-xs text-gray-400">—</p>
          ) : (
            <ul className="space-y-2">
              {empresa.turistas.map((tu) => {
                const h = String(tu.username ?? '')
                  .replace(/^@+/, '')
                  .trim()
                return (
                  <li key={tu.id} className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                      {tu.foto ? (
                        <AvatarImage src={tu.foto} alt="" fill className="object-cover" sizes="32px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#0097b2]">
                          {(tu.nome || 'T').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{tu.nome}</p>
                      {h ? <p className="truncate text-[10px] text-gray-500">@{h}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  )
}
