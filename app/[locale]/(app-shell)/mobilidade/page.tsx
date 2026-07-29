'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Car, MapPin, Navigation } from 'lucide-react'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import FiltrosMapaMobilidade from '@/components/mobilidade/FiltrosMapaMobilidade'
import PopupPesquisaMobilidade from '@/components/mobilidade/PopupPesquisaMobilidade'
import CabecalhoMobilidadeLogoOuToggle from '@/components/mobilidade/CabecalhoMobilidadeLogoOuToggle'
import OfertaMobilidadeListener from '@/components/mobilidade/OfertaMobilidadeListener'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import { supabase } from '@/lib/supabase'
import {
  buildMobilidadePesquisaHref,
  parseMobilidadePesquisaSearchParams,
  pontoPreenchido,
} from '@/lib/mobilidadePesquisaParams'
import {
  buscarEmpresasMapaMobilidade,
  filtrarEmpresasMapa,
  FILTRO_CIDADE_OPCOES,
  type EmpresaMapaMobilidade,
} from '@/lib/mobilidadeMapaEmpresas'
import {
  CIDADE_POR_PAIS_GUIA,
  type PaisGuiaFiltro,
  type SegmentoEmpresaSlug,
} from '@/lib/segmentosEmpresaGuia'
import type { ProfissionalOnlineMapa } from '@/lib/mobilidadeStatusProfissional'

const MapaMobilidade = dynamic(() => import('@/components/mobilidade/MapaMobilidade'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#e8f4f6] text-sm text-gray-500">
      Carregando mapa…
    </div>
  ),
})

function abaGuiaCls(ativo: boolean) {
  return `flex min-w-0 flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

function MobilidadePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('Mobilidade')
  const tGuia = useTranslations('Guia')
  const { perfilEhProfissional, perfilEhTurista, recursosProfissionaisLiberados, loading } =
    useProfissionalGate()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
    loading: gateLoading,
  } = useGateComprasReservas()

  const pesquisa = useMemo(
    () => parseMobilidadePesquisaSearchParams(searchParams),
    [searchParams],
  )

  const [empresas, setEmpresas] = useState<EmpresaMapaMobilidade[]>([])
  const [empresasErro, setEmpresasErro] = useState<string | null>(null)
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)
  const [profissionaisOnline, setProfissionaisOnline] = useState<ProfissionalOnlineMapa[]>([])
  const [cidadePais, setCidadePais] = useState<PaisGuiaFiltro | null>(null)
  const [segmentos, setSegmentos] = useState<SegmentoEmpresaSlug[]>([])
  const [gpsCentro, setGpsCentro] = useState<{ lat: number; lng: number } | null>(null)
  const [popupAberto, setPopupAberto] = useState(false)

  useEffect(() => {
    if (pesquisa.abrirPesquisa) setPopupAberto(true)
  }, [pesquisa.abrirPesquisa])

  const fecharPopupPesquisa = () => {
    setPopupAberto(false)
    router.replace(
      buildMobilidadePesquisaHref({
        origem: pesquisa.origem,
        destino: pesquisa.destino,
        destinoEmpresaId: pesquisa.destinoEmpresaId,
        abrirPesquisa: false,
      }),
    )
  }

  const abrirPopupPesquisa = () => {
    setPopupAberto(true)
    router.replace(
      buildMobilidadePesquisaHref({
        origem: pesquisa.origem,
        destino: pesquisa.destino,
        destinoEmpresaId: pesquisa.destinoEmpresaId,
        abrirPesquisa: true,
      }),
    )
  }

  useEffect(() => {
    if (!perfilEhTurista || gateLoading || podeComprarReservar) return
    avisarBloqueio()
  }, [perfilEhTurista, gateLoading, podeComprarReservar, avisarBloqueio])

  useEffect(() => {
    let ativo = true
    void (async () => {
      setCarregandoEmpresas(true)
      const { lista, error } = await buscarEmpresasMapaMobilidade(supabase)
      if (!ativo) return
      setEmpresas(lista)
      setEmpresasErro(error)
      setCarregandoEmpresas(false)
    })()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true
    const load = async () => {
      try {
        const res = await fetch('/api/mobilidade/profissionais-online')
        const json = (await res.json()) as { profissionais?: ProfissionalOnlineMapa[] }
        if (!ativo || !res.ok) return
        setProfissionaisOnline(Array.isArray(json.profissionais) ? json.profissionais : [])
      } catch {
        /* ignore */
      }
    }
    void load()
    const id = setInterval(() => void load(), 45_000)
    return () => {
      ativo = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (pesquisa.origem.lat != null && pesquisa.origem.lng != null) {
      setGpsCentro({ lat: pesquisa.origem.lat, lng: pesquisa.origem.lng })
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCentro({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        /* mantém fallback do mapa */
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }, [pesquisa.origem.lat, pesquisa.origem.lng])

  const cidadeFiltro =
    cidadePais != null
      ? FILTRO_CIDADE_OPCOES.find((o) => o.pais === cidadePais)?.cidade ?? CIDADE_POR_PAIS_GUIA[cidadePais]
      : null

  const empresasFiltradas = useMemo(
    () =>
      filtrarEmpresasMapa(empresas, {
        cidade: cidadeFiltro,
        segmentos: segmentos.length ? segmentos : null,
      }),
    [empresas, cidadeFiltro, segmentos],
  )

  const destinoPonto = useMemo(() => {
    if (pesquisa.destino.lat != null && pesquisa.destino.lng != null) {
      return {
        lat: pesquisa.destino.lat,
        lng: pesquisa.destino.lng,
        label: pesquisa.destino.nome || undefined,
      }
    }
    if (pesquisa.destinoEmpresaId) {
      const emp = empresas.find((e) => e.id === pesquisa.destinoEmpresaId)
      if (emp) return { lat: emp.latitude, lng: emp.longitude, label: emp.nome_fantasia }
    }
    return null
  }, [pesquisa, empresas])

  const origemPonto =
    pesquisa.origem.lat != null && pesquisa.origem.lng != null
      ? {
          lat: pesquisa.origem.lat,
          lng: pesquisa.origem.lng,
          label: pesquisa.origem.nome || undefined,
        }
      : gpsCentro
        ? { ...gpsCentro, label: t('origemGpsLabel') }
        : null

  if (perfilEhProfissional && (loading || !recursosProfissionaisLiberados)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <AvisoDocsProfissionalBloqueado />
      </div>
    )
  }

  if (perfilEhTurista && !gateLoading && !podeComprarReservar) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start bg-gray-50 px-4 py-10 text-center">
          <p className="text-sm text-gray-600">{t('gateBloqueio')}</p>
        </div>
        <PopupAvisoBloqueioConta
          aberto={avisoAberto || Boolean(mensagemBloqueio)}
          onFechar={() => {
            fecharAvisoBloqueio()
            router.replace('/guia')
          }}
          titulo={tituloBloqueio}
          mensagem={mensagemBloqueio}
        />
      </>
    )
  }

  const temPesquisa =
    pontoPreenchido(pesquisa.origem) ||
    pontoPreenchido(pesquisa.destino) ||
    Boolean(pesquisa.destinoEmpresaId)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <header className="shrink-0 bg-[#0097b2] pt-safe">
        <CabecalhoMobilidadeLogoOuToggle compact />
        <div className="flex w-full border-b border-gray-200 bg-white">
          <button type="button" onClick={() => router.push('/guia')} className={abaGuiaCls(false)}>
            <MapPin className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </button>
          <button type="button" className={abaGuiaCls(true)} aria-current="page">
            <Car className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabMobilidade')}</span>
          </button>
        </div>
        <div className="px-3 py-2">
          <FiltrosMapaMobilidade
            cidadePais={cidadePais}
            onCidadePais={setCidadePais}
            segmentos={segmentos}
            onSegmentos={setSegmentos}
          />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute inset-0">
          {carregandoEmpresas ? (
            <div className="flex h-full items-center justify-center bg-[#e8f4f6] text-sm text-gray-500">
              {t('carregandoPins')}
            </div>
          ) : (
            <MapaMobilidade
              empresas={empresasFiltradas}
              profissionais={profissionaisOnline}
              centro={gpsCentro}
              origem={origemPonto}
              destino={destinoPonto}
            />
          )}
        </div>

        {empresasErro ? (
          <p className="relative z-10 mx-3 mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {empresasErro}
          </p>
        ) : null}

        {temPesquisa && !popupAberto ? (
          <div className="relative z-10 mx-3 mt-2 rounded-2xl bg-white/95 p-3 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0097b2]">
              {t('resumoPesquisa')}
            </p>
            <div className="mt-2 space-y-1.5 text-sm text-gray-800">
              <p className="flex gap-2">
                <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                <span className="min-w-0 truncate">
                  <span className="text-gray-500">{t('origemLabel')}: </span>
                  {pesquisa.origem.nome ||
                    (pesquisa.origem.lat != null
                      ? `${pesquisa.origem.lat.toFixed(4)}, ${pesquisa.origem.lng?.toFixed(4)}`
                      : '—')}
                </span>
              </p>
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                <span className="min-w-0 truncate">
                  <span className="text-gray-500">{t('destinoLabel')}: </span>
                  {pesquisa.destino.nome ||
                    (pesquisa.destinoEmpresaId
                      ? empresas.find((e) => e.id === pesquisa.destinoEmpresaId)?.nome_fantasia ||
                        t('destinoEmpresa')
                      : pesquisa.destino.lat != null
                        ? `${pesquisa.destino.lat.toFixed(4)}, ${pesquisa.destino.lng?.toFixed(4)}`
                        : '—')}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={abrirPopupPesquisa}
              className="mt-3 w-full rounded-xl bg-[#00D443] py-2.5 text-sm font-bold uppercase text-white"
            >
              {t('pesquisar')}
            </button>
          </div>
        ) : null}

        <PopupPesquisaMobilidade
          aberto={popupAberto}
          onFechar={fecharPopupPesquisa}
          pesquisa={pesquisa}
          destinoCidadeEmpresa={
            pesquisa.destinoEmpresaId
              ? empresas.find((e) => e.id === pesquisa.destinoEmpresaId)?.cidade ?? null
              : null
          }
          destinoNomeEmpresa={
            pesquisa.destinoEmpresaId
              ? empresas.find((e) => e.id === pesquisa.destinoEmpresaId)?.nome_fantasia ?? null
              : null
          }
        />
      </main>
      <OfertaMobilidadeListener />
    </div>
  )
}

export default function MobilidadePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-50">
          <p className="animate-pulse text-sm text-gray-400">…</p>
        </div>
      }
    >
      <MobilidadePageInner />
    </Suspense>
  )
}
