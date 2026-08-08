'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bus,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Network,
  Radio,
  Search,
  UserSearch,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import {
  COR_AZUL_LOGO,
  COR_VERDE_BOTAO,
  listarDatasDoMes,
} from '@/lib/hospedagemCalendario'
import { rotuloCategoriaProfissionalRecomendacao } from '@/lib/recomendarProfissional'
import type { ProfissionalEcossistemaRow } from '@/app/api/profissional/buscar-ecossistema/route'
import type { ClienteEcossistemaRow } from '@/app/api/profissional/buscar-cliente-ecossistema/route'

const COR = '#0097b2'
const VERDE = '#00D443'
const COR_SEM_SLOT = '#e8e8e8'
const COR_PASSADO = '#c4c4c4'

type Slot = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  vagas_total: number
  vagas_ocupadas: number
  vagas_livres?: number
  ativo: boolean
}

type Props = {
  aberto: boolean
  onFechar: () => void
}

type Etapa = 'escolha' | 'manual' | 'algoritmo'
type AbaOnline = 'van' | 'taxista' | 'guia'

function categoriaNaAba(cats: string[], aba: AbaOnline): boolean {
  const set = new Set(cats.map((c) => String(c).toLowerCase()))
  if (aba === 'van') return set.has('van')
  if (aba === 'taxista') return set.has('taxista')
  return set.has('guia')
}

function hojeIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type StatusDia = 'passado' | 'livre' | 'lotado' | 'vazio'

function statusDia(iso: string, slotsDoDia: Slot[], hoje: string): StatusDia {
  if (iso < hoje) return 'passado'
  const ativos = slotsDoDia.filter((s) => s.ativo)
  if (ativos.length === 0) return 'vazio'
  const livres = ativos.reduce(
    (acc, s) => acc + (s.vagas_livres ?? s.vagas_total - s.vagas_ocupadas),
    0,
  )
  return livres > 0 ? 'livre' : 'lotado'
}

function corStatus(st: StatusDia): string {
  if (st === 'passado') return COR_PASSADO
  if (st === 'livre') return COR_VERDE_BOTAO
  if (st === 'lotado') return COR_AZUL_LOGO
  return COR_SEM_SLOT
}

function lerGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30_000 },
    )
  })
}

/**
 * Drawer Ecossistema: Manual / ONLINE AGORA → parceiro → cliente → solicitar atendimento.
 */
export default function DrawerEcossistemaEspaco({ aberto, onFechar }: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [infoAberto, setInfoAberto] = useState(false)
  const [abaOnline, setAbaOnline] = useState<AbaOnline>('van')
  const [termo, setTermo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultados, setResultados] = useState<ProfissionalEcossistemaRow[]>([])
  const [selecionado, setSelecionado] = useState<ProfissionalEcossistemaRow | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsMsg, setSlotsMsg] = useState('')
  /** Após escolher parceiro: agenda → localizar cliente. */
  const [faseParceiro, setFaseParceiro] = useState<'agenda' | 'cliente'>('agenda')
  const [termoCliente, setTermoCliente] = useState('')
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [clientes, setClientes] = useState<ClienteEcossistemaRow[]>([])
  const [clienteSel, setClienteSel] = useState<ClienteEcossistemaRow | null>(null)
  const [erroCliente, setErroCliente] = useState('')
  const [enviandoSolic, setEnviandoSolic] = useState(false)
  const [okSolic, setOkSolic] = useState('')
  /** null = ainda não escolheu; imediato | pre */
  const [tipoAtendimento, setTipoAtendimento] = useState<'imediato' | 'pre' | null>(null)
  const [agendaAberta, setAgendaAberta] = useState(false)
  const [erroAgenda, setErroAgenda] = useState('')

  const hoje = hojeIsoLocal()
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth())
  const [diaSlot, setDiaSlot] = useState<string | null>(null)

  const reset = useCallback(() => {
    setEtapa('escolha')
    setInfoAberto(false)
    setAbaOnline('van')
    setTermo('')
    setResultados([])
    setSelecionado(null)
    setSlots([])
    setSlotsMsg('')
    setErro('')
    setDiaSlot(null)
    setBuscando(false)
    setFaseParceiro('agenda')
    setTermoCliente('')
    setClientes([])
    setClienteSel(null)
    setErroCliente('')
    setEnviandoSolic(false)
    setOkSolic('')
    setBuscandoCliente(false)
    setTipoAtendimento(null)
    setAgendaAberta(false)
    setErroAgenda('')
  }, [])

  useEffect(() => {
    if (!aberto) {
      reset()
      return
    }
  }, [aberto, reset])

  /** Busca manual (debounce). */
  useEffect(() => {
    if (!aberto || etapa !== 'manual' || selecionado) return
    const q = termo.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }
    const id = window.setTimeout(() => {
      void (async () => {
        setBuscando(true)
        setErro('')
        try {
          const res = await fetch(
            `/api/profissional/buscar-ecossistema?q=${encodeURIComponent(q)}`,
          )
          const json = (await res.json()) as {
            profissionais?: ProfissionalEcossistemaRow[]
            error?: string
          }
          if (!res.ok) {
            setErro(String(json.error ?? t('ecossistemaErroBusca')))
            setResultados([])
            return
          }
          setResultados(Array.isArray(json.profissionais) ? json.profissionais : [])
        } catch {
          setErro(t('ecossistemaErroBusca'))
          setResultados([])
        } finally {
          setBuscando(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(id)
  }, [aberto, termo, selecionado, etapa, t])

  const buscarOnline = useCallback(async () => {
    setBuscando(true)
    setErro('')
    setResultados([])
    try {
      const gps = await lerGps()
      const qs = new URLSearchParams({ modo: 'online' })
      if (gps) {
        qs.set('lat', String(gps.lat))
        qs.set('lng', String(gps.lng))
      }
      const res = await fetch(`/api/profissional/buscar-ecossistema?${qs.toString()}`)
      const json = (await res.json()) as {
        profissionais?: ProfissionalEcossistemaRow[]
        error?: string
      }
      if (!res.ok) {
        setErro(String(json.error ?? t('ecossistemaErroBuscaApp')))
        return
      }
      const lista = Array.isArray(json.profissionais) ? json.profissionais : []
      setResultados(lista)
      if (lista.length === 0) setErro(t('ecossistemaSemOnline'))
    } catch {
      setErro(t('ecossistemaErroBuscaApp'))
    } finally {
      setBuscando(false)
    }
  }, [t])

  const abrirAlgoritmo = () => {
    setEtapa('algoritmo')
    setSelecionado(null)
    setTermo('')
    void buscarOnline()
  }

  const carregarSlots = useCallback(
    async (profId: string) => {
      setSlotsLoading(true)
      setSlotsMsg('')
      setSlots([])
      try {
        const res = await fetch(
          `/api/mobilidade/disponibilidade?profissional_id=${encodeURIComponent(profId)}`,
        )
        const json = (await res.json()) as {
          slots?: Slot[]
          placa_vermelha?: boolean
          mensagem?: string
          error?: string
        }
        if (!res.ok) {
          setSlotsMsg(String(json.error ?? t('ecossistemaErroAgenda')))
          return
        }
        setSlots(Array.isArray(json.slots) ? json.slots : [])
        if (json.mensagem) setSlotsMsg(String(json.mensagem))
        else if (!json.placa_vermelha) setSlotsMsg(t('ecossistemaSemPlaca'))
        else if (!(json.slots ?? []).length) setSlotsMsg(t('ecossistemaSemAgenda'))
      } catch {
        setSlotsMsg(t('ecossistemaErroAgenda'))
      } finally {
        setSlotsLoading(false)
      }
    },
    [t],
  )

  const escolher = (p: ProfissionalEcossistemaRow) => {
    setSelecionado(p)
    setDiaSlot(null)
    setFaseParceiro('agenda')
    setClienteSel(null)
    setClientes([])
    setTermoCliente('')
    setErroCliente('')
    setOkSolic('')
    setTipoAtendimento(null)
    setAgendaAberta(false)
    setErroAgenda('')
    setSlots([])
    setSlotsMsg('')
  }

  const selecionarTipoAtendimento = (tipo: 'imediato' | 'pre') => {
    setTipoAtendimento(tipo)
    setErroAgenda('')
    if (tipo === 'imediato') {
      setDiaSlot(null)
      setAgendaAberta(false)
      return
    }
    setAgendaAberta(true)
    if (selecionado && slots.length === 0 && !slotsLoading) {
      void carregarSlots(selecionado.id)
    }
  }

  const avancarParaCliente = () => {
    if (!tipoAtendimento) {
      setErroAgenda(t('ecossistemaEscolhaTipo'))
      return
    }
    if (tipoAtendimento === 'pre' && !diaSlot) {
      setErroAgenda(t('ecossistemaEscolhaData'))
      setAgendaAberta(true)
      return
    }
    setErroAgenda('')
    setFaseParceiro('cliente')
    setErroCliente('')
    setOkSolic('')
  }

  /** Busca cliente turista (recomendação direcionada). */
  useEffect(() => {
    if (!aberto || !selecionado || faseParceiro !== 'cliente' || clienteSel) return
    const q = termoCliente.trim().replace(/^@+/, '')
    if (q.length < 2) {
      setClientes([])
      setBuscandoCliente(false)
      return
    }
    const id = window.setTimeout(() => {
      void (async () => {
        setBuscandoCliente(true)
        setErroCliente('')
        try {
          const res = await fetch(
            `/api/profissional/buscar-cliente-ecossistema?q=${encodeURIComponent(q)}`,
          )
          const json = (await res.json()) as {
            clientes?: ClienteEcossistemaRow[]
            error?: string
          }
          if (!res.ok) {
            setErroCliente(String(json.error ?? t('ecossistemaErroCliente')))
            setClientes([])
            return
          }
          setClientes(Array.isArray(json.clientes) ? json.clientes : [])
        } catch {
          setErroCliente(t('ecossistemaErroCliente'))
          setClientes([])
        } finally {
          setBuscandoCliente(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(id)
  }, [aberto, selecionado, faseParceiro, termoCliente, clienteSel, t])

  const slotsPorData = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      const d = String(s.data).slice(0, 10)
      const cur = map.get(d) ?? []
      cur.push(s)
      map.set(d, cur)
    }
    return map
  }, [slots])

  const cells = useMemo(() => listarDatasDoMes(ano, mes), [ano, mes])
  const tituloMes = useMemo(
    () =>
      new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [ano, mes],
  )

  const slotsDoDia = useMemo(() => {
    if (!diaSlot) return []
    return slotsPorData.get(diaSlot) ?? []
  }, [diaSlot, slotsPorData])

  const dataAgendadaIso = useMemo(() => {
    if (tipoAtendimento !== 'pre' || !diaSlot) return null
    const slot = slotsDoDia[0]
    const hora = slot?.hora_inicio != null ? String(slot.hora_inicio).slice(0, 5) : '09:00'
    const [hh, mm] = hora.split(':').map((x) => Number(x))
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return `${diaSlot}T12:00:00`
    return `${diaSlot}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
  }, [tipoAtendimento, diaSlot, slotsDoDia])

  const solicitarAtendimento = async () => {
    if (!selecionado || !clienteSel) {
      setErroCliente(t('ecossistemaEscolhaCliente'))
      return
    }
    setEnviandoSolic(true)
    setErroCliente('')
    setOkSolic('')
    try {
      const res = await fetch('/api/profissional/ecossistema/solicitar-atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profissional_indicado_id: selecionado.id,
          turista_usuario_id: clienteSel.usuario_id,
          data_agendada: tipoAtendimento === 'pre' ? dataAgendadaIso : null,
          atendimento_imediato: tipoAtendimento === 'imediato',
        }),
      })
      const json = (await res.json()) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setErroCliente(String(json.error ?? t('ecossistemaErroSolicitar')))
        return
      }
      setOkSolic(t('ecossistemaSolicitadoOk'))
    } catch {
      setErroCliente(t('ecossistemaErroSolicitar'))
    } finally {
      setEnviandoSolic(false)
    }
  }

  const resultadosOnlineFiltrados = useMemo(() => {
    if (etapa !== 'algoritmo') return resultados
    return resultados.filter((p) => categoriaNaAba(p.categorias, abaOnline))
  }, [etapa, resultados, abaOnline])

  const voltarCabecalho = () => {
    if (selecionado && faseParceiro === 'cliente') {
      setFaseParceiro('agenda')
      setErroCliente('')
      setOkSolic('')
      return
    }
    if (selecionado) {
      setSelecionado(null)
      setSlots([])
      setSlotsMsg('')
      setDiaSlot(null)
      setFaseParceiro('agenda')
      setClienteSel(null)
      setTipoAtendimento(null)
      setAgendaAberta(false)
      setErroAgenda('')
      return
    }
    if (etapa !== 'escolha') {
      setEtapa('escolha')
      setTermo('')
      setResultados([])
      setErro('')
      setInfoAberto(false)
      return
    }
    onFechar()
  }

  if (!aberto) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[95] flex flex-col bg-white"
        style={{ height: 'var(--app-height, 100dvh)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-ecossistema-titulo"
      >
        <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
          <div className="flex h-12 items-center gap-2 px-3">
            <Network className="h-5 w-5 shrink-0 text-white" aria-hidden />
            <h2
              id="drawer-ecossistema-titulo"
              className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
            >
              {selecionado
                ? faseParceiro === 'cliente'
                  ? t('ecossistemaBuscaClienteTitulo')
                  : selecionado.nome
                : t('espacoAcao.ecossistema.titulo')}
            </h2>
            {!selecionado && etapa === 'escolha' ? (
              <button
                type="button"
                onClick={() => setInfoAberto((v) => !v)}
                className="rounded-lg p-2 text-white/90 hover:bg-white/15"
                aria-label={t('ecossistemaInfoAria')}
                aria-expanded={infoAberto}
              >
                <Info className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={voltarCabecalho}
              className="rounded-lg p-2 text-white/90 hover:bg-white/15"
              aria-label={
                selecionado || etapa !== 'escolha' ? t('retornar') : t('fechar')
              }
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
          {selecionado && faseParceiro === 'agenda' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {selecionado.foto_url ? (
                    <AvatarImage
                      src={selecionado.foto_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-bold text-[#0097b2]">
                      {selecionado.nome.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{selecionado.nome}</p>
                  {selecionado.username ? (
                    <UsuarioHandleVerificado
                      username={selecionado.username}
                      verificado={selecionado.placa_vermelha}
                      verificadoTipo="profissional"
                      asButton={false}
                      className="text-xs text-gray-500"
                    />
                  ) : null}
                  <p className="truncate text-xs text-gray-500">
                    {rotuloCategoriaProfissionalRecomendacao(selecionado.categorias)}
                    {selecionado.nota_media != null ? ` · ★ ${selecionado.nota_media}` : ''}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-bold text-[#0097b2]">{t('ecossistemaAtendimentoTitulo')}</p>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[#f5f5f5] px-3 py-3">
                    <input
                      type="checkbox"
                      checked={tipoAtendimento === 'imediato'}
                      onChange={() => selecionarTipoAtendimento('imediato')}
                      className="h-4 w-4 accent-[#00D443]"
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {t('ecossistemaAtendimentoImediato')}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[#f5f5f5] px-3 py-3">
                    <input
                      type="checkbox"
                      checked={tipoAtendimento === 'pre'}
                      onChange={() => selecionarTipoAtendimento('pre')}
                      className="h-4 w-4 accent-[#00D443]"
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {t('ecossistemaAtendimentoPre')}
                    </span>
                  </label>
                </div>
              </div>

              {tipoAtendimento === 'pre' ? (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !agendaAberta
                      setAgendaAberta(next)
                      if (next && selecionado && slots.length === 0 && !slotsLoading) {
                        void carregarSlots(selecionado.id)
                      }
                    }}
                    className="flex w-full items-center gap-2 px-3 py-3 text-left"
                  >
                    <CalendarDays className="h-5 w-5 shrink-0 text-[#0097b2]" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide text-[#0097b2]">
                      {t('ecossistemaAgendaChevron')}
                    </span>
                    {diaSlot ? (
                      <span className="shrink-0 text-xs font-semibold text-gray-600">
                        {diaSlot.slice(8, 10)}/{diaSlot.slice(5, 7)}
                      </span>
                    ) : null}
                    <span className="text-xs text-gray-400">{agendaAberta ? '▲' : '▼'}</span>
                  </button>
                  {agendaAberta ? (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                      <p className="mb-3 text-xs text-gray-500">{t('ecossistemaAgendaHint')}</p>
                      {slotsLoading ? (
                        <p className="animate-pulse py-6 text-center text-sm text-gray-400">…</p>
                      ) : (
                        <>
                          {slotsMsg ? (
                            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                              {slotsMsg}
                            </p>
                          ) : null}

                          <div className="rounded-xl border border-gray-200 bg-white p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  if (mes === 0) {
                                    setMes(11)
                                    setAno((a) => a - 1)
                                  } else setMes((m) => m - 1)
                                }}
                                className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
                                aria-label={t('calendarioMesAnterior')}
                              >
                                <ChevronLeft className="h-5 w-5" aria-hidden />
                              </button>
                              <p className="text-sm font-bold capitalize text-[#001f3f]">{tituloMes}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (mes === 11) {
                                    setMes(0)
                                    setAno((a) => a + 1)
                                  } else setMes((m) => m + 1)
                                }}
                                className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
                                aria-label={t('calendarioProximoMes')}
                              >
                                <ChevronRight className="h-5 w-5" aria-hidden />
                              </button>
                            </div>

                            <div className="mb-1 grid grid-cols-7 gap-1">
                              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                                <div
                                  key={d}
                                  className="text-center text-[10px] font-semibold text-gray-500"
                                >
                                  {d}
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                              {cells.map((iso, idx) => {
                                if (!iso) return <div key={`e-${idx}`} className="aspect-square" />
                                const st = statusDia(iso, slotsPorData.get(iso) ?? [], hoje)
                                const clicavel = st === 'livre' || st === 'lotado'
                                const textColor = st === 'vazio' ? '#666666' : '#ffffff'
                                return (
                                  <button
                                    key={iso}
                                    type="button"
                                    disabled={!clicavel}
                                    onClick={() => {
                                      if (!clicavel) return
                                      setDiaSlot(iso)
                                      setErroAgenda('')
                                    }}
                                    className="aspect-square rounded-md text-[11px] font-semibold disabled:cursor-default"
                                    style={{
                                      backgroundColor: corStatus(st),
                                      color: textColor,
                                      outline: diaSlot === iso ? '2px solid #001f3f' : undefined,
                                      outlineOffset: 1,
                                    }}
                                  >
                                    {Number(iso.slice(8, 10))}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {diaSlot && slotsDoDia.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                              {slotsDoDia.map((s) => {
                                const livres =
                                  s.vagas_livres ?? s.vagas_total - s.vagas_ocupadas
                                return (
                                  <li
                                    key={s.id}
                                    className="rounded-xl border border-gray-100 bg-[#f5f5f5] px-3 py-2 text-sm"
                                  >
                                    <span className="font-semibold text-gray-900">
                                      {s.hora_inicio} – {s.hora_fim}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500">
                                      {t('calendarioVagasResumo', {
                                        livres,
                                        total: s.vagas_total,
                                      })}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {erroAgenda ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                  {erroAgenda}
                </p>
              ) : null}

              <button
                type="button"
                onClick={avancarParaCliente}
                className="w-full rounded-xl py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-md"
                style={{ backgroundColor: VERDE }}
              >
                {t('ecossistemaBuscaClienteTitulo')}
              </button>
            </div>
          ) : faseParceiro === 'cliente' && selecionado ? (
            <div className="space-y-4">
              {clienteSel ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-[#0097b2]/30 bg-[#0097b2]/5 px-3 py-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white">
                      {clienteSel.foto_url ? (
                        <AvatarImage
                          src={clienteSel.foto_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg font-bold text-[#0097b2]">
                          {clienteSel.nome.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{clienteSel.nome}</p>
                      {clienteSel.username ? (
                        <p className="truncate text-xs text-gray-500">@{clienteSel.username}</p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setClienteSel(null)
                      setOkSolic('')
                      setErroCliente('')
                    }}
                    className="w-full text-center text-xs font-semibold text-[#0097b2] underline"
                  >
                    {t('ecossistemaTrocarCliente')}
                  </button>

                  {erroCliente ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                      {erroCliente}
                    </p>
                  ) : null}
                  {okSolic ? (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800">
                      {okSolic}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void solicitarAtendimento()}
                    disabled={enviandoSolic || Boolean(okSolic)}
                    className="w-full rounded-xl py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-md disabled:opacity-60"
                    style={{ backgroundColor: VERDE }}
                  >
                    {enviandoSolic ? t('ecossistemaSolicitando') : t('ecossistemaSolicitarAtendimento')}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-bold text-[#0097b2]">{t('ecossistemaBuscaClienteTitulo')}</p>
                    <p className="mt-1 text-xs text-gray-500">{t('ecossistemaBuscaClienteHint')}</p>
                  </div>

                  <label className="relative block">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={termoCliente}
                      onChange={(e) => {
                        setTermoCliente(e.target.value)
                        setOkSolic('')
                      }}
                      placeholder={t('ecossistemaBuscaClientePlaceholder')}
                      className="w-full rounded-xl border border-gray-200 bg-[#f5f5f5] py-3 pl-10 pr-3 text-sm outline-none ring-[#0097b2] focus:bg-white focus:ring-2"
                      autoComplete="off"
                      autoFocus
                    />
                  </label>

                  {erroCliente ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                      {erroCliente}
                    </p>
                  ) : null}

                  {buscandoCliente ? (
                    <p className="animate-pulse py-4 text-center text-sm text-gray-400">…</p>
                  ) : null}

                  {!buscandoCliente &&
                  termoCliente.trim().length >= 2 &&
                  clientes.length === 0 &&
                  !erroCliente ? (
                    <p className="py-4 text-center text-sm text-gray-500">{t('ecossistemaSemCliente')}</p>
                  ) : null}

                  <ul className="space-y-2">
                    {clientes.map((c) => (
                      <li key={c.usuario_id}>
                        <button
                          type="button"
                          onClick={() => {
                            setClienteSel(c)
                            setOkSolic('')
                            setErroCliente('')
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-[#f5f5f5] px-3 py-2.5 text-left transition hover:border-[#0097b2]/40"
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white">
                            {c.foto_url ? (
                              <AvatarImage
                                src={c.foto_url}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#0097b2]">
                                {c.nome.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{c.nome}</p>
                            {c.username ? (
                              <p className="truncate text-xs text-gray-500">@{c.username}</p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : etapa === 'escolha' ? (
            <div className="space-y-4">
              {infoAberto ? (
                <div className="flex items-start gap-2 rounded-xl bg-[#0097b2]/10 px-3 py-3 text-left text-sm text-gray-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                  <p>{t('ecossistemaInfoModos')}</p>
                </div>
              ) : null}

              <p className="text-center text-base font-semibold text-gray-800">
                {t('ecossistemaProcurarPor')}
              </p>

              <button
                type="button"
                onClick={() => {
                  setEtapa('manual')
                  setErro('')
                  setResultados([])
                }}
                className="flex w-full flex-row items-center justify-center gap-3 rounded-2xl px-4 py-4 text-center text-white shadow-md"
                style={{ backgroundColor: COR }}
              >
                <UserSearch className="h-6 w-6 shrink-0" aria-hidden />
                <span className="text-base font-extrabold uppercase tracking-wide">
                  {t('ecossistemaBtnManual')}
                </span>
              </button>

              <button
                type="button"
                onClick={abrirAlgoritmo}
                className="flex w-full flex-row items-center justify-center gap-3 rounded-2xl px-4 py-4 text-center text-white shadow-md"
                style={{ backgroundColor: VERDE }}
              >
                <Radio className="h-6 w-6 shrink-0" aria-hidden />
                <span className="text-base font-extrabold uppercase tracking-wide">
                  {t('ecossistemaBtnApp')}
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {etapa === 'manual' ? (
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    placeholder={t('ecossistemaBuscaPlaceholder')}
                    className="w-full rounded-xl border border-gray-200 bg-[#f5f5f5] py-3 pl-10 pr-3 text-sm outline-none ring-[#0097b2] focus:bg-white focus:ring-2"
                    autoComplete="off"
                    autoFocus
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-700">
                      {t('ecossistemaOnlineTitulo')}
                    </p>
                    <button
                      type="button"
                      onClick={() => void buscarOnline()}
                      disabled={buscando}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
                      style={{ backgroundColor: COR }}
                    >
                      {t('ecossistemaAtualizar')}
                    </button>
                  </div>
                  <div className="flex rounded-lg bg-gray-100 p-1">
                    {(
                      [
                        { id: 'van' as const, label: t('ecossistemaAbaVan'), Icon: Bus },
                        { id: 'taxista' as const, label: t('ecossistemaAbaTaxi'), Icon: Car },
                        { id: 'guia' as const, label: t('ecossistemaAbaGuia'), Icon: MapPin },
                      ] as const
                    ).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAbaOnline(id)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                          abaOnline === id ? 'text-white shadow-sm' : 'text-gray-600'
                        }`}
                        style={abaOnline === id ? { backgroundColor: VERDE } : undefined}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {erro ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
                  {erro}
                </p>
              ) : null}

              {buscando ? (
                <p className="animate-pulse py-6 text-center text-sm text-gray-400">…</p>
              ) : null}

              {!buscando &&
              etapa === 'manual' &&
              termo.trim().length >= 2 &&
              resultados.length === 0 &&
              !erro ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  {t('ecossistemaSemResultados')}
                </p>
              ) : null}

              {!buscando &&
              etapa === 'algoritmo' &&
              resultados.length > 0 &&
              resultadosOnlineFiltrados.length === 0 &&
              !erro ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  {t('ecossistemaSemOnlineAba')}
                </p>
              ) : null}

              <ul className="space-y-2">
                {(etapa === 'algoritmo' ? resultadosOnlineFiltrados : resultados).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => escolher(p)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm ring-1 ring-black/5"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
                        {p.foto_url ? (
                          <AvatarImage
                            src={p.foto_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#0097b2]">
                            {p.nome.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{p.nome}</p>
                        {p.username ? (
                          <p className="truncate text-xs text-gray-500">@{p.username}</p>
                        ) : null}
                        <p className="truncate text-xs text-gray-400">
                          {rotuloCategoriaProfissionalRecomendacao(p.categorias)}
                          {p.online ? ` · ${t('statusOnline')}` : ''}
                          {p.distancia_km != null ? ` · ${p.distancia_km} km` : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
