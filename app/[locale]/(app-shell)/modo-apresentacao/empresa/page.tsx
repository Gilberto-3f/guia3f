'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, ChevronDown, ChevronUp, FileText, Globe2, MapPin, Star } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { getIconeAbaServico, getRotuloAbaServico } from '@/lib/empresaCategoria'
import { useEmpresaPreviewDraft } from '@/hooks/useEmpresaPreviewDraft'
import EmpresaPreviewEditorDrawer from '@/components/empresa/EmpresaPreviewEditorDrawer'

import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
import Username from '@/components/Username'
import FotoHero from '@/components/FotoHero'
import NomeEmpresa from '@/components/NomeEmpresa'
import BotaoSeguir from '@/components/BotaoSeguir'
import ContadorSeguidores from '@/components/ContadorSeguidores'
import NotaMedia from '@/components/NotaMedia'
import StatusAtendimento from '@/components/StatusAtendimento'
import DescricaoLonga from '@/components/DescricaoLonga'
import AbaAvaliacoes from '@/components/AbaAvaliacoes'
import AbaEndereco from '@/components/AbaEndereco'
import AbaBotaoDinamico from '@/components/AbaBotaoDinamico'
import AbaFotosEmpresa from '@/components/empresa/AbaFotosEmpresa'
import AbaPostsEmpresa from '@/components/empresa/AbaPostsEmpresa'
import AbaTour360Empresa from '@/components/empresa/AbaTour360Empresa'
import { parseTourConfig, sincronizarTourComFotos } from '@/lib/pannellumTour'

type GateState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'sim_sem_empresa' }
  | { status: 'allowed'; userId: string; empresaId: string }

function asHorarios(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const p = JSON.parse(value)
      return typeof p === 'object' && p !== null ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}

function asJsonArray(v: unknown) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string')
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

export default function EmpresaPreviewModoApresentacaoPage() {
  const router = useRouter()
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()

  const [gate, setGate] = useState<GateState>({ status: 'loading' })
  const [empresaBase, setEmpresaBase] = useState<Record<string, unknown> | null>(null)
  const [loadingEmpresa, setLoadingEmpresa] = useState(true)
  const [abaExpandida, setAbaExpandida] = useState<null | 'avaliacoes' | 'endereco' | 'dinamico'>(null)
  const [subAbaAtiva, setSubAbaAtiva] = useState<'fotos' | 'posts' | 'tour360'>('fotos')
  const [menuAberto, setMenuAberto] = useState(false)

  const { draft, salvar, limpar } = useEmpresaPreviewDraft({
    userId: gate.status === 'allowed' ? gate.userId : null,
    empresaId: gate.status === 'allowed' ? gate.empresaId : null,
  })

  useEffect(() => {
    let ativo = true

    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) {
        if (ativo) setGate({ status: 'forbidden' })
        return
      }

      const { data: row } = await supabase
        .from('usuarios')
        .select('role, admin_level')
        .eq('id', uid)
        .maybeSingle()
      const role = row?.role != null ? String(row.role) : null
      const adminLevel = typeof row?.admin_level === 'number' ? row.admin_level : 0

      const isAdminGeral = role === 'admin' && adminLevel === 1
      if (!isAdminGeral) {
        if (ativo) setGate({ status: 'forbidden' })
        return
      }

      const okModo = modoAtivo && perfilSimulado?.tipo === 'empresa'
      if (!okModo || !contextoEmpresaId) {
        if (ativo) setGate({ status: 'sim_sem_empresa' })
        return
      }

      if (ativo) setGate({ status: 'allowed', userId: uid, empresaId: String(contextoEmpresaId) })
    }

    void boot()
    return () => {
      ativo = false
    }
  }, [contextoEmpresaId, modoAtivo, perfilSimulado?.tipo])

  useEffect(() => {
    if (gate.status === 'forbidden') router.push('/guia')
  }, [gate.status, router])

  const carregarEmpresa = useCallback(async (empresaId: string) => {
    setLoadingEmpresa(true)
    try {
      const { data: empresaData, error } = await supabase.from('empresas').select('*').eq('id', empresaId).single()
      if (error || !empresaData) {
        setEmpresaBase(null)
        return
      }
      setEmpresaBase({
        ...empresaData,
        horarios: asHorarios(empresaData.horarios),
        fotos_url: asJsonArray(empresaData.fotos_url),
        fotos_360_url: asJsonArray(empresaData.fotos_360_url),
        tour_config: parseTourConfig(empresaData.tour_config),
      })
    } finally {
      setLoadingEmpresa(false)
    }
  }, [])

  useEffect(() => {
    if (gate.status !== 'allowed') return
    void carregarEmpresa(gate.empresaId)
  }, [carregarEmpresa, gate.status, gate])

  const empresaMerged = useMemo(() => {
    if (!empresaBase) return null
    const merged = { ...empresaBase, ...(draft ?? {}) } as Record<string, unknown>
    return merged
  }, [draft, empresaBase])

  const fotos360ListaPreview = empresaMerged ? asJsonArray(empresaMerged.fotos_360_url) : []
  const tourConfigPreview = empresaMerged
    ? sincronizarTourComFotos(fotos360ListaPreview, parseTourConfig(empresaMerged.tour_config))
    : { firstScene: null, cenas: [] }
  const empresaUsuarioIdPostsPreview =
    empresaMerged?.usuario_id != null ? String(empresaMerged.usuario_id) : null

  if (gate.status === 'sim_sem_empresa') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <p className="max-w-md text-[#001f3f]">
          Para pré-visualizar a página da empresa, ative o modo apresentação como <b>Empresa</b> e escolha um segmento (é criada uma empresa de demonstração só sua, invisível para outros utilizadores).
        </p>
        <Link href="/perfil" className="rounded-full bg-[#0097b2] px-6 py-3 font-semibold text-white hover:opacity-95">
          Ir para o perfil (Modo Apresentação)
        </Link>
        <Link href="/guia" className="text-sm font-semibold text-gray-600 hover:text-gray-800">
          Voltar ao guia
        </Link>
      </div>
    )
  }

  if (gate.status !== 'allowed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0097b2]">
        <div className="text-white">{gate.status === 'loading' ? 'Carregando...' : 'Redirecionando...'}</div>
      </div>
    )
  }

  if (loadingEmpresa) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando empresa…</div>
      </div>
    )
  }

  if (!empresaMerged) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <p className="text-gray-500">Empresa não encontrada</p>
        <button type="button" onClick={() => router.back()} className="mt-4 text-[#0097b2]">
          Voltar
        </button>
      </div>
    )
  }

  const empresaId = gate.empresaId
  const nomeFantasia = String(empresaMerged.nome_fantasia ?? '')
  const nomeUsuario = String(empresaMerged.nome_usuario ?? '')
  const fotoUrl = empresaMerged.foto_url ? String(empresaMerged.foto_url) : null
  const descLonga = empresaMerged.descricao_longa != null ? String(empresaMerged.descricao_longa) : null
  const notaMedia = Number(empresaMerged.nota_media) || 0
  const totalAval = Number(empresaMerged.total_avaliacoes) || 0
  const totalSeg = Number(empresaMerged.total_seguidores) || 0
  const categoria = String(empresaMerged.categoria ?? '')
  const rotuloServico = getRotuloAbaServico(categoria)
  const IconeAbaServico = getIconeAbaServico(categoria)

  const precoTicketInteira = Number(empresaMerged.preco_ticket_inteira) || 0
  const precoTicketMeia = Number(empresaMerged.preco_ticket_meia) || 0
  const precoDiaria = Number(empresaMerged.preco_diaria) || 0

  type HorariosMap = Record<string, { abre: string; fecha: string; fechado: boolean }>
  const horariosParsed = asHorarios(empresaMerged.horarios) as HorariosMap

  const latRaw = empresaMerged.latitude
  const lngRaw = empresaMerged.longitude
  const latitude =
    latRaw == null || typeof latRaw === 'object' ? null : typeof latRaw === 'number' ? latRaw : Number(latRaw)
  const longitude =
    lngRaw == null || typeof lngRaw === 'object' ? null : typeof lngRaw === 'number' ? lngRaw : Number(lngRaw)

  const toggleAba = (aba: 'avaliacoes' | 'endereco' | 'dinamico') => {
    setAbaExpandida((atual) => (atual === aba ? null : aba))
  }

  const empresaEndereco = {
    id: empresaId,
    endereco: String(empresaMerged.endereco ?? ''),
    bairro: empresaMerged.bairro != null ? String(empresaMerged.bairro) : null,
    cidade: String(empresaMerged.cidade ?? ''),
    latitude: Number.isFinite(latitude ?? NaN) ? (latitude as number) : null,
    longitude: Number.isFinite(longitude ?? NaN) ? (longitude as number) : null,
    telefone: empresaMerged.telefone != null ? String(empresaMerged.telefone) : null,
    whatsapp: empresaMerged.whatsapp != null ? String(empresaMerged.whatsapp) : null,
    website: empresaMerged.website != null ? String(empresaMerged.website) : null,
    redes_sociais: empresaMerged.redes_sociais,
    horarios: horariosParsed,
    nome_fantasia: nomeFantasia,
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Username username={nomeUsuario} />
          </div>
          <BotaoAbrirMenuLateral
            onClick={() => setMenuAberto(true)}
            className="shrink-0 rounded-full bg-black/5 px-2.5 py-2 text-gray-900 hover:bg-black/10"
          />
        </div>
      </div>

      <FotoHero fotoUrl={fotoUrl} nome={nomeFantasia} />

      <div className="border-b border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <NomeEmpresa
            nome={nomeFantasia}
            verificado={
              Boolean(empresaMerged.docs_verificado) || String(empresaMerged.status ?? '') === 'ativo'
            }
          />
          <BotaoSeguir empresaId={empresaId} isFollowing={false} onToggle={() => {}} />
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <ContadorSeguidores empresaId={empresaId} total={totalSeg} />
          <NotaMedia nota={notaMedia} total={totalAval} />
          <StatusAtendimento horarios={empresaEndereco.horarios} />
        </div>

        <DescricaoLonga descricao={descLonga} />
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="flex">
          <button
            type="button"
            onClick={() => toggleAba('avaliacoes')}
            aria-label="Avaliações"
            aria-expanded={abaExpandida === 'avaliacoes'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors ${
              abaExpandida === 'avaliacoes' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <Star className="h-4 w-4 shrink-0" aria-hidden />
            {abaExpandida === 'avaliacoes' ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => toggleAba('endereco')}
            aria-label="Endereço"
            aria-expanded={abaExpandida === 'endereco'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors ${
              abaExpandida === 'endereco' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {abaExpandida === 'endereco' ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => toggleAba('dinamico')}
            aria-label={rotuloServico}
            aria-expanded={abaExpandida === 'dinamico'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium transition-colors ${
              abaExpandida === 'dinamico' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <IconeAbaServico className="h-4 w-4 shrink-0" aria-hidden />
            {abaExpandida === 'dinamico' ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
          </button>
        </div>
      </div>

      {abaExpandida ? (
        <div className="px-4 pt-4 pb-0">
          {abaExpandida === 'avaliacoes' ? (
            <AbaAvaliacoes
              empresaId={empresaId}
              podeResponder={false}
              empresaUsuarioId={empresaMerged.usuario_id != null ? String(empresaMerged.usuario_id) : null}
              empresaVerificada={
                Boolean(empresaMerged.docs_verificado) || String(empresaMerged.status ?? '') === 'ativo'
              }
            />
          ) : null}
          {abaExpandida === 'endereco' ? <AbaEndereco empresa={empresaEndereco} /> : null}
          {abaExpandida === 'dinamico' ? (
            <AbaBotaoDinamico
              categoria={categoria}
              empresaId={empresaId}
              empresaNome={nomeFantasia}
              cidade={String(empresaMerged.cidade ?? '')}
              horarios={horariosParsed}
              whatsapp={empresaMerged.whatsapp != null ? String(empresaMerged.whatsapp) : null}
              precoTicketInteira={precoTicketInteira}
              precoTicketMeia={precoTicketMeia}
              precoDiaria={precoDiaria}
            />
          ) : null}
        </div>
      ) : null}

      {abaExpandida == null ? (
        <div className="border-b border-gray-100 bg-white p-4">
          <div className="flex border-b border-[#E0E0E0] bg-white px-2">
            <button
              type="button"
              onClick={() => setSubAbaAtiva('fotos')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'fotos' ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
              }`}
            >
              <Camera size={18} aria-hidden />
              <span>FOTOS</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('posts')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'posts' ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
              }`}
            >
              <FileText size={18} aria-hidden />
              <span>POSTS</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('tour360')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'tour360' ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
              }`}
            >
              <Globe2 size={18} aria-hidden />
              <span>TOUR 360°</span>
            </button>
          </div>

          <div className="min-h-0">
            {subAbaAtiva === 'fotos' ? (
              <AbaFotosEmpresa
                empresaUsuarioId={empresaUsuarioIdPostsPreview}
                nomeFantasia={nomeFantasia}
                nomeUsuario={nomeUsuario}
                fotoPerfilUrl={fotoUrl}
              />
            ) : null}
            {subAbaAtiva === 'posts' ? <AbaPostsEmpresa empresaUsuarioId={empresaUsuarioIdPostsPreview} /> : null}
            {subAbaAtiva === 'tour360' ? (
              <AbaTour360Empresa fotos360Url={fotos360ListaPreview} tourConfig={tourConfigPreview} />
            ) : null}
          </div>
        </div>
      ) : null}

      <EmpresaPreviewEditorDrawer
        aberto={menuAberto}
        onClose={() => setMenuAberto(false)}
        empresaBase={empresaBase}
        draft={draft}
        onSalvar={salvar}
        onLimpar={limpar}
      />
    </div>
  )
}

