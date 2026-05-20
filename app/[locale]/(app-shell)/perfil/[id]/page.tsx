'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FotoCapa from '@/components/perfil/FotoCapa'
import MenuLateral from '@/components/perfil/MenuLateral'
import BotaoAbrirMenuLateral from '@/components/perfil/BotaoAbrirMenuLateral'
import NomeSocial from '@/components/perfil/NomeSocial'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import DescricaoCurta from '@/components/perfil/DescricaoCurta'
import MetricasPerfil from '@/components/perfil/MetricasPerfil'
import AbasPerfil from '@/components/perfil/AbasPerfil'
import AbaFotos from '@/components/perfil/AbaFotos'
import AbaPosts from '@/components/perfil/AbaPosts'
import AbaRepublicados from '@/components/perfil/AbaRepublicados'
import PopupFavoritos from '@/components/perfil/PopupFavoritos'
import PopupSeguidores from '@/components/perfil/PopupSeguidores'
import PopupAvaliacoes from '@/components/perfil/PopupAvaliacoes'
import ModalFoto from '@/components/perfil/ModalFoto'
import BotaoSeguir from '@/components/BotaoSeguir'
import PopupCartaoVisitaProfissional from '@/components/perfil/PopupCartaoVisitaProfissional'
import { mapPostComAutoresRow } from '@/lib/mapPostComAutoresRow'
import { POST_DELETED_EVENT } from '@/components/MenuPost'
import { fetchFotoPerfilUsuario } from '@/lib/feed-autor'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

type PostRepostFeed = ReturnType<typeof mapPostComAutoresRow>

type PostLinha = {
  id: string
  texto: string | null
  created_at: string
  total_curtidas: number
  total_comentarios: number
}

type FotoPostItem = {
  id: string
  url: string
  texto: string | null
  created_at: string
  tipo: string
  total_curtidas: number
  total_comentarios: number
  total_compartilhamentos: number
  total_reposts: number
  post_original_id: string | null
}

export default function PerfilSocialPage() {
  const { recursosProfissionaisLiberados } = useProfissionalGate()
  const params = useParams()
  const router = useRouter()
  const profileId = typeof params.id === 'string' ? params.id : params.id?.[0] ?? ''

  const [meuId, setMeuId] = useState<string | null>(null)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  const [placaVermelha, setPlacaVermelha] = useState(false)
  const [adminLevel, setAdminLevel] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null)
  const [capaUrl, setCapaUrl] = useState<string | null>(null)
  const [bio, setBio] = useState<string | null>(null)
  const [perfilRole, setPerfilRole] = useState<string | null>(null)
  const [seguindoPerfil, setSeguindoPerfil] = useState(false)

  const [nFavEmp, setNFavEmp] = useState(0)
  const [nFavUsers, setNFavUsers] = useState(0)
  const [nSeguidores, setNSeguidores] = useState(0)
  const [nAval, setNAval] = useState(0)

  const [aba, setAba] = useState<'fotos' | 'posts' | 'republicados'>('fotos')
  const [postsFotos, setPostsFotos] = useState<FotoPostItem[]>([])
  const [postsTexto, setPostsTexto] = useState<PostLinha[]>([])
  const [repostadosPosts, setRepostadosPosts] = useState<PostRepostFeed[]>([])
  const [meuEmail, setMeuEmail] = useState<string | null>(null)

  const [menuAberto, setMenuAberto] = useState(false)
  const [popFav, setPopFav] = useState(false)
  const [popSeg, setPopSeg] = useState(false)
  const [popAval, setPopAval] = useState(false)
  const [popCartao, setPopCartao] = useState(false)
  const [modalFoto, setModalFoto] = useState({ aberto: false, i: 0 })

  const [profMeta, setProfMeta] = useState<{
    categorias: string[] | null
    placaVermelha: boolean
    verificadoEm: string | null
    /** `profissionais.created_at` — texto “cadastrado desde …” no cartão. */
    cadastradoEm: string | null
    /** `profissionais.status` — `aprovado` = cartão “VERIFICADO”; caso contrário “EM ANÁLISE”. */
    statusProfissional: string | null
    docsVerificado: boolean
  }>({
    categorias: null,
    placaVermelha: false,
    verificadoEm: null,
    cadastradoEm: null,
    statusProfissional: null,
    docsVerificado: false,
  })

  const patchFotoPost = useCallback((postId: string, updates: { total_curtidas?: number; total_comentarios?: number }) => {
    setPostsFotos((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              total_curtidas: updates.total_curtidas ?? p.total_curtidas,
              total_comentarios: updates.total_comentarios ?? p.total_comentarios,
            }
          : p
      )
    )
  }, [])

  const patchRepostadoPost = useCallback(
    (
      postId: string,
      patch: Partial<{ texto: string | null; total_curtidas?: number; total_comentarios?: number }>
    ) => {
      setRepostadosPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...patch } : p))
      )
    },
    []
  )

  const onEngagementRepostado = useCallback(
    (
      postId: string,
      patch: { total_curtidas?: number; total_comentarios?: number }
    ) => {
      setRepostadosPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                ...(patch.total_curtidas != null ? { total_curtidas: patch.total_curtidas } : {}),
                ...(patch.total_comentarios != null ? { total_comentarios: patch.total_comentarios } : {}),
              }
            : p
        )
      )
    },
    []
  )

  const atualizarMetricasPerfil = useCallback(async () => {
    if (!profileId) return
    const [{ count: cFav }, { count: cSegU }, { count: cSegMe }, { count: cAval }] = await Promise.all([
      supabase
        .from('favoritos')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', profileId)
        .eq('alvo_tipo', 'empresa'),
      supabase.from('redecontatos').select('id', { count: 'exact', head: true }).eq('seguidor_id', profileId),
      supabase.from('redecontatos').select('id', { count: 'exact', head: true }).eq('seguido_id', profileId),
      supabase.from('avaliacoes').select('id', { count: 'exact', head: true }).eq('usuario_id', profileId),
    ])

    setNFavEmp(cFav ?? 0)
    setNFavUsers(cSegU ?? 0)
    setNSeguidores(cSegMe ?? 0)
    setNAval(cAval ?? 0)
  }, [profileId])

  const carregar = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    setErro('')
    try {
      const { data: u, error: eu } = await supabase
        .from('usuarios')
        .select('id, email, role')
        .eq('id', profileId)
        .maybeSingle()

      if (eu || !u) {
        setErro('Perfil não encontrado')
        return
      }

      const role = u.role != null ? String(u.role) : null
      setPerfilRole(role)

      if (role === 'empresa') {
        setErro('Use a página da empresa para perfis comerciais.')
        return
      }

      if (role !== 'turista' && role !== 'profissional' && role !== 'admin') {
        setErro('Perfil social disponível apenas para turistas, profissionais e administradores.')
        return
      }

      if (meuId && profileId && meuId !== profileId) {
        const { data: seg } = await supabase
          .from('redecontatos')
          .select('id')
          .eq('seguidor_id', meuId)
          .eq('seguido_id', profileId)
          .maybeSingle()
        setSeguindoPerfil(Boolean(seg))
      } else {
        setSeguindoPerfil(false)
      }

      /** Sem embed em `usuarios`. Admin: profissional e turista em paralelo (prioridade profissional). */
      let perfilRow: Record<string, unknown> | null = null

      if (role === 'admin') {
        const [profRes, turRes] = await Promise.all([
          supabase
            .from('profissionais')
            .select(
              'nome_completo, nome_usuario, foto_url, foto_perfil_url, bio, foto_capa_url, categorias, placa_vermelha, docs_verificado, docs_verificado_em, created_at, status'
            )
            .eq('usuario_id', profileId)
            .maybeSingle(),
          supabase
            .from('turistas')
            .select('nome_completo, nome_usuario, foto_url, foto_perfil_url, bio, foto_capa_url')
            .eq('usuario_id', profileId)
            .maybeSingle(),
        ])
        if (profRes.error) console.warn('Perfil profissionais:', profRes.error.message)
        if (turRes.error) console.warn('Perfil turistas:', turRes.error.message)
        const prof = profRes.data
        const tur = turRes.data
        if (!profRes.error && prof && typeof prof === 'object' && !Array.isArray(prof)) {
          perfilRow = prof as Record<string, unknown>
          const rr = prof as unknown as {
            categorias?: string[] | null
            placa_vermelha?: boolean | null
            docs_verificado?: boolean | null
            docs_verificado_em?: string | null
            created_at?: string | null
            status?: string | null
          }
          setProfMeta({
            categorias: Array.isArray(rr.categorias) ? rr.categorias.map((x) => String(x)) : null,
            placaVermelha: Boolean(rr.placa_vermelha),
            verificadoEm: rr.docs_verificado_em ?? rr.created_at ?? null,
            cadastradoEm: rr.created_at ?? null,
            statusProfissional: rr.status != null ? String(rr.status) : null,
            docsVerificado: Boolean(rr.docs_verificado),
          })
        } else if (!turRes.error && tur && typeof tur === 'object' && !Array.isArray(tur)) {
          perfilRow = tur as Record<string, unknown>
          setProfMeta({
            categorias: null,
            placaVermelha: false,
            verificadoEm: null,
            cadastradoEm: null,
            statusProfissional: null,
            docsVerificado: false,
          })
        }
      } else if (role === 'profissional') {
        const { data: prof, error: ep } = await supabase
          .from('profissionais')
          .select(
            'nome_completo, nome_usuario, foto_url, foto_perfil_url, bio, foto_capa_url, categorias, placa_vermelha, docs_verificado, docs_verificado_em, created_at, status'
          )
          .eq('usuario_id', profileId)
          .maybeSingle()
        if (ep) console.warn('Perfil profissionais:', ep.message)
        if (!ep && prof && typeof prof === 'object' && !Array.isArray(prof)) {
          perfilRow = prof as Record<string, unknown>
          const rr = prof as unknown as {
            categorias?: string[] | null
            placa_vermelha?: boolean | null
            docs_verificado?: boolean | null
            docs_verificado_em?: string | null
            created_at?: string | null
            status?: string | null
          }
          setProfMeta({
            categorias: Array.isArray(rr.categorias) ? rr.categorias.map((x) => String(x)) : null,
            placaVermelha: Boolean(rr.placa_vermelha),
            verificadoEm: rr.docs_verificado_em ?? rr.created_at ?? null,
            cadastradoEm: rr.created_at ?? null,
            statusProfissional: rr.status != null ? String(rr.status) : null,
            docsVerificado: Boolean(rr.docs_verificado),
          })
        }
      } else if (role === 'turista') {
        const { data: tur, error: et } = await supabase
          .from('turistas')
          .select('nome_completo, nome_usuario, foto_url, foto_perfil_url, bio, foto_capa_url')
          .eq('usuario_id', profileId)
          .maybeSingle()
        if (et) console.warn('Perfil turistas:', et.message)
        if (!et && tur && typeof tur === 'object' && !Array.isArray(tur)) {
          perfilRow = tur as Record<string, unknown>
        }
        setProfMeta({
          categorias: null,
          placaVermelha: false,
          verificadoEm: null,
          cadastradoEm: null,
          statusProfissional: null,
          docsVerificado: false,
        })
      }

      const nomePerfil =
        perfilRow?.nome_completo != null
          ? String(perfilRow.nome_completo)
          : u.email
            ? String(u.email).split('@')[0]
            : 'Usuário'
      const usernamePerfil =
        perfilRow?.nome_usuario != null
          ? String(perfilRow.nome_usuario)
          : u.email
            ? String(u.email).split('@')[0]
            : 'usuario'
      const pickFoto = (v: unknown) => {
        if (v == null) return ''
        const s = String(v).trim()
        if (!s) return ''
        if (s.includes('avatar-default')) return ''
        return s
      }
      const fotoPerfilRow = pickFoto(perfilRow?.foto_perfil_url) || pickFoto(perfilRow?.foto_url) || null

      setNome(nomePerfil)
      setUsername(usernamePerfil)
      setFotoPerfil(fotoPerfilRow)
      setBio(perfilRow?.bio != null ? String(perfilRow.bio) : null)
      setCapaUrl(perfilRow?.foto_capa_url != null ? String(perfilRow.foto_capa_url) : null)

      if (!fotoPerfilRow) {
        const url = await fetchFotoPerfilUsuario(supabase, profileId)
        if (url && url.trim() !== '') {
          setFotoPerfil(url)
        }
      }

      await atualizarMetricasPerfil()

      const { data: postsFoto } = await supabase
        .from('posts')
        .select(
          'id, conteudo_url, foto_url, tipo, texto, total_curtidas, total_comentarios, total_compartilhamentos, total_reposts, post_original_id, created_at'
        )
        .eq('autor_id', profileId)
        .is('deleted_at', null)
        .is('post_original_id', null)
        .in('tipo', ['foto', 'misto'])
        .order('created_at', { ascending: false })

      const fotosRows: FotoPostItem[] =
        postsFoto
          ?.map((p) => {
            const uu = p.conteudo_url || p.foto_url
            if (uu == null) return null
            return {
              id: String(p.id),
              url: String(uu),
              texto: p.texto != null ? String(p.texto) : null,
              created_at: String(p.created_at ?? ''),
              tipo: p.tipo != null ? String(p.tipo) : 'foto',
              total_curtidas: Number(p.total_curtidas) || 0,
              total_comentarios: Number(p.total_comentarios) || 0,
              total_compartilhamentos: Number(p.total_compartilhamentos) || 0,
              total_reposts: Number(p.total_reposts) || 0,
              post_original_id: p.post_original_id != null ? String(p.post_original_id) : null,
            }
          })
          .filter((x): x is FotoPostItem => x != null) ?? []
      setPostsFotos(fotosRows)

      const { data: postsTxt } = await supabase
        .from('posts')
        .select('id, texto, created_at, total_curtidas, total_comentarios, tipo, post_original_id')
        .eq('autor_id', profileId)
        .is('deleted_at', null)
        .is('post_original_id', null)
        .in('tipo', ['postagem', 'texto'])
        .order('created_at', { ascending: false })

      const textoRows =
        postsTxt?.filter((p) => {
          const t = String(p.tipo || '')
          if (t === 'texto') return true
          if (t === 'postagem') {
            const tx = String(p.texto || '')
            return !tx.includes('Confira:') || !tx.includes('post=')
          }
          return true
        }) ?? []

      setPostsTexto(
        textoRows.map((p) => ({
          id: String(p.id),
          texto: p.texto != null ? String(p.texto) : null,
          created_at: String(p.created_at ?? ''),
          total_curtidas: Number(p.total_curtidas) || 0,
          total_comentarios: Number(p.total_comentarios) || 0,
        }))
      )

      const { data: reps } = await supabase
        .from('posts')
        .select('id')
        .eq('autor_id', profileId)
        .not('post_original_id', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const repRows = reps ?? []
      const repIds = repRows.map((p) => String(p.id)).filter(Boolean)

      if (repIds.length === 0) {
        setRepostadosPosts([])
      } else {
        const { data: viewRows, error: repViewErr } = await supabase
          .from('posts_com_autores')
          .select('*')
          .in('id', repIds)
          .is('deleted_at', null)
        if (repViewErr) console.warn('Perfil repostados posts_com_autores:', repViewErr.message)

        const byId = new Map<string, Record<string, unknown>>()
        for (const row of viewRows ?? []) {
          const raw = row as Record<string, unknown>
          const rid = String(raw.id ?? '')
          if (rid) byId.set(rid, raw)
        }

        const ordenados: PostRepostFeed[] = []
        for (const row of repRows) {
          const rid = String(row.id)
          const raw = byId.get(rid)
          if (!raw) continue
          ordenados.push(mapPostComAutoresRow(raw))
        }
        setRepostadosPosts(ordenados)
      }
    } catch {
      setErro('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }, [profileId, meuId, atualizarMetricasPerfil])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onPerfilAtualizado = () => {
      void atualizarMetricasPerfil()
    }
    window.addEventListener('perfil-atualizado', onPerfilAtualizado)
    return () => window.removeEventListener('perfil-atualizado', onPerfilAtualizado)
  }, [atualizarMetricasPerfil])

  useEffect(() => {
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const id = session?.user?.id ?? null
      setMeuId(id)
      setMeuEmail(session?.user?.email ?? null)
      if (!id) {
        setMeuRole(null)
        setMeuEmail(null)
        setPlacaVermelha(false)
        setAdminLevel(0)
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('role, admin_level')
        .eq('id', id)
        .maybeSingle()
      const row = data as { role?: string; admin_level?: number } | null
      setMeuRole(row?.role != null ? String(row.role) : null)
      setAdminLevel(typeof row?.admin_level === 'number' ? row.admin_level : 0)

      const { data: profRow } = await supabase.from('profissionais').select('placa_vermelha').eq('usuario_id', id).maybeSingle()
      setPlacaVermelha(Boolean((profRow as { placa_vermelha?: boolean } | null)?.placa_vermelha))
    }
    void boot()
  }, [])

  useEffect(() => {
    const onPostDeleted = (e: Event) => {
      const ce = e as CustomEvent<{ postId: string; postParentId: string | null }>
      const { postId, postParentId } = ce.detail ?? {}
      if (!postId) return
      setRepostadosPosts((prev) =>
        prev.filter((r) => {
          if (r.id === postId) return false
          if (postParentId == null && r.post_original_id === postId) return false
          return true
        })
      )
    }
    window.addEventListener(POST_DELETED_EVENT, onPostDeleted)
    return () => window.removeEventListener(POST_DELETED_EVENT, onPostDeleted)
  }, [])

  const counts = useMemo(
    () => ({
      fotos: postsFotos.length,
      posts: postsTexto.length,
      republicados: repostadosPosts.length,
    }),
    [postsFotos.length, postsTexto.length, repostadosPosts.length]
  )

  const favoritosTotal = nFavEmp + nFavUsers

  const abrirFavoritos = useCallback(() => {
    setPopSeg(false)
    setPopAval(false)
    setPopFav(true)
  }, [])

  const abrirSeguidores = useCallback(() => {
    setPopFav(false)
    setPopAval(false)
    setPopSeg(true)
  }, [])

  const abrirAvaliacoes = useCallback(() => {
    setPopFav(false)
    setPopSeg(false)
    setPopAval(true)
  }, [])

  const perfilTipo = perfilRole === 'profissional' ? 'profissional' : 'turista'

  const staffDashboard =
    meuRole === 'admin' || (typeof adminLevel === 'number' && adminLevel >= 1 && adminLevel <= 4)

  const menuVariant =
    meuId && profileId && meuId === profileId && meuRole
      ? staffDashboard
        ? 'admin'
        : meuRole === 'turista' || meuRole === 'profissional'
          ? meuRole
          : null
      : null

  if (!profileId) {
    return <p className="p-4 text-center text-gray-500">ID inválido</p>
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Carregando perfil…
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-gray-600">{erro}</p>
        <button type="button" onClick={() => router.back()} className="text-[#0097b2]">
          Voltar
        </button>
      </div>
    )
  }

  const displayUsernameRaw = String(username ?? '')
    .trim()
    .replace(/^@+/, '')
  const displayUsername =
    displayUsernameRaw.length > 15 ? `${displayUsernameRaw.slice(0, 15)}…` : displayUsernameRaw
  const usernameTextClass =
    displayUsernameRaw.length > 10 ? 'text-[13px]' : 'text-[15px]'

  const souDono = Boolean(meuId && profileId && meuId === profileId)
  const mostrarBotaoSeguir = Boolean(meuId && !souDono)
  const mostrarMenu = Boolean(souDono && menuVariant)

  return (
    <div className="bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="-ml-2 rounded-full p-2 transition-colors hover:bg-gray-100"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <span
              className={`block min-w-0 max-w-[min(50vw,320px)] truncate font-normal text-gray-600 ${
                displayUsernameRaw.length > 10 ? 'text-[16px]' : 'text-[17px]'
              }`}
            >
              @{displayUsername || 'usuario'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {mostrarBotaoSeguir ? (
              <BotaoSeguir
                alvoId={profileId}
                alvoTipo="usuario"
                seguidoTipo={perfilRole}
                isFollowing={seguindoPerfil}
                onToggle={(novo) => {
                  setSeguindoPerfil(novo)
                  setNSeguidores((n) => Math.max(0, n + (novo ? 1 : -1)))
                  void atualizarMetricasPerfil()
                }}
                layout="inline"
              />
            ) : null}
            {mostrarMenu ? <BotaoAbrirMenuLateral onClick={() => setMenuAberto(true)} /> : null}
          </div>
        </div>
      </header>

      <FotoCapa
        src={fotoPerfil}
        nomeFallback={nome}
        mostrarMenu={false}
      />

      <div className="mt-3 px-4 text-left">
        <NomeSocial
          nome={nome}
          mostrarCartao={perfilRole === 'profissional'}
          profissionalVerificado={profMeta.statusProfissional === 'aprovado'}
          contaVerificada={
            perfilRole === 'profissional' &&
            contaVerificadaDocumentacao('profissional', {
              docs_verificado: profMeta.docsVerificado,
              status: profMeta.statusProfissional,
            })
          }
          onAbrirCartao={() => setPopCartao(true)}
        />
        <div className="mt-1">
          <DescricaoCurta texto={bio} />
        </div>
      </div>

      <div className="mt-6">
        <MetricasPerfil
          favoritosCount={favoritosTotal}
          seguidoresCount={nSeguidores}
          avaliacoesCount={nAval}
          onFavoritos={abrirFavoritos}
          onSeguidores={abrirSeguidores}
          onAvaliacoes={abrirAvaliacoes}
        />
      </div>

      <div className="mt-4">
        <AbasPerfil ativa={aba} onChange={setAba} counts={counts} />
        <div className="bg-gray-50 pt-2 pb-0">
          {aba === 'fotos' ? <AbaFotos posts={postsFotos} onOpen={(i) => setModalFoto({ aberto: true, i })} /> : null}
          {aba === 'posts' ? <AbaPosts posts={postsTexto} /> : null}
          {aba === 'republicados' ? (
            <AbaRepublicados
              posts={repostadosPosts}
              meuUsuarioId={meuId}
              userEmail={meuEmail}
              onPostLocalPatch={patchRepostadoPost}
              onEngagementChange={onEngagementRepostado}
              onRemovePost={(postId) => setRepostadosPosts((prev) => prev.filter((p) => p.id !== postId))}
              onRepostRemovido={(repostPostId) =>
                setRepostadosPosts((prev) => prev.filter((p) => p.id !== repostPostId))
              }
            />
          ) : null}
        </div>
      </div>

      <MenuLateral
        aberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
        variant={menuVariant}
        nome={nome}
        username={username}
        fotoUrl={fotoPerfil}
        usuarioId={meuId}
        placaVermelha={placaVermelha}
        adminLevel={adminLevel}
        bioText={bio ?? ''}
        recursosProfissionaisLiberados={recursosProfissionaisLiberados}
        onPerfilAtualizado={() => void carregar()}
      />

      <PopupFavoritos aberto={popFav} onFechar={() => setPopFav(false)} profileId={profileId} meuId={meuId} />
      <PopupSeguidores aberto={popSeg} onFechar={() => setPopSeg(false)} profileId={profileId} meuId={meuId} />
      <PopupAvaliacoes
        aberto={popAval}
        onFechar={() => setPopAval(false)}
        profileId={profileId}
        perfilTipo={perfilTipo}
      />
      <PopupCartaoVisitaProfissional
        aberto={popCartao}
        onFechar={() => setPopCartao(false)}
        nome={nome}
        username={username}
        avatarUrl={fotoPerfil}
        verificadoEm={profMeta.verificadoEm}
        cadastradoEm={profMeta.cadastradoEm}
        categorias={profMeta.categorias}
        placaVermelha={profMeta.placaVermelha}
        profissionalVerificado={profMeta.statusProfissional === 'aprovado'}
        onContratar={() => router.push('/canal')}
      />

      <ModalFoto
        posts={postsFotos}
        indiceInicial={modalFoto.i}
        aberto={modalFoto.aberto}
        onFechar={() => setModalFoto({ aberto: false, i: 0 })}
        meuUsuarioId={meuId}
        autor={{
          nome,
          username,
          foto_perfil_url: fotoPerfil,
          usuario_id: profileId,
          role: perfilRole,
        }}
        onPatchPost={patchFotoPost}
        onRemovePost={(postId) => setPostsFotos((prev) => prev.filter((p) => p.id !== postId))}
      />
    </div>
  )
}