'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FotoCapa from '@/components/perfil/FotoCapa'
import MenuLateral from '@/components/perfil/MenuLateral'
import NomeSocial from '@/components/perfil/NomeSocial'
import Username from '@/components/perfil/Username'
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
import { pickAutorDisplay } from '@/lib/feed-autor'

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

type RepublicadoLinha = {
  id: string
  created_at: string
  texto: string | null
  foto_url: string | null
  conteudo_url: string | null
  tipo: string
  avaliacao_meta: Record<string, unknown> | null
  originalId: string | null
  autorOriginal: string | null
  usernameOriginal: string | null
}

export default function PerfilSocialPage() {
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
  /** status em `usuarios` (pre_aprovado, ativo, …) */
  const [perfilContaStatus, setPerfilContaStatus] = useState<string | null>(null)

  const [nFavEmp, setNFavEmp] = useState(0)
  const [nFavUsers, setNFavUsers] = useState(0)
  const [nSeguidores, setNSeguidores] = useState(0)
  const [nAval, setNAval] = useState(0)

  const [aba, setAba] = useState<'fotos' | 'posts' | 'republicados'>('fotos')
  const [postsFotos, setPostsFotos] = useState<FotoPostItem[]>([])
  const [postsTexto, setPostsTexto] = useState<PostLinha[]>([])
  const [republicados, setRepublicados] = useState<RepublicadoLinha[]>([])

  const [menuAberto, setMenuAberto] = useState(false)
  const [popFav, setPopFav] = useState(false)
  const [popSeg, setPopSeg] = useState(false)
  const [popAval, setPopAval] = useState(false)
  const [modalFoto, setModalFoto] = useState({ aberto: false, i: 0 })

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

  const carregar = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    setErro('')
    try {
      const { data: u, error: eu } = await supabase
        .from('usuarios')
        .select('id, email, role, status')
        .eq('id', profileId)
        .maybeSingle()

      if (eu || !u) {
        setErro('Perfil não encontrado')
        return
      }

      const role = u.role != null ? String(u.role) : null
      setPerfilRole(role)
      setPerfilContaStatus(u.status != null ? String(u.status) : null)

      if (role === 'empresa') {
        setErro('Use a página da empresa para perfis comerciais.')
        return
      }

      if (role !== 'turista' && role !== 'profissional' && role !== 'admin') {
        setErro('Perfil social disponível apenas para turistas, profissionais e administradores.')
        return
      }

      /** Duas consultas separadas (sem embed em `usuarios`) — profissional/anfitrião antes; turista como fallback p/ admin. */
      let perfilRow: Record<string, unknown> | null = null

      if (role === 'profissional' || role === 'admin') {
        const { data: prof, error: ep } = await supabase
          .from('profissionais')
          .select('nome_completo, nome_usuario, foto_url, foto_perfil_url, bio, foto_capa_url')
          .eq('usuario_id', profileId)
          .maybeSingle()
        if (ep) console.warn('Perfil profissionais:', ep.message)
        if (!ep && prof && typeof prof === 'object' && !Array.isArray(prof)) {
          perfilRow = prof as Record<string, unknown>
        }
      }

      if (!perfilRow && (role === 'turista' || role === 'admin')) {
        const { data: tur, error: et } = await supabase
          .from('turistas')
          .select('nome_completo, nome_usuario, foto_url, foto_perfil_url, bio, foto_capa_url')
          .eq('usuario_id', profileId)
          .maybeSingle()
        if (et) console.warn('Perfil turistas:', et.message)
        if (!et && tur && typeof tur === 'object' && !Array.isArray(tur)) {
          perfilRow = tur as Record<string, unknown>
        }
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
      const fotoPerfilRow =
        perfilRow?.foto_url != null
          ? String(perfilRow.foto_url)
          : perfilRow?.foto_perfil_url != null
            ? String(perfilRow.foto_perfil_url)
            : null

      setNome(nomePerfil)
      setUsername(usernamePerfil)
      setFotoPerfil(fotoPerfilRow)
      setBio(perfilRow?.bio != null ? String(perfilRow.bio) : null)
      setCapaUrl(perfilRow?.foto_capa_url != null ? String(perfilRow.foto_capa_url) : null)

      const [{ count: cFav }, { count: cSegU }, { count: cSegMe }, { count: cAval }] = await Promise.all([
        supabase.from('favoritos').select('id', { count: 'exact', head: true }).eq('usuario_id', profileId),
        supabase.from('redecontatos').select('id', { count: 'exact', head: true }).eq('seguidor_id', profileId),
        supabase.from('redecontatos').select('id', { count: 'exact', head: true }).eq('seguido_id', profileId),
        supabase.from('avaliacoes').select('id', { count: 'exact', head: true }).eq('usuario_id', profileId),
      ])

      setNFavEmp(cFav ?? 0)
      setNFavUsers(cSegU ?? 0)
      setNSeguidores(cSegMe ?? 0)
      setNAval(cAval ?? 0)

      const { data: postsFoto } = await supabase
        .from('posts')
        .select(
          'id, conteudo_url, foto_url, tipo, texto, total_curtidas, total_comentarios, total_compartilhamentos, total_reposts, post_original_id, created_at'
        )
        .eq('autor_id', profileId)
        .is('deleted_at', null)
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
        .select('id, texto, created_at, foto_url, conteudo_url, tipo, post_original_id, avaliacao_meta')
        .eq('autor_id', profileId)
        .not('post_original_id', 'is', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const repRows = reps ?? []
      const origIds = [...new Set(repRows.map((p) => (p.post_original_id != null ? String(p.post_original_id) : null)).filter((x): x is string => Boolean(x)))]
      const origMap = /** @type {Map<string, { autor: ReturnType<typeof pickAutorDisplay> }>} */ (new Map())
      if (origIds.length) {
        const { data: origPosts, error: origViewErr } = await supabase
          .from('posts_com_autores')
          .select('*')
          .in('id', origIds)
          .is('deleted_at', null)
        if (origViewErr) console.warn('Perfil republicados posts_com_autores:', origViewErr.message)

        for (const op of origPosts ?? []) {
          const raw = op as Record<string, unknown>
          const oid = String(raw.id ?? '')
          if (!oid) continue
          let rawU: unknown = raw.usuarios
          if (typeof raw.usuarios === 'string') {
            try {
              rawU = JSON.parse(raw.usuarios)
            } catch {
              rawU = null
            }
          }
          const autor = pickAutorDisplay(rawU)
          origMap.set(oid, { autor })
        }
      }

      setRepublicados(
        repRows.map((p) => {
          const oid = p.post_original_id != null ? String(p.post_original_id) : null
          const o = oid ? origMap.get(oid) : undefined
          const am = p.avaliacao_meta
          return {
            id: String(p.id),
            created_at: String(p.created_at ?? ''),
            texto: p.texto != null ? String(p.texto) : null,
            foto_url: p.foto_url != null ? String(p.foto_url) : null,
            conteudo_url: p.conteudo_url != null ? String(p.conteudo_url) : null,
            tipo: p.tipo != null ? String(p.tipo) : 'texto',
            avaliacao_meta: am && typeof am === 'object' && !Array.isArray(am) ? (am as Record<string, unknown>) : null,
            originalId: oid,
            autorOriginal: o?.autor.nome ?? null,
            usernameOriginal: o?.autor.username ?? null,
          }
        })
      )
    } catch {
      setErro('Erro ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const id = session?.user?.id ?? null
      setMeuId(id)
      if (!id) {
        setMeuRole(null)
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

  const counts = useMemo(
    () => ({
      fotos: postsFotos.length,
      posts: postsTexto.length,
      republicados: republicados.length,
    }),
    [postsFotos.length, postsTexto.length, republicados.length]
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

  const mostrarFaixaAnalise =
    perfilContaStatus != null &&
    perfilContaStatus !== 'ativo' &&
    (perfilRole === 'profissional' || perfilRole === 'turista')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <FotoCapa
        src={fotoPerfil}
        nomeFallback={nome}
        onOpenMenu={() => setMenuAberto(true)}
        mostrarMenu={Boolean(menuVariant)}
      />

      {mostrarFaixaAnalise ? (
        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-950">
          Perfil em análise. Após aprovação do administrador, todos os recursos do ecossistema ficam liberados.
        </div>
      ) : null}

      <div className="mt-3 px-4 text-left">
        <NomeSocial nome={nome} />
        <Username username={username} />
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
        <div className="min-h-[200px] bg-gray-50 py-2">
          {aba === 'fotos' ? <AbaFotos posts={postsFotos} onOpen={(i) => setModalFoto({ aberto: true, i })} /> : null}
          {aba === 'posts' ? <AbaPosts posts={postsTexto} /> : null}
          {aba === 'republicados' ? <AbaRepublicados itens={republicados} /> : null}
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