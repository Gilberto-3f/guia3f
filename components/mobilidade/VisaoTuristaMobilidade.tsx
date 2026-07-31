'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import PopupPesquisaMobilidade from '@/components/mobilidade/PopupPesquisaMobilidade'
import CardParaOndeMobilidade from '@/components/mobilidade/CardParaOndeMobilidade'
import OfertaMobilidadeListener from '@/components/mobilidade/OfertaMobilidadeListener'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import {
  buildMobilidadePesquisaHref,
  parseMobilidadePesquisaSearchParams,
  pontoPreenchido,
  type MobilidadePonto,
} from '@/lib/mobilidadePesquisaParams'
import { type EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'
import type { ProfissionalOnlineMapa } from '@/lib/mobilidadeStatusProfissional'
import {
  parseCidadesAtuacaoProf,
  type VisitanteParceriaMapa,
} from '@/lib/mobilidadeMapaVisitante'
import { resolverContextoMapaMobilidade } from '@/lib/parceriaMapaMobilidade'
import { reverseGeocodeMapbox } from '@/lib/mapboxReverseGeocode'

const MapaMobilidade = dynamic(() => import('@/components/mobilidade/MapaMobilidade'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[240px] items-center justify-center bg-[#d8eef2] text-sm text-gray-600">
      Carregando mapa…
    </div>
  ),
})

type Props = {
  /** Se false, omite OfertaMobilidadeListener (já no layout pai). */
  comListener?: boolean
  className?: string
}

/**
 * Visão turista/empresa/ADM: card no topo + mapa ocupando o restante (fluxo normal, não absolute).
 */
export default function VisaoTuristaMobilidade({ comListener = true, className = '' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('Mobilidade')
  const { perfilEhTurista, perfilEhProfissional } = useProfissionalGate()

  const pesquisa = useMemo(
    () => parseMobilidadePesquisaSearchParams(searchParams),
    [searchParams],
  )

  const [empresas, setEmpresas] = useState<EmpresaMapaMobilidade[]>([])
  const [empresasErro, setEmpresasErro] = useState<string | null>(null)
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true)
  const [profissionaisOnline, setProfissionaisOnline] = useState<ProfissionalOnlineMapa[]>([])
  const [visitanteParceria, setVisitanteParceria] = useState<VisitanteParceriaMapa | null>(null)
  const [gpsCentro, setGpsCentro] = useState<{ lat: number; lng: number } | null>(null)
  const [origemLabelGps, setOrigemLabelGps] = useState<string | null>(null)
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
        recomendacaoId: pesquisa.recomendacaoId,
        profissionalUsuarioId: pesquisa.profissionalUsuarioId,
        abrirPesquisa: false,
      }),
    )
  }

  useEffect(() => {
    if (!perfilEhProfissional) {
      setVisitanteParceria(null)
      return
    }
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || !ativo) return
      const { data: prof } = await supabase
        .from('profissionais')
        .select('placa_vermelha, categorias, cidade_atuacao')
        .eq('usuario_id', uid)
        .maybeSingle()
      if (!ativo) return
      if (!prof) {
        setVisitanteParceria(null)
        return
      }
      setVisitanteParceria({
        placaVermelha: Boolean(prof.placa_vermelha),
        categorias: Array.isArray(prof.categorias)
          ? prof.categorias.filter((c): c is string => typeof c === 'string')
          : [],
        cidadesAtuacao: parseCidadesAtuacaoProf(prof.cidade_atuacao),
      })
    })()
    return () => {
      ativo = false
    }
  }, [perfilEhProfissional])

  useEffect(() => {
    let ativo = true
    void (async () => {
      setCarregandoEmpresas(true)
      try {
        const res = await fetch('/api/mobilidade/empresas-mapa')
        const json = (await res.json()) as {
          empresas?: EmpresaMapaMobilidade[]
          error?: string
        }
        if (!ativo) return
        if (!res.ok) {
          setEmpresas([])
          setEmpresasErro(String(json.error ?? 'Falha ao carregar atrativos.'))
        } else {
          setEmpresas(Array.isArray(json.empresas) ? json.empresas : [])
          setEmpresasErro(null)
        }
      } catch {
        if (!ativo) return
        setEmpresas([])
        setEmpresasErro('Falha de rede ao carregar atrativos.')
      } finally {
        if (ativo) setCarregandoEmpresas(false)
      }
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
      const nome = String(pesquisa.origem.nome ?? '').trim()
      if (nome) setOrigemLabelGps(nome)
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setGpsCentro({ lat, lng })
        void reverseGeocodeMapbox(lat, lng).then((addr) => {
          if (addr) setOrigemLabelGps(addr)
        })
      },
      () => {
        /* mantém fallback do mapa */
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }, [pesquisa.origem.lat, pesquisa.origem.lng, pesquisa.origem.nome])

  const contextoMapa = useMemo(() => {
    if (perfilEhTurista) return 'turista' as const
    if (!perfilEhProfissional || !visitanteParceria) return null
    return resolverContextoMapaMobilidade({
      perfilEhTurista: false,
      perfilEhProfissional: true,
      visitantePlacaVermelha: visitanteParceria.placaVermelha,
      visitanteCategorias: visitanteParceria.categorias,
    })
  }, [perfilEhTurista, perfilEhProfissional, visitanteParceria])

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
          label: pesquisa.origem.nome || origemLabelGps || undefined,
        }
      : gpsCentro
        ? { ...gpsCentro, label: origemLabelGps || undefined }
        : null

  const origemInicialCard: MobilidadePonto | null =
    pesquisa.origem.lat != null
      ? pesquisa.origem
      : gpsCentro
        ? {
            nome: origemLabelGps || '',
            lat: gpsCentro.lat,
            lng: gpsCentro.lng,
          }
        : null

  const destinoInicialCard: MobilidadePonto | null = pontoPreenchido(pesquisa.destino)
    ? pesquisa.destino
    : pesquisa.destinoEmpresaId
      ? {
          nome:
            empresas.find((e) => e.id === pesquisa.destinoEmpresaId)?.nome_fantasia ||
            t('destinoEmpresa'),
          lat: destinoPonto?.lat ?? null,
          lng: destinoPonto?.lng ?? null,
        }
      : null

  return (
    <div
      className={`relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#e8f4f6] ${className}`}
    >
      {/* Mapa full-bleed — até a bottom bar; card flutua por cima. */}
      <div className="absolute inset-0 z-0">
        <MapaMobilidade
          empresas={empresas}
          profissionais={profissionaisOnline}
          centro={gpsCentro}
          origem={origemPonto}
          destino={destinoPonto}
          contextoMapa={contextoMapa ?? 'turista'}
          visitanteParceria={visitanteParceria}
        />
        {carregandoEmpresas ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5] flex justify-center">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-gray-600 shadow">
              {t('carregandoPins')}
            </span>
          </div>
        ) : null}
      </div>

      {/* Overlay: card flutuante (não empurra o mapa ao abrir). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2">
        {empresasErro ? (
          <p className="pointer-events-auto mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {empresasErro}
          </p>
        ) : null}
        <div className="pointer-events-auto mx-auto w-full max-w-lg">
          <CardParaOndeMobilidade
            origemInicial={origemInicialCard}
            destinoInicial={destinoInicialCard}
            expandidoInicial={
              Boolean(pesquisa.abrirPesquisa) ||
              pontoPreenchido(pesquisa.destino) ||
              Boolean(pesquisa.destinoEmpresaId)
            }
            onOrigemChange={(p) => {
              if (p.lat != null && p.lng != null) {
                setGpsCentro({ lat: p.lat, lng: p.lng })
                if (p.nome) setOrigemLabelGps(p.nome)
              }
            }}
          />
        </div>
      </div>

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

      {comListener ? <OfertaMobilidadeListener /> : null}
    </div>
  )
}
