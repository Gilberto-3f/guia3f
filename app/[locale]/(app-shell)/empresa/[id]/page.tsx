'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Camera, FileText, Globe2, MapPin, Star } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import BotaoAlfineteItinerario from '@/components/manifesto/BotaoAlfineteItinerario'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { bandeiraProfissionalRegistro } from '@/lib/bandeiraProfissional'
import FotoCapa from '@/components/perfil/FotoCapa'
import MenuLateral from '@/components/perfil/MenuLateral'
import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
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
import { normalizarUrlMidiaSupabase } from '@/lib/imagemPublica'
import { getIconeAbaServico, getRotuloAbaServico } from '@/lib/empresaCategoria'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { podeVerConteudoEmpresaPreviewApp } from '@/lib/modoApresentacaoVisibilidade'
import { registrarVisitaPerfil } from '@/lib/perfilVisitas'
import { empresaElegivelGuiaPublico } from '@/lib/empresaGuiaVisibilidade'
import { empresaTemPresencaPublicaVigente } from '@/lib/empresaPresencaPublica'
import { consumirReabrirMenuLateral } from '@/lib/menuLateralHistory'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import { prefetchPlanosEmpresa, useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import AvisoPlanoEmpresaBloqueado from '@/components/empresa/AvisoPlanoEmpresaBloqueado'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { empresaEhHospedagemAnfitriao, turistaTemReservaHospedagemConfirmada } from '@/lib/reservaHospedagem'
import { filtrarFavoritoIdsPorUsuario } from '@/lib/favoritosTurista'

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
  const [reservaHospedagemConfirmada, setReservaHospedagemConfirmada] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [favEmpresa, setFavEmpresa] = useState(false)
  const falhaCarregarRef = useRef(false)
  const { modoAtivo } = useModoApresentacao()

  useEffect(() => {
    const tentarReabrir = () => {
      if (consumirReabrirMenuLateral()) setMenuAberto(true)
    }
    tentarReabrir()
    window.addEventListener('pageshow', tentarReabrir)
    return () => window.removeEventListener('pageshow', tentarReabrir)
  }, [])
  const planoEmpresa =
    empresa && empresa.plano != null ? String(empresa.plano) : null
  const { featurePublicaLiberada } = useEmpresaServicosPlano(planoEmpresa, empresaId || null, {
    aguardarEmpresa: loading,
    somenteAnfitriao: Boolean(empresa?.somente_anfitriao || empresa?.somente_guia || empresa?.somente_van),
  })
  const empresaVerificada =
    empresa != null && contaVerificadaDocumentacao('empresa', empresa as { docs_verificado?: boolean | null; status?: string | null })
  const ehDonoEmpresa =
    usuarioId != null &&
    empresa != null &&
    String(empresa.usuario_id ?? '') === usuarioId &&
    (meuRole === 'empresa' ||
      (meuRole === 'profissional' &&
        (Boolean(empresa.somente_anfitriao) ||
          Boolean(empresa.somente_guia) ||
          Boolean(empresa.somente_van))))
  /**
   * Aba do botão dinâmico: só depende do plano da empresa (e página carregada).
   * Não usa gate de compra/verificação do visitante — a ação dentro do drawer já bloqueia se preciso.
   * Dono vê sempre que o plano incluir o recurso.
   */
  const mostrarBotaoDinamico =
    !loading &&
    empresa != null &&
    featurePublicaLiberada('botao_dinamico') &&
    (ehDonoEmpresa || empresaVerificada)
  const mostrarChamarCorrida = !loading && empresa != null && featurePublicaLiberada('botao_chamar_corrida')

  useEffect(() => {
    if (!empresaId || !usuarioId || meuRole !== 'turista') {
      setFavEmpresa(false)
      return
    }
    let cancelado = false
    void (async () => {
      const ids = await filtrarFavoritoIdsPorUsuario(supabase, usuarioId, 'empresa', [empresaId])
      if (!cancelado) setFavEmpresa(ids.has(empresaId))
    })()
    return () => {
      cancelado = true
    }
  }, [empresaId, usuarioId, meuRole])

  useEffect(() => {
    if (empresaId && ehDonoEmpresa && !empresa?.somente_anfitriao) {
      prefetchPlanosEmpresa()
    }
  }, [empresaId, ehDonoEmpresa, empresa?.somente_anfitriao])
  /** Fotos / posts / tour: visíveis com conta verificada; não some ao refrescar o plano. */
  const mostrarConteudoRede = !loading && empresa != null && empresaVerificada

  useEffect(() => {
    if (!mostrarBotaoDinamico && abaExpandida === 'dinamico') {
      setAbaExpandida(null)
    }
  }, [abaExpandida, mostrarBotaoDinamico])

  const ehDonoEmpresaEarly =
    usuarioId != null &&
    empresa != null &&
    String(empresa.usuario_id ?? '') === usuarioId &&
    (meuRole === 'empresa' ||
      (meuRole === 'profissional' &&
        (Boolean(empresa.somente_anfitriao) ||
          Boolean(empresa.somente_guia) ||
          Boolean(empresa.somente_van))))

  const ehPaginaHospedagem =
    empresa != null &&
    empresaEhHospedagemAnfitriao({
      categoria: empresa.categoria != null ? String(empresa.categoria) : null,
      somente_anfitriao: Boolean(empresa.somente_anfitriao),
    })

  const enderecoExigeReservaConfirmada =
    ehPaginaHospedagem && !ehDonoEmpresaEarly && meuRole !== 'admin'

  useEffect(() => {
    if (!enderecoExigeReservaConfirmada || !empresaId) {
      setReservaHospedagemConfirmada(false)
      return
    }

    if (!usuarioId) {
      setReservaHospedagemConfirmada(false)
      return
    }

    let ativo = true

    const verificar = async () => {
      const ok = await turistaTemReservaHospedagemConfirmada(supabase, empresaId, usuarioId)
      if (!ativo) return
      setReservaHospedagemConfirmada(ok)
    }

    void verificar()

    const ch = supabase
      .channel(`reserva-hosp-page-${empresaId}-${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservas_hospedagem',
          filter: `turista_usuario_id=eq.${usuarioId}`,
        },
        () => {
          void verificar()
        },
      )
      .subscribe()

    return () => {
      ativo = false
      void supabase.removeChannel(ch)
    }
  }, [enderecoExigeReservaConfirmada, usuarioId, empresaId])

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

  useEffect(() => {
    if (searchParams.get('abrir') !== 'reserva') return
    if (!mostrarBotaoDinamico) return
    setAbaExpandida('dinamico')
  }, [searchParams, mostrarBotaoDinamico])

  useEffect(() => {
    falhaCarregarRef.current = false
  }, [empresaId])

  const carregarEmpresa = useCallback(async (opts?: { silent?: boolean }) => {
    if (!empresaId || falhaCarregarRef.current) return
    const silent = Boolean(opts?.silent)
    debugEmpresa('[Empresa] carregarEmpresa início', { empresaId, silent, usuarioId })
    if (!silent) setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const viewerUid = session?.user?.id ?? null

      const { data: empresaRaw, error } = await supabase
        .from('empresas')
        .select(
          'id, usuario_id, nome_fantasia, nome_usuario, categoria, cidade, bairro, endereco, foto_url, fotos_url, fotos_360_url, tour_config, descricao_curta, descricao_longa, palavras_chave, whatsapp, whatsapp_comercial, horarios, nota_media, total_avaliacoes, plano, status, docs_verificado, aprovado_em, verificado_em, somente_anfitriao, somente_guia, somente_van, somente_modo_apresentacao, moeda_padrao, preco_ticket_inteira, preco_ticket_meia, preco_diaria, latitude, longitude, telefone, website, redes_sociais',
        )
        .eq('id', empresaId)
        .single()

      if (error || !empresaRaw) {
        setEmpresa(null)
        // Evita tempestade de 400 se o select/RLS falhar (ex.: coluna inexistente).
        falhaCarregarRef.current = true
        router.replace('/guia')
        return
      }

      const empresaData = empresaRaw as Record<string, unknown>
      const isPreview = Boolean(empresaData.somente_modo_apresentacao)
      const somenteAnfitriao = Boolean(empresaData.somente_anfitriao)
      const gratisProfissional =
        somenteAnfitriao ||
        Boolean(empresaData.somente_guia) ||
        Boolean(empresaData.somente_van)
      const donoId = empresaData.usuario_id != null ? String(empresaData.usuario_id) : null
      const viewerEmail = session?.user?.email ?? meuEmail ?? null
      const ehDono = Boolean(viewerUid && donoId && String(viewerUid) === String(donoId))
      const liberadaAnfitriao = empresaRecursosLiberados(
        'ativo',
        empresaData as Parameters<typeof empresaRecursosLiberados>[1],
      )

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

      if (gratisProfissional && !liberadaAnfitriao) {
        setEmpresa(null)
        router.replace(ehDono ? '/guia' : '/guia')
        return
      }

      if (!ehDono && !empresaElegivelGuiaPublico(empresaData as Parameters<typeof empresaElegivelGuiaPublico>[0])) {
        setEmpresa(null)
        router.replace('/guia')
        return
      }

      // Turista/pro: ciclo vencido / sem degustação → página fora do acesso público (dono e ADM veem).
      let roleViewer = meuRole
      if (viewerUid && !ehDono && roleViewer !== 'admin') {
        const { data: uRole } = await supabase.from('usuarios').select('role').eq('id', viewerUid).maybeSingle()
        if (uRole?.role != null) roleViewer = String(uRole.role)
      }
      const ehAdmin = roleViewer === 'admin'
      if (!ehDono && !ehAdmin && !gratisProfissional) {
        const vigente = await empresaTemPresencaPublicaVigente(supabase, empresaId, {
          somenteAnfitriao,
          presencaGratuitaProfissional: gratisProfissional,
        })
        if (!vigente) {
          setEmpresa(null)
          router.replace('/guia')
          return
        }
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
  }, [empresaId, router, modoAtivo, meuEmail, meuRole])

  useEffect(() => {
    void carregarEmpresa()
  }, [carregarEmpresa])

  /**
   * Repara lat/lng ausentes (contas antigas / CDE / agências dual).
   * Qualquer sessão autenticada: habilita mapa Endereço e pin na mobilidade.
   */
  useEffect(() => {
    if (!empresa || !usuarioId || loading) return
    const lat = empresa.latitude != null ? Number(empresa.latitude) : NaN
    const lng = empresa.longitude != null ? Number(empresa.longitude) : NaN
    if (Number.isFinite(lat) && Number.isFinite(lng)) return
    const endereco = empresa.endereco != null ? String(empresa.endereco).trim() : ''
    const cidade = empresa.cidade != null ? String(empresa.cidade).trim() : ''
    if (!endereco && !cidade) return

    let cancelado = false
    void (async () => {
      try {
        const res = await fetch('/api/empresa/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            empresa_id: empresaId,
            endereco: endereco || null,
            bairro: empresa.bairro != null ? String(empresa.bairro) : null,
            cidade: cidade || null,
          }),
        })
        if (!res.ok || cancelado) return
        const json = (await res.json()) as { latitude?: number; longitude?: number }
        if (
          !cancelado &&
          Number.isFinite(Number(json.latitude)) &&
          Number.isFinite(Number(json.longitude))
        ) {
          setEmpresa((prev) =>
            prev
              ? { ...prev, latitude: Number(json.latitude), longitude: Number(json.longitude) }
              : prev,
          )
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelado = true
    }
  }, [empresa, usuarioId, loading, empresaId])

  /** Após login na mesma aba, `usuarioId` hidrata — um único silent refresh (sem duplicar no boot). */
  const usuarioIdInicialRef = useRef<string | null>(null)
  useEffect(() => {
    if (!empresaId || !usuarioId) return
    if (usuarioIdInicialRef.current === null) {
      usuarioIdInicialRef.current = usuarioId
      return
    }
    if (usuarioIdInicialRef.current === usuarioId) return
    usuarioIdInicialRef.current = usuarioId
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
  const usernameHeaderClass = `block min-w-0 max-w-[min(50vw,320px)] truncate font-normal text-white ${
    nomeUsuarioRaw.length > 10 ? 'text-[16px]' : 'text-[17px]'
  }`
  const bandeiraPais = bandeiraProfissionalRegistro({
    cidadeAtuacao: String(empresa.cidade ?? ''),
  })
  const fotoUrl = empresa.foto_url ? normalizarUrlMidiaSupabase(String(empresa.foto_url)) : null
  const descLongaRaw = empresa.descricao_longa != null ? String(empresa.descricao_longa) : ''
  const descLonga = descLongaRaw.trim() !== '' ? descLongaRaw : null
  const notaMedia = Number(empresa.nota_media) || 0
  const categoria = String(empresa.categoria ?? '')
  const rotuloServico = getRotuloAbaServico(categoria)
  const IconeAbaServico = getIconeAbaServico(categoria)

  const precoTicketInteira = Number(empresa.preco_ticket_inteira) || 0
  const precoTicketMeia = Number(empresa.preco_ticket_meia) || 0

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
      (Boolean(empresa.somente_anfitriao) ||
          Boolean(empresa.somente_guia) ||
          Boolean(empresa.somente_van)))
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
    foto_url: empresa.foto_url != null ? String(empresa.foto_url) : null,
    telefone: empresa.telefone != null ? String(empresa.telefone) : null,
    whatsapp: empresa.whatsapp != null ? String(empresa.whatsapp) : null,
    website: empresa.website != null ? String(empresa.website) : null,
    redes_sociais: empresa.redes_sociais,
    horarios: horariosParsed,
    nome_fantasia: nomeFantasia,
  }

  const locacaoEnderecoBloqueada =
    enderecoExigeReservaConfirmada && (!usuarioId || !reservaHospedagemConfirmada)

  /** Corrida no Endereço liberada para lojas BR/AR (botão dinâmico agora é catálogo). */
  const ocultarChamarCorridaEndereco = false

  return (
    <div className="bg-white">
      <header className="border-b border-[#0087a0] bg-[#0097b2] pt-safe">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            {authCarregado && !modoEmpresaLayout ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="-ml-1 rounded-full p-2 transition-colors hover:bg-white/10"
                aria-label="Voltar"
              >
                <ArrowLeft size={20} className="text-white" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1 overflow-hidden">
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
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1">
            {authCarregado && meuRole === 'turista' ? (
              <>
                <BotaoAlfineteItinerario
                  empresaId={empresaId}
                  size={22}
                  className="bg-white/95 hover:bg-white"
                />
                <BotaoEstrelaFavorito
                  usuarioId={usuarioId}
                  alvoId={empresaId}
                  tipo="empresa"
                  inicial={favEmpresa}
                  size={22}
                  onChange={setFavEmpresa}
                  className="bg-white/95 p-1.5 hover:bg-white"
                />
              </>
            ) : null}
            {podeAbrirMenu ? (
              <BotaoAbrirMenuLateral
                onClick={() => setMenuAberto(true)}
                className="flex shrink-0 items-center rounded-full p-1 text-white hover:bg-white/10"
                iconClassName="h-6 w-6 text-white"
              />
            ) : null}
          </div>
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

        <div
          className={`mx-auto mt-3 grid max-w-md gap-5 px-2 ${
            mostrarBotaoDinamico ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
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
          {mostrarBotaoDinamico ? (
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
          ) : null}
        </div>

        {abaExpandida !== 'avaliacoes' && abaExpandida !== 'endereco' ? (
          <div className="mt-3">
            <DescricaoLonga descricao={descLonga} />
          </div>
        ) : null}
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
            <AbaEndereco
              empresa={empresaEndereco}
              mostrarChamarCorrida={mostrarChamarCorrida && !locacaoEnderecoBloqueada && !ocultarChamarCorridaEndereco}
              locacaoBloqueada={locacaoEnderecoBloqueada}
            />
          ) : null}
          {abaExpandida === 'dinamico' && mostrarBotaoDinamico ? (
            <AbaBotaoDinamico
              categoria={categoria}
              empresaId={empresaId}
              empresaNome={nomeFantasia}
              empresaUsername={empresa.nome_usuario != null ? String(empresa.nome_usuario) : null}
              empresaFotoUrl={fotoUrl}
              notaMedia={notaMedia}
              empresaVerificada={empresaVerificada}
              cidade={String(empresa.cidade ?? '')}
              horarios={horariosParsed}
              whatsapp={empresa.whatsapp != null ? String(empresa.whatsapp) : null}
              precoTicketInteira={precoTicketInteira}
              precoTicketMeia={precoTicketMeia}
              palavrasChave={empresa.palavras_chave}
              abrirReservaAuto={searchParams.get('abrir') === 'reserva'}
              recomendacaoId={searchParams.get('rec')}
              abrirAoMontar
              onFecharDrawer={() => setAbaExpandida(null)}
            />
          ) : null}
        </div>
      ) : null}

      {abaExpandida == null ? (
        loading && donoEmpresa ? (
          <div className="border-b border-gray-100 bg-white px-4 py-8">
            <div className="h-24 animate-pulse rounded-lg bg-gray-100" aria-busy="true" aria-label="A carregar conteúdo" />
          </div>
        ) : mostrarConteudoRede ? (
        <div className="bg-white pb-0">
          <div className="flex bg-white px-2">
            <button
              type="button"
              onClick={() => setSubAbaAtiva('fotos')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
                subAbaAtiva === 'fotos'
                  ? 'border-[#0097b2] text-[#0097b2]'
                  : 'border-transparent text-gray-500 hover:text-[#0097b2]'
              }`}
            >
              <Camera size={18} aria-hidden className="text-current" />
              <span>Fotos</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('posts')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
                subAbaAtiva === 'posts'
                  ? 'border-[#0097b2] text-[#0097b2]'
                  : 'border-transparent text-gray-500 hover:text-[#0097b2]'
              }`}
            >
              <FileText size={18} aria-hidden className="text-current" />
              <span>Postagens</span>
            </button>
            <button
              type="button"
              onClick={() => setSubAbaAtiva('tour360')}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2.5 text-xs font-bold transition-colors ${
                subAbaAtiva === 'tour360'
                  ? 'border-[#0097b2] text-[#0097b2]'
                  : 'border-transparent text-gray-500 hover:text-[#0097b2]'
              }`}
            >
              <Globe2 size={18} aria-hidden className="text-current" />
              <span>Tour 360</span>
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
                onFechar={() => setSubAbaAtiva('fotos')}
              />
            ) : null}
          </div>
        </div>
        ) : donoEmpresa && !empresaVerificada ? (
          <div className="border-b border-gray-100 bg-white px-4 py-6">
            <AvisoPlanoEmpresaBloqueado />
          </div>
        ) : null
      ) : null}

      {podeAbrirMenu && usuarioId ? (
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
            adminLevel={adminLevel}
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
