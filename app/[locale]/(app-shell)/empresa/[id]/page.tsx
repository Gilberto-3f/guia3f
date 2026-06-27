'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Camera, ChevronDown, ChevronUp, FileText, Globe2, MapPin, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BotaoVoltar from '@/components/BotaoVoltar'
import Username from '@/components/Username'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { bandeiraProfissionalRegistro } from '@/lib/bandeiraProfissional'
import FotoHero from '@/components/FotoHero'
import MenuLateral from '@/components/perfil/MenuLateral'
import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
import NomeEmpresa from '@/components/NomeEmpresa'
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
import { normalizarUrlMidiaSupabase } from '@/lib/imagemPublica'
import { getIconeAbaServico, getRotuloAbaServico } from '@/lib/empresaCategoria'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { podeVerConteudoEmpresaPreviewApp } from '@/lib/modoApresentacaoVisibilidade'
import { registrarVisitaPerfil } from '@/lib/perfilVisitas'
import { empresaElegivelGuiaPublico } from '@/lib/empresaGuiaVisibilidade'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import AvisoPlanoEmpresaBloqueado from '@/components/empresa/AvisoPlanoEmpresaBloqueado'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'

function debugEmpresa(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console -- debug seguir empresa
    console.log(...args)
  }
}

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

export default function EmpresaPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const empresaId = typeof params.id === 'string' ? params.id : params.id?.[0] ?? ''

  const [empresa, setEmpresa] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [abaExpandida, setAbaExpandida] = useState<null | 'avaliacoes' | 'endereco' | 'dinamico'>(null)
  const [subAbaAtiva, setSubAbaAtiva] = useState<'fotos' | 'posts' | 'tour360'>('fotos')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [authCarregado, setAuthCarregado] = useState(false)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  const [adminLevel, setAdminLevel] = useState(0)
  const [meuEmail, setMeuEmail] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const { modoAtivo } = useModoApresentacao()
  const planoEmpresa =
    empresa && empresa.plano != null ? String(empresa.plano) : null
  const { featureLiberada, loading: planoLoading } = useEmpresaServicosPlano(planoEmpresa, empresaId || null, {
    aguardarEmpresa: loading,
  })
  const { podeComprarReservar, loading: gateLoading } = useGateComprasReservas()
  const aguardandoPlanoRede = loading || planoLoading
  const empresaVerificada =
    empresa != null && contaVerificadaDocumentacao('empresa', empresa as { docs_verificado?: boolean | null; status?: string | null })
  const donoEmpresaPreview =
    usuarioId != null &&
    empresa != null &&
    String(empresa.usuario_id ?? '') === usuarioId &&
    meuRole === 'empresa'
  const mostrarBotaoDinamico =
    !aguardandoPlanoRede &&
    !gateLoading &&
    featureLiberada('botao_dinamico') &&
    (donoEmpresaPreview || (empresaVerificada && podeComprarReservar))
  const mostrarChamarCorrida = !aguardandoPlanoRede && featureLiberada('botao_chamar_corrida')
  const mostrarConteudoRede = !aguardandoPlanoRede && featureLiberada('pagina_rede_social')

  useEffect(() => {
    if (!mostrarBotaoDinamico && abaExpandida === 'dinamico') {
      setAbaExpandida(null)
    }
  }, [abaExpandida, mostrarBotaoDinamico])

  useEffect(() => {
    const getUsuario = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const uid = session?.user?.id ?? null
        setMeuEmail(session?.user?.email ?? null)
        setUsuarioId(uid)
        if (!uid) {
          setMeuRole(null)
          setAdminLevel(0)
          return
        }
        const { data } = await supabase.from('usuarios').select('role, admin_level').eq('id', uid).maybeSingle()
        setMeuRole(data?.role != null ? String(data.role) : null)
        setAdminLevel(typeof data?.admin_level === 'number' ? data.admin_level : 0)
      } finally {
        setAuthCarregado(true)
      }
    }
    getUsuario()
  }, [])

  useEffect(() => {
    if (searchParams.get('ref') !== 'recomendacao') return

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user?.id) return
      router.replace(`/login?next=${encodeURIComponent('/cadastro/turista')}`)
    })()
  }, [router, searchParams])

  const carregarEmpresa = useCallback(async (opts?: { silent?: boolean }) => {
    if (!empresaId) return
    const silent = Boolean(opts?.silent)
    debugEmpresa('[Empresa] carregarEmpresa início', { empresaId, silent, usuarioId })
    if (!silent) setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const viewerUid = session?.user?.id ?? null

      const { data: empresaData, error } = await supabase.from('empresas').select('*').eq('id', empresaId).single()

      if (error || !empresaData) {
        setEmpresa(null)
        router.replace('/guia')
        return
      }

      const isPreview = Boolean((empresaData as { somente_modo_apresentacao?: boolean } | null)?.somente_modo_apresentacao)
      const somenteAnfitriao = Boolean((empresaData as { somente_anfitriao?: boolean } | null)?.somente_anfitriao)
      const donoId = (empresaData as { usuario_id?: string } | null)?.usuario_id ?? null
      const viewerEmail = session?.user?.email ?? meuEmail ?? null
      const ehDono = Boolean(viewerUid && donoId && String(viewerUid) === String(donoId))
      const liberadaAnfitriao = empresaRecursosLiberados('ativo', empresaData as Parameters<typeof empresaRecursosLiberados>[1])

      if (
        isPreview &&
        (!viewerUid ||
          String(donoId ?? '') !== String(viewerUid) ||
          !podeVerConteudoEmpresaPreviewApp(viewerEmail, modoAtivo))
      ) {
        setEmpresa(null)
        router.replace('/guia')
        return
      }

      if (somenteAnfitriao && !liberadaAnfitriao) {
        setEmpresa(null)
        router.replace(ehDono ? '/guia' : '/guia')
        return
      }

      if (!ehDono && !empresaElegivelGuiaPublico(empresaData)) {
        setEmpresa(null)
        router.replace('/guia')
        return
      }

      setEmpresa({
        ...empresaData,
        horarios: asHorarios(empresaData.horarios),
        fotos_url: asJsonArray(empresaData.fotos_url),
        fotos_360_url: asJsonArray(empresaData.fotos_360_url),
        tour_config: parseTourConfig(empresaData.tour_config),
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [empresaId, router, modoAtivo, meuEmail])

  useEffect(() => {
    void carregarEmpresa()
  }, [carregarEmpresa])

  /** Após login na mesma aba, `usuarioId` hidrata — refrescar follow/contadores sem depender só do primeiro load. */
  useEffect(() => {
    if (!empresaId || !usuarioId) return
    void carregarEmpresa({ silent: true })
  }, [usuarioId, empresaId, carregarEmpresa])

  useEffect(() => {
    if (!empresa || !usuarioId || loading) return
    const dono = String(empresa.usuario_id ?? '')
    if (!dono || dono === usuarioId) return
    void registrarVisitaPerfil(supabase, {
      donoUsuarioId: dono,
      visitanteUsuarioId: usuarioId,
      tipoAlvo: 'empresa',
      empresaId,
    })
  }, [empresa, usuarioId, loading, empresaId])

  useEffect(() => {
    const onAvaliacaoEnviada = (ev: Event) => {
      const ce = ev as CustomEvent<{ empresaId?: string }>
      const alvo = ce.detail?.empresaId != null ? String(ce.detail.empresaId) : ''
      if (alvo && alvo !== empresaId) return
      void carregarEmpresa({ silent: true })
    }
    window.addEventListener('avaliacao-enviada', onAvaliacaoEnviada as EventListener)
    return () => window.removeEventListener('avaliacao-enviada', onAvaliacaoEnviada as EventListener)
  }, [empresaId, carregarEmpresa])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <p className="text-gray-500">Empresa não encontrada</p>
        <button type="button" onClick={() => router.back()} className="mt-4 text-[#0097b2]">
          Voltar
        </button>
      </div>
    )
  }

  const nomeFantasia = String(empresa.nome_fantasia ?? '')
  const nomeUsuario = String(empresa.nome_usuario ?? '')
  const nomeUsuarioRaw = nomeUsuario.trim().replace(/^@+/, '')
  const usernameHeaderClass = `block min-w-0 max-w-[min(50vw,320px)] truncate font-normal text-gray-600 ${
    nomeUsuarioRaw.length > 10 ? 'text-[16px]' : 'text-[17px]'
  }`
  const bandeiraPais = bandeiraProfissionalRegistro({
    cidadeAtuacao: String(empresa.cidade ?? ''),
  })
  const fotoUrl = empresa.foto_url ? normalizarUrlMidiaSupabase(String(empresa.foto_url)) : null
  const descLongaRaw = empresa.descricao_longa != null ? String(empresa.descricao_longa) : ''
  const descLonga = descLongaRaw.trim() !== '' ? descLongaRaw : null
  const notaMedia = Number(empresa.nota_media) || 0
  const totalAval = Number(empresa.total_avaliacoes) || 0
  const categoria = String(empresa.categoria ?? '')
  const rotuloServico = getRotuloAbaServico(categoria)
  const IconeAbaServico = getIconeAbaServico(categoria)

  const precoTicketInteira = Number(empresa.preco_ticket_inteira) || 0
  const precoTicketMeia = Number(empresa.preco_ticket_meia) || 0
  const precoDiaria = Number(empresa.preco_diaria) || 0

  type HorariosMap = Record<string, { abre: string; fecha: string; fechado: boolean }>
  const horariosParsed = asHorarios(empresa.horarios) as HorariosMap

  const latRaw = empresa.latitude
  const lngRaw = empresa.longitude
  const latitude =
    latRaw == null || typeof latRaw === 'object' ? null : typeof latRaw === 'number' ? latRaw : Number(latRaw)
  const longitude =
    lngRaw == null || typeof lngRaw === 'object' ? null : typeof lngRaw === 'number' ? lngRaw : Number(lngRaw)

  const donoEmpresa =
    (usuarioId != null && String(empresa.usuario_id ?? '') === usuarioId && meuRole === 'empresa') ||
    (usuarioId != null &&
      String(empresa.usuario_id ?? '') === usuarioId &&
      meuRole === 'profissional' &&
      Boolean(empresa.somente_anfitriao))
  const podeAbrirMenu =
    donoEmpresa || (meuRole === 'admin' && typeof adminLevel === 'number' && adminLevel === 1 && modoAtivo)
  /** Apenas admin altera fotos 360° na página pública da empresa. */
  const podeEditarFotos360 = meuRole === 'admin'
  const modoEmpresaLayout = podeAbrirMenu

  const toggleAba = (aba: 'avaliacoes' | 'endereco' | 'dinamico') => {
    setAbaExpandida((atual) => (atual === aba ? null : aba))
  }

  const fotos360Lista = Array.isArray(empresa.fotos_360_url) ? /** @type {string[]} */ (empresa.fotos_360_url) : []
  const tourConfigMerged = sincronizarTourComFotos(
    fotos360Lista,
    parseTourConfig(empresa.tour_config)
  )
  const empresaUsuarioIdPosts = empresa.usuario_id != null ? String(empresa.usuario_id) : null

  const empresaEndereco = {
    id: empresaId,
    endereco: String(empresa.endereco ?? ''),
    bairro: empresa.bairro != null ? String(empresa.bairro) : null,
    cidade: String(empresa.cidade ?? ''),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    telefone: empresa.telefone != null ? String(empresa.telefone) : null,
    whatsapp: empresa.whatsapp != null ? String(empresa.whatsapp) : null,
    website: empresa.website != null ? String(empresa.website) : null,
    redes_sociais: empresa.redes_sociais,
    horarios: horariosParsed,
    nome_fantasia: nomeFantasia,
  }

  return (
    <div className="bg-gray-50">
      <div className="border-b border-gray-100 bg-white pt-safe">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            {authCarregado && !modoEmpresaLayout ? <BotaoVoltar /> : null}
            <div className="min-w-0 flex-1 overflow-hidden">
              {empresaVerificada ? (
                <UsuarioHandleVerificado
                  username={nomeUsuarioRaw || 'usuario'}
                  verificado
                  verificadoTipo="empresa"
                  asButton={false}
                  className={usernameHeaderClass}
                />
              ) : (
                <Username username={nomeUsuario} />
              )}
            </div>
          </div>
          <div className="flex shrink-0 justify-end">
            {podeAbrirMenu ? <BotaoAbrirMenuLateral onClick={() => setMenuAberto(true)} /> : null}
          </div>
        </div>
      </div>

      <FotoHero fotoUrl={fotoUrl} nome={nomeFantasia} />

      <div className="border-b border-gray-100 bg-white p-4">
        <div className="mb-2">
          <NomeEmpresa nome={nomeFantasia} bandeira={bandeiraPais} />
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <NotaMedia nota={notaMedia} total={totalAval} />
          <StatusAtendimento horarios={empresaEndereco.horarios} />
        </div>

        <DescricaoLonga descricao={descLonga} />
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="flex gap-1 p-1.5">
          <button
            type="button"
            onClick={() => toggleAba('avaliacoes')}
            aria-label="Avaliações"
            aria-expanded={abaExpandida === 'avaliacoes'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
              abaExpandida === 'avaliacoes'
                ? 'bg-[#0097b2] text-white shadow-sm'
                : 'bg-transparent text-[#0097b2] hover:bg-[#0097b2]/10'
            }`}
          >
            <Star className="h-4 w-4 shrink-0 text-current" aria-hidden />
            {abaExpandida === 'avaliacoes' ? <ChevronUp className="h-4 w-4 shrink-0 text-current" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0 text-current" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => toggleAba('endereco')}
            aria-label="Endereço"
            aria-expanded={abaExpandida === 'endereco'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
              abaExpandida === 'endereco'
                ? 'bg-[#0097b2] text-white shadow-sm'
                : 'bg-transparent text-[#0097b2] hover:bg-[#0097b2]/10'
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0 text-current" aria-hidden />
            {abaExpandida === 'endereco' ? <ChevronUp className="h-4 w-4 shrink-0 text-current" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0 text-current" aria-hidden />}
          </button>
          {mostrarBotaoDinamico ? (
          <button
            type="button"
            onClick={() => toggleAba('dinamico')}
            aria-label={rotuloServico}
            aria-expanded={abaExpandida === 'dinamico'}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
              abaExpandida === 'dinamico'
                ? 'bg-[#0097b2] text-white shadow-sm'
                : 'bg-transparent text-[#0097b2] hover:bg-[#0097b2]/10'
            }`}
          >
            <IconeAbaServico className="h-4 w-4 shrink-0 text-current" aria-hidden />
            {abaExpandida === 'dinamico' ? <ChevronUp className="h-4 w-4 shrink-0 text-current" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0 text-current" aria-hidden />}
          </button>
          ) : null}
        </div>
      </div>

      {abaExpandida ? (
        <div className="px-4 pt-4 pb-0">
          {abaExpandida === 'avaliacoes' ? (
            <AbaAvaliacoes
              empresaId={empresaId}
              podeResponder={donoEmpresa}
              empresaUsuarioId={empresa.usuario_id != null ? String(empresa.usuario_id) : null}
              empresaVerificada={
                Boolean(empresa.docs_verificado) || String(empresa.status ?? '') === 'ativo'
              }
            />
          ) : null}
          {abaExpandida === 'endereco' ? (
            <AbaEndereco empresa={empresaEndereco} mostrarChamarCorrida={mostrarChamarCorrida} />
          ) : null}
          {abaExpandida === 'dinamico' && mostrarBotaoDinamico ? (
            <AbaBotaoDinamico
              categoria={categoria}
              empresaId={empresaId}
              empresaNome={nomeFantasia}
              empresaUsername={empresa.nome_usuario != null ? String(empresa.nome_usuario) : null}
              cidade={String(empresa.cidade ?? '')}
              horarios={horariosParsed}
              whatsapp={empresa.whatsapp != null ? String(empresa.whatsapp) : null}
              precoTicketInteira={precoTicketInteira}
              precoTicketMeia={precoTicketMeia}
              precoDiaria={precoDiaria}
            />
          ) : null}
        </div>
      ) : null}

      {abaExpandida == null ? (
        aguardandoPlanoRede && donoEmpresa ? (
          <div className="border-b border-gray-100 bg-white px-4 py-8">
            <div className="h-24 animate-pulse rounded-lg bg-gray-100" aria-busy="true" aria-label="A carregar conteúdo" />
          </div>
        ) : mostrarConteudoRede ? (
        <div className="border-b border-gray-100 bg-white pt-4 px-4 pb-0">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setSubAbaAtiva('fotos')}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'fotos'
                  ? 'bg-[#0097b2] text-white shadow-sm'
                  : 'text-[#0097b2] hover:bg-white/60'
              }`}
            >
              <Camera size={18} aria-hidden className="text-current" />
              <span>FOTOS</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('posts')}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'posts'
                  ? 'bg-[#0097b2] text-white shadow-sm'
                  : 'text-[#0097b2] hover:bg-white/60'
              }`}
            >
              <FileText size={18} aria-hidden className="text-current" />
              <span>POSTS</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('tour360')}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-xs font-medium transition-colors ${
                subAbaAtiva === 'tour360'
                  ? 'bg-[#0097b2] text-white shadow-sm'
                  : 'text-[#0097b2] hover:bg-white/60'
              }`}
            >
              <Globe2 size={18} aria-hidden className="text-current" />
              <span>TOUR 360°</span>
            </button>
          </div>

          <div className="min-h-0">
            {subAbaAtiva === 'fotos' ? (
              <AbaFotosEmpresa
                empresaUsuarioId={empresaUsuarioIdPosts}
                empresaId={empresaId}
                nomeFantasia={nomeFantasia}
                nomeUsuario={nomeUsuario}
                fotoPerfilUrl={fotoUrl}
              />
            ) : null}
            {subAbaAtiva === 'posts' ? <AbaPostsEmpresa empresaUsuarioId={empresaUsuarioIdPosts} /> : null}
            {subAbaAtiva === 'tour360' ? (
              <AbaTour360Empresa
                fotos360Url={fotos360Lista}
                tourConfig={tourConfigMerged}
                modoAdministracao={podeEditarFotos360}
                empresaId={empresaId}
                onAtualizado={() => void carregarEmpresa({ silent: true })}
              />
            ) : null}
          </div>
        </div>
        ) : donoEmpresa ? (
          <div className="border-b border-gray-100 bg-white px-4 py-6">
            <AvisoPlanoEmpresaBloqueado />
          </div>
        ) : null
      ) : null}

      {podeAbrirMenu && usuarioId && menuAberto ? (
        meuRole === 'admin' && typeof adminLevel === 'number' && adminLevel === 1 && modoAtivo ? (
          <MenuLateral
            aberto={menuAberto}
            onFechar={() => setMenuAberto(false)}
            variant="admin"
            adminLevel={adminLevel}
            nome="Admin"
            username={meuEmail ? meuEmail.split('@')[0] : 'admin'}
            fotoUrl={null}
            usuarioId={usuarioId}
          />
        ) : (
          <MenuLateral
            aberto={menuAberto}
            onFechar={() => setMenuAberto(false)}
            variant="empresa"
            nome={nomeFantasia}
            username={nomeUsuario}
            fotoUrl={fotoUrl}
            usuarioId={usuarioId}
            empresa={empresa}
            empresaId={empresaId}
            onPerfilAtualizado={() => void carregarEmpresa({ silent: true })}
          />
        )
      ) : null}
    </div>
  )
}
