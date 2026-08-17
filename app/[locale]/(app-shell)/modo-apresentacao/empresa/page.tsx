'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, FileText, Globe2, MapPin, Star } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { getIconeAbaServico, getRotuloAbaServico } from '@/lib/empresaCategoria'
import { useEmpresaPreviewDraft } from '@/hooks/useEmpresaPreviewDraft'
import EmpresaPreviewEditorDrawer from '@/components/empresa/EmpresaPreviewEditorDrawer'

import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { bandeiraProfissionalRegistro } from '@/lib/bandeiraProfissional'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import FotoCapa from '@/components/perfil/FotoCapa'
import NomeSocial from '@/components/perfil/NomeSocial'
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
  const nomeUsuarioRaw = nomeUsuario.trim().replace(/^@+/, '')
  const usernameHeaderClass = `block min-w-0 max-w-[min(50vw,320px)] truncate font-normal text-white ${
    nomeUsuarioRaw.length > 10 ? 'text-[16px]' : 'text-[17px]'
  }`
  const empresaVerificada = contaVerificadaDocumentacao('empresa', empresaMerged)
  const bandeiraPais = bandeiraProfissionalRegistro({
    cidadeAtuacao: String(empresaMerged.cidade ?? ''),
  })
  const fotoUrl = empresaMerged.foto_url ? String(empresaMerged.foto_url) : null
  const descLonga = empresaMerged.descricao_longa != null ? String(empresaMerged.descricao_longa) : null
  const notaMedia = Number(empresaMerged.nota_media) || 0
  const categoria = String(empresaMerged.categoria ?? '')
  const rotuloServico = getRotuloAbaServico(categoria)
  const IconeAbaServico = getIconeAbaServico(categoria)

  const precoTicketInteira = Number(empresaMerged.preco_ticket_inteira) || 0
  const precoTicketMeia = Number(empresaMerged.preco_ticket_meia) || 0

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
    <div className="min-h-screen bg-white pb-20">
      <header className="border-b border-[#0087a0] bg-[#0097b2] pt-safe">
        <div className="flex items-center justify-between gap-3 px-4 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {bandeiraPais ? (
                <span className="shrink-0 text-lg leading-none" aria-label="País da empresa">
                  {bandeiraPais}
                </span>
              ) : null}
              <UsuarioHandleVerificado
                username={nomeUsuarioRaw || 'usuario'}
                verificado={false}
                verificadoTipo="empresa"
                asButton={false}
                className={usernameHeaderClass}
              />
            </span>
          </div>
          <BotaoAbrirMenuLateral
            onClick={() => setMenuAberto(true)}
            className="flex shrink-0 items-center rounded-full p-1 text-white hover:bg-white/10"
            iconClassName="h-6 w-6 text-white"
          />
        </div>
      </header>

      <FotoCapa
        src={fotoUrl}
        nomeFallback={nomeFantasia}
        mostrarMenu={false}
        variante="avatar"
      />

      <div className="border-b border-gray-100 bg-white px-4 pb-4 pt-2">
        <div className="flex items-center justify-center">
          <NomeSocial
            nome={nomeFantasia}
            contaVerificada={empresaVerificada}
            verificadoTipo="empresa"
            compactoCentralizado
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <StatusAtendimento horarios={empresaEndereco.horarios} />
          <NotaMedia nota={notaMedia} />
        </div>

        <div className="mx-auto mt-3 grid max-w-md grid-cols-3 gap-5 px-2">
          <button
            type="button"
            onClick={() => toggleAba('avaliacoes')}
            aria-label="Avaliações"
            aria-expanded={abaExpandida === 'avaliacoes'}
            className={`flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-gray-100 active:bg-gray-200 ${
              abaExpandida === 'avaliacoes' ? 'text-[#0097b2]' : 'text-black'
            }`}
          >
            <Star className="h-5 w-5 shrink-0 text-current" strokeWidth={2} aria-hidden />
            <span className="mt-1.5 text-sm font-normal leading-none">Avaliação</span>
          </button>
          <button
            type="button"
            onClick={() => toggleAba('endereco')}
            aria-label="Endereço"
            aria-expanded={abaExpandida === 'endereco'}
            className={`flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-gray-100 active:bg-gray-200 ${
              abaExpandida === 'endereco' ? 'text-[#0097b2]' : 'text-black'
            }`}
          >
            <MapPin className="h-5 w-5 shrink-0 text-current" strokeWidth={2} aria-hidden />
            <span className="mt-1.5 text-sm font-normal leading-none">Endereço</span>
          </button>
          <button
            type="button"
            onClick={() => toggleAba('dinamico')}
            aria-label={rotuloServico}
            aria-expanded={abaExpandida === 'dinamico'}
            className={`flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-gray-100 active:bg-gray-200 ${
              abaExpandida === 'dinamico' ? 'text-[#0097b2]' : 'text-black'
            }`}
          >
            <IconeAbaServico className="h-5 w-5 shrink-0 text-current" strokeWidth={2} aria-hidden />
            <span className="mt-1.5 max-w-full truncate text-sm font-normal leading-none">{rotuloServico}</span>
          </button>
        </div>

        <div className="mt-3">
          <DescricaoLonga descricao={descLonga} />
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
              empresaUsername={empresaMerged.nome_usuario != null ? String(empresaMerged.nome_usuario) : null}
              cidade={String(empresaMerged.cidade ?? '')}
              horarios={horariosParsed}
              whatsapp={empresaMerged.whatsapp != null ? String(empresaMerged.whatsapp) : null}
              precoTicketInteira={precoTicketInteira}
              precoTicketMeia={precoTicketMeia}
              palavrasChave={empresaMerged.palavras_chave}
              empresaVerificada={
                Boolean(empresaMerged.docs_verificado) || String(empresaMerged.status ?? '') === 'ativo'
              }
              abrirAoMontar
              onFecharDrawer={() => setAbaExpandida(null)}
            />
          ) : null}
        </div>
      ) : null}

      {abaExpandida == null ? (
        <div className="bg-[#0097b2] pb-0">
          <div className="flex bg-[#0097b2] px-2">
            <button
              type="button"
              onClick={() => setSubAbaAtiva('fotos')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
                subAbaAtiva === 'fotos'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/75 hover:text-white'
              }`}
            >
              <Camera size={18} aria-hidden />
              <span>Fotos</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('posts')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
                subAbaAtiva === 'posts'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/75 hover:text-white'
              }`}
            >
              <FileText size={18} aria-hidden />
              <span>Postagens</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('tour360')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
                subAbaAtiva === 'tour360'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/75 hover:text-white'
              }`}
            >
              <Globe2 size={18} aria-hidden />
              <span>Tour 360</span>
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
              <AbaTour360Empresa
                fotos360Url={fotos360ListaPreview}
                tourConfig={tourConfigPreview}
                onFechar={() => setSubAbaAtiva('fotos')}
              />
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

