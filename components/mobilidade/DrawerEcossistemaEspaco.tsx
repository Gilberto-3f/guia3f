'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bus,
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
import { listarDatasDoMes } from '@/lib/hospedagemCalendario'
import {
  corStatusDiaMobilidade,
  statusDiaMobilidade,
  type BloqueioMobilidade,
} from '@/lib/mobilidadeBloqueiosCalendario'
import { rotuloCategoriaProfissionalRecomendacao } from '@/lib/recomendarProfissional'
import type { ProfissionalEcossistemaRow } from '@/app/api/profissional/buscar-ecossistema/route'
import type { ClienteEcossistemaRow } from '@/app/api/profissional/buscar-cliente-ecossistema/route'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  aberto: boolean
  onFechar: () => void
  /** Após solicitação direcionada com sucesso — fecha Ecossistema e abre Histórico. */
  onSolicitadoSucesso?: () => void
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
export default function DrawerEcossistemaEspaco({
  aberto,
  onFechar,
  onSolicitadoSucesso,
}: Props) {
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
  const [bloqueios, setBloqueios] = useState<BloqueioMobilidade[]>([])
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [agendaMsg, setAgendaMsg] = useState('')
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
    setBloqueios([])
    setAgendaMsg('')
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

  const carregarAgenda = useCallback(
    async (profId: string) => {
      setAgendaLoading(true)
      setAgendaMsg('')
      setBloqueios([])
      try {
        const res = await fetch(
          `/api/mobilidade/disponibilidade?profissional_id=${encodeURIComponent(profId)}`,
        )
        const json = (await res.json()) as {
          bloqueios?: BloqueioMobilidade[]
          placa_vermelha?: boolean
          mensagem?: string
          error?: string
        }
        if (!res.ok) {
          setAgendaMsg(String(json.error ?? t('ecossistemaErroAgenda')))
          return
        }
        setBloqueios(Array.isArray(json.bloqueios) ? json.bloqueios : [])
      } catch {
        setAgendaMsg(t('ecossistemaErroAgenda'))
      } finally {
        setAgendaLoading(false)
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
    setErroAgenda('')
    setBloqueios([])
    setAgendaMsg('')
  }

  const selecionarTipoAtendimento = (tipo: 'imediato' | 'pre') => {
    setTipoAtendimento(tipo)
    setErroAgenda('')
    if (tipo === 'imediato') {
      setDiaSlot(null)
      return
    }
    if (selecionado) {
      void carregarAgenda(selecionado.id)
    }
  }

  const avancarParaCliente = () => {
    if (!tipoAtendimento) {
      setErroAgenda(t('ecossistemaEscolhaTipo'))
      return
    }
    if (tipoAtendimento === 'pre' && !diaSlot) {
      setErroAgenda(t('ecossistemaEscolhaData'))
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

  const bloqueadosSet = useMemo(() => {
    const s = new Set<string>()
    for (const b of bloqueios) {
      const d = String(b.data).slice(0, 10)
      if (d) s.add(d)
    }
    return s
  }, [bloqueios])

  const cells = useMemo(() => listarDatasDoMes(ano, mes), [ano, mes])
  const tituloMes = useMemo(
    () =>
      new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [ano, mes],
  )

  const dataAgendadaIso = useMemo(() => {
    if (tipoAtendimento !== 'pre' || !diaSlot) return null
    // Meio-dia local — evita falhar o mínimo de 2h em dias futuros.
    return `${diaSlot}T12:00:00`
  }, [tipoAtendimento, diaSlot])

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
      onSolicitadoSucesso?.()
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
      setBloqueios([])
      setAgendaMsg('')
      setDiaSlot(null)
      setFaseParceiro('agenda')
      setClienteSel(null)
      setTipoAtendimento(null)
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
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  {agendaLoading ? (
                    <p className="animate-pulse py-6 text-center text-sm text-gray-400">…</p>
                  ) : (
                    <>
                      {agendaMsg ? (
                        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                          {agendaMsg}
                        </p>
                      ) : null}

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
                          const st = statusDiaMobilidade(iso, bloqueadosSet, hoje)
                          const clicavel = st === 'livre'
                          const textColor = st === 'passado' ? '#666666' : '#ffffff'
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
                                backgroundColor: corStatusDiaMobilidade(st),
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

                      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#00D443]" aria-hidden />
                          {t('calendarioLegendaLivre')}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#0097b2]" aria-hidden />
                          {t('calendarioLegendaBloqueado')}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#c4c4c4]" aria-hidden />
                          {t('calendarioLegendaPassado')}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">{t('calendarioHintLegenda')}</p>
                    </>
                  )}
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
                  <div className="flex flex-col items-center text-center">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {clienteSel.foto_url ? (
                        <AvatarImage
                          src={clienteSel.foto_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#0097b2]">
                          {clienteSel.nome.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold text-gray-900">{clienteSel.nome}</p>
                    {clienteSel.username ? (
                      <p className="mt-0.5 text-xs text-gray-500">@{clienteSel.username}</p>
                    ) : null}
                  </div>

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
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-[#0097b2]">
                    {t('ecossistemaLocalizeCliente')}
                  </p>

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
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#0097b2]">
                    {t('ecossistemaLocalizeParceiro')}
                  </p>
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
                </div>
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
