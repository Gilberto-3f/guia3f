'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import AbasAtividades from '@/components/atividades/AbasAtividades'
import AtividadeCurtidas from '@/components/atividades/AtividadeCurtidas'
import AtividadeCurtiuComentario from '@/components/atividades/AtividadeCurtiuComentario'
import AtividadeCurtiuPost from '@/components/atividades/AtividadeCurtiuPost'
import AtividadeCurtiuRepost from '@/components/atividades/AtividadeCurtiuRepost'
import AtividadeCurtiuAvaliacao from '@/components/atividades/AtividadeCurtiuAvaliacao'
import AtividadeComentario from '@/components/atividades/AtividadeComentario'
import AtividadeSeguidor from '@/components/atividades/AtividadeSeguidor'
import AtividadeAvaliacao from '@/components/atividades/AtividadeAvaliacao'
import { agruparAtividadesCurtidasPost, urlFotoPost } from '@/lib/atividades-feed'

const LS_AMIGOS_VISTO = 'guia3f_atividades_amigos_visto_em'

type AtividadeRow = {
  id: string
  usuario_id: string
  /** Quem realizou a ação (alinha à coluna `autor_id` em `public.atividades`). */
  autor_id: string
  tipo: string
  alvo_id: string
  alvo_tipo: string
  dados_extras: Record<string, unknown> | null
  lida: boolean
  created_at: string
}

type PerfilMap = Record<string, ReturnType<typeof pickAutorDisplay>>

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function tituloBlocoData(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  if (sameDay(d, hoje)) return 'HOJE'
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  if (sameDay(d, ontem)) return 'ONTEM'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const USUARIOS_SELECT = `
  id,
  email,
  role,
  turistas (nome_completo, nome_usuario, foto_perfil_url),
  profissionais (nome_completo, nome_usuario, foto_perfil_url),
  empresas (id, nome_fantasia, nome_usuario, foto_url)
`

export default function AtividadesPage() {
  const [aba, setAba] = useState<'amigos' | 'minha'>('amigos')
  const [buscaEdicao, setBuscaEdicao] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [meuId, setMeuId] = useState<string | null>(null)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [listaAmigos, setListaAmigos] = useState<AtividadeRow[]>([])
  const [listaMinha, setListaMinha] = useState<AtividadeRow[]>([])
  const [perfilMap, setPerfilMap] = useState<PerfilMap>({})
  const [postMetaMap, setPostMetaMap] = useState<
    Record<
      string,
      {
        id: string
        tipo: string | null
        texto: string | null
        conteudo_url: string | null
        foto_url: string | null
        post_original_id: string | null
        avaliacao_meta: unknown
        autor_id: string
      }
    >
  >({})
  const [empresaMap, setEmpresaMap] = useState<Record<string, { id: string; nome: string }>>({})
  const [seguidoEmpresaMap, setSeguidoEmpresaMap] = useState<Record<string, string>>({})
  const [qtdSeguindo, setQtdSeguindo] = useState(0)

  const coletarIdsPerfis = useCallback((rows: AtividadeRow[]) => {
    const ids = new Set<string>()
    for (const r of rows) {
      ids.add(r.autor_id)
      ids.add(r.usuario_id)
      const ex = r.dados_extras
      if (ex && typeof ex === 'object') {
        const seguidor = ex.seguidor_id
        const seguido = ex.seguido_id
        if (typeof seguidor === 'string') ids.add(seguidor)
        if (typeof seguido === 'string') ids.add(seguido)
      }
    }
    return [...ids]
  }, [])

  const hrefUsuario = useCallback(
    (uid: string) => {
      const p = perfilMap[uid]
      if (p?.role === 'empresa' && p.empresa_id) return `/empresa/${p.empresa_id}`
      return `/perfil/${uid}`
    },
    [perfilMap]
  )

  const carregarPerfis = useCallback(
    async (rows: AtividadeRow[]) => {
      const ids = coletarIdsPerfis(rows)
      if (ids.length === 0) {
        setPerfilMap({})
        return
      }
      const { data, error } = await supabase.from('usuarios').select(USUARIOS_SELECT).in('id', ids)
      if (error || !data) {
        setPerfilMap({})
        return
      }
      const m: PerfilMap = {}
      for (const u of data) {
        const row = u as unknown as Record<string, unknown>
        const id = row.id != null ? String(row.id) : ''
        if (id) m[id] = pickAutorDisplay(u)
      }
      setPerfilMap(m)

      const empresaUsuarioIds = ids.filter((id) => m[id]?.role === 'empresa')
      if (empresaUsuarioIds.length > 0) {
        const { data: emps } = await supabase.from('empresas').select('id, usuario_id').in('usuario_id', empresaUsuarioIds)
        const sm: Record<string, string> = {}
        for (const e of emps ?? []) {
          const rec = e as { id: string; usuario_id: string }
          sm[rec.usuario_id] = String(rec.id)
        }
        setSeguidoEmpresaMap(sm)
      } else {
        setSeguidoEmpresaMap({})
      }
    },
    [coletarIdsPerfis]
  )

  const carregarPostsMeta = useCallback(async (postIds: string[]) => {
    const uniq = [...new Set(postIds)].filter(Boolean)
    if (uniq.length === 0) {
      setPostMetaMap({})
      return
    }
    const sel =
      'id, tipo, texto, conteudo_url, foto_url, post_original_id, avaliacao_meta, autor_id'

    const mergeRows = (
      acc: Record<
        string,
        {
          id: string
          tipo: string | null
          texto: string | null
          conteudo_url: string | null
          foto_url: string | null
          post_original_id: string | null
          avaliacao_meta: unknown
          autor_id: string
        }
      >,
      rows: unknown[]
    ) => {
      for (const raw of rows) {
        const p = raw as {
          id: string
          tipo: string | null
          texto: string | null
          conteudo_url: string | null
          foto_url: string | null
          post_original_id: string | null
          avaliacao_meta: unknown
          autor_id: string
        }
        acc[String(p.id)] = { ...p }
      }
      return acc
    }

    const { data, error } = await supabase.from('posts').select(sel).in('id', uniq)
    if (error || !data) {
      setPostMetaMap({})
      return
    }
    let m = mergeRows({}, data as unknown[])

    const originais = [...new Set(Object.values(m).map((p) => p.post_original_id).filter((x): x is string => Boolean(x)))].filter((id) => !m[id])

    if (originais.length > 0) {
      const { data: origData } = await supabase.from('posts').select(sel).in('id', originais)
      m = mergeRows(m, (origData ?? []) as unknown[])
    }

    setPostMetaMap(m)
  }, [])

  const carregarEmpresasAvaliacao = useCallback(async (empresaIds: string[]) => {
    const uniq = [...new Set(empresaIds)].filter(Boolean)
    if (uniq.length === 0) {
      setEmpresaMap({})
      return
    }
    const { data, error } = await supabase.from('empresas').select('id, nome_fantasia, nome_usuario').in('id', uniq)
    if (error || !data) {
      setEmpresaMap({})
      return
    }
    const m: Record<string, { id: string; nome: string }> = {}
    for (const e of data) {
      const row = e as { id: string; nome_fantasia: string | null; nome_usuario: string | null }
      m[String(row.id)] = {
        id: String(row.id),
        nome: String(row.nome_fantasia ?? row.nome_usuario ?? 'Empresa'),
      }
    }
    setEmpresaMap(m)
  }, [])

  const recarregar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    setMeuId(uid)
    if (!uid) {
      setCarregando(false)
      setListaAmigos([])
      setListaMinha([])
      setQtdSeguindo(0)
      return
    }

    const { data: urow } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
    const role = (urow as { role?: string } | null)?.role ?? null
    setMeuRole(role)

    if (role === 'empresa') {
      setCarregando(false)
      setListaAmigos([])
      setListaMinha([])
      setQtdSeguindo(0)
      return
    }

    const { data: segRows } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', uid)
    const seguindo = (segRows ?? []).map((r) => String((r as { seguido_id: string }).seguido_id))
    setQtdSeguindo(seguindo.length)

    const [amigosRes, minhaRes] = await Promise.all([
      seguindo.length
        ? supabase.from('atividades').select('*').in('autor_id', seguindo).order('created_at', { ascending: false }).limit(200)
        : Promise.resolve({ data: [] as AtividadeRow[], error: null }),
      supabase.from('atividades').select('*').eq('usuario_id', uid).order('created_at', { ascending: false }).limit(200),
    ])

    const amigos = (amigosRes.data ?? []) as AtividadeRow[]
    const minha = (minhaRes.data ?? []) as AtividadeRow[]

    setListaAmigos(amigos)
    setListaMinha(minha)

    const todos = [...amigos, ...minha]
    await carregarPerfis(todos)

    const postIds: string[] = []
    for (const r of todos) {
      if (r.tipo === 'curtiu_post') postIds.push(r.alvo_id)
      const ex = r.dados_extras
      if (ex && typeof ex === 'object') {
        const pid = ex.post_id
        if (typeof pid === 'string') postIds.push(pid)
      }
    }
    await carregarPostsMeta(postIds)

    const empIds: string[] = []
    for (const r of todos) {
      if (r.tipo === 'avaliou') empIds.push(r.alvo_id)
    }
    await carregarEmpresasAvaliacao(empIds)

    setCarregando(false)
  }, [carregarPerfis, carregarPostsMeta, carregarEmpresasAvaliacao])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const marcarMinhaLidas = useCallback(async () => {
    if (!meuId) return
    await supabase.from('atividades').update({ lida: true }).eq('usuario_id', meuId).eq('lida', false)
    setListaMinha((prev) => prev.map((r) => ({ ...r, lida: true })))
  }, [meuId])

  const onAba = useCallback(
    (a: 'amigos' | 'minha') => {
      setAba(a)
      if (a === 'minha') void marcarMinhaLidas()
      if (a === 'amigos' && typeof window !== 'undefined') {
        window.localStorage.setItem(LS_AMIGOS_VISTO, new Date().toISOString())
      }
    },
    [marcarMinhaLidas]
  )

  const buscarUsuario = useCallback(() => {
    setBuscaAplicada(buscaEdicao.trim())
  }, [buscaEdicao])

  const listaAtividadesFiltrada = useMemo(() => {
    const fonte = aba === 'amigos' ? listaAmigos : listaMinha
    const q = buscaAplicada.trim().toLowerCase()
    if (!q) return fonte

    const perfilCombina = (uid: string) => {
      const p = perfilMap[uid]
      if (!p) return false
      const un = (p.username ?? '').toLowerCase()
      const nm = (p.nome ?? '').toLowerCase()
      const needle = q.replace(/^@/, '')
      return un.includes(needle) || nm.includes(needle) || un.includes(q) || nm.includes(q)
    }

    return fonte.filter((r) => {
      if (perfilCombina(r.autor_id)) return true
      if (perfilCombina(r.usuario_id)) return true
      if (r.tipo === 'seguiu' && r.dados_extras && typeof r.dados_extras === 'object') {
        const ex = r.dados_extras
        const seguido = typeof ex.seguido_id === 'string' ? ex.seguido_id : null
        const seguidor = typeof ex.seguidor_id === 'string' ? ex.seguidor_id : null
        if (seguido && perfilCombina(seguido)) return true
        if (seguidor && perfilCombina(seguidor)) return true
      }
      return false
    })
  }, [aba, listaAmigos, listaMinha, buscaAplicada, perfilMap])

  const itensAgrupados = useMemo(() => {
    const ord = [...listaAtividadesFiltrada].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return agruparAtividadesCurtidasPost(ord, postMetaMap)
  }, [listaAtividadesFiltrada, postMetaMap])

  const blocosComTitulo = useMemo(() => {
    const blocos: { titulo: string; key: string; itens: typeof itensAgrupados }[] = []
    let tituloAtual = ''
    let keyAtual = ''
    let chunk: typeof itensAgrupados = []
    for (const item of itensAgrupados) {
      const iso =
        item.kind === 'outro' || item.kind === 'curtiu_post_solo' ? item.row.created_at : item.created_at
      const t = tituloBlocoData(iso)
      if (t !== tituloAtual) {
        if (chunk.length) blocos.push({ titulo: tituloAtual, key: keyAtual, itens: chunk })
        tituloAtual = t
        keyAtual = dayKey(iso)
        chunk = []
      }
      chunk.push(item)
    }
    if (chunk.length) blocos.push({ titulo: tituloAtual, key: keyAtual, itens: chunk })
    return blocos
  }, [itensAgrupados])

  const renderItem = (item: (typeof itensAgrupados)[number], idx: number) => {
    if (item.kind === 'curtiu_post_fotos') {
      const inter = perfilMap[item.autor_id]
      const donor = perfilMap[item.usuario_dono_id]
      const urlsBrutas = item.rows.map((r) => urlFotoPost(postMetaMap[r.alvo_id])).filter((u): u is string => Boolean(u))
      const urlsGrid = urlsBrutas.length ? urlsBrutas : item.rows.map(() => '/window.svg')
      return (
        <AtividadeCurtidas
          key={`cf-${item.autor_id}-${item.usuario_dono_id}-${item.created_at}-${idx}`}
          interactorUsername={inter?.username ?? 'usuario'}
          interactorFoto={inter?.foto_perfil_url ?? null}
          donorUsername={donor?.username ?? 'usuario'}
          hrefInteractor={hrefUsuario(item.autor_id)}
          hrefDonor={hrefUsuario(item.usuario_dono_id)}
          urls={urlsGrid}
          totalCurtidas={item.rows.length}
        />
      )
    }

    if (item.kind === 'curtiu_post_solo') {
      const r = item.row
      const inter = perfilMap[r.autor_id]
      const donor = perfilMap[r.usuario_id]
      const post = postMetaMap[r.alvo_id]
      const textoPost = post?.texto != null ? String(post.texto) : ''
      const hrefI = hrefUsuario(r.autor_id)
      const hrefD = hrefUsuario(r.usuario_id)

      if (item.categoria === 'texto') {
        return (
          <AtividadeCurtiuPost
            key={r.id}
            interactorUsername={inter?.username ?? 'usuario'}
            interactorFoto={inter?.foto_perfil_url ?? null}
            donorUsername={donor?.username ?? 'usuario'}
            hrefInteractor={hrefI}
            hrefDonor={hrefD}
            texto={textoPost}
            postId={r.alvo_id}
          />
        )
      }

      if (item.categoria === 'avaliacao') {
        const rawMeta = post?.avaliacao_meta
        const meta =
          rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
            ? { ...(rawMeta as Record<string, unknown>) }
            : null
        if (meta && typeof meta.comentario === 'string' && meta.feedback == null) meta.feedback = meta.comentario
        return (
          <AtividadeCurtiuAvaliacao
            key={r.id}
            interactorUsername={inter?.username ?? 'usuario'}
            interactorFoto={inter?.foto_perfil_url ?? null}
            donorUsername={donor?.username ?? 'usuario'}
            hrefInteractor={hrefI}
            hrefDonor={hrefD}
            postId={r.alvo_id}
            meta={meta}
          />
        )
      }

      if (item.categoria === 'repost') {
        const origId = post?.post_original_id
        const orig = origId ? postMetaMap[String(origId)] : null
        const prevUrl = urlFotoPost(orig)
        const prevTexto = orig?.texto != null ? String(orig.texto) : ''
        const tipoOrig = (orig?.tipo ?? 'texto').toLowerCase()
        const previewTipo: 'foto' | 'texto' =
          tipoOrig === 'foto' || tipoOrig === 'misto' || (Boolean(prevUrl) && !prevTexto.trim()) ? 'foto' : 'texto'

        const modalChildren = (
          <div className="space-y-3">
            {prevUrl ? (
              <div className="relative mx-auto h-72 w-full max-w-sm overflow-hidden rounded-lg bg-gray-100">
                <Image src={prevUrl} alt="" fill className="object-contain" sizes="(max-width: 448px) 100vw, 448px" />
              </div>
            ) : null}
            {prevTexto ? <p className="whitespace-pre-wrap text-sm text-gray-800">{prevTexto}</p> : null}
          </div>
        )

        return (
          <AtividadeCurtiuRepost
            key={r.id}
            interactorUsername={inter?.username ?? 'usuario'}
            interactorFoto={inter?.foto_perfil_url ?? null}
            donorUsername={donor?.username ?? 'usuario'}
            hrefInteractor={hrefI}
            hrefDonor={hrefD}
            postId={r.alvo_id}
            previewTipo={previewTipo}
            previewUrl={prevUrl}
            previewTexto={prevTexto || textoPost}
            modalChildren={modalChildren}
          />
        )
      }

      return null
    }

    const r = item.row
    const ator = perfilMap[r.autor_id]

    if (r.tipo === 'curtiu_comentario') {
      const ex = r.dados_extras ?? {}
      const postId = typeof ex.post_id === 'string' ? ex.post_id : ''
      const texto = String(ex.texto ?? '')
      const donorId = r.usuario_id
      const donor = perfilMap[donorId]
      return (
        <AtividadeCurtiuComentario
          key={r.id}
          usernameAtor={ator?.username ?? 'usuario'}
          interactorFoto={ator?.foto_perfil_url ?? null}
          usernameDono={donor?.username ?? 'usuario'}
          hrefInteractor={hrefUsuario(r.autor_id)}
          hrefDono={hrefUsuario(donorId)}
          textoComentario={texto}
          postId={postId || r.alvo_id}
          comentarioId={r.alvo_id}
        />
      )
    }

    if (r.tipo === 'comentou') {
      const ex = r.dados_extras ?? {}
      const texto = String(ex.texto ?? '')
      const postId = typeof ex.post_id === 'string' ? ex.post_id : r.alvo_id
      const comentarioId = typeof ex.comentario_id === 'string' ? ex.comentario_id : null
      const pm = postMetaMap[postId]
      const t = (pm?.tipo ?? 'texto').toLowerCase()
      const emFoto =
        t === 'foto' ||
        t === 'misto' ||
        (Boolean(urlFotoPost(pm)) && !(pm?.texto != null && String(pm.texto).trim()))
      const donorId = r.usuario_id
      const donor = perfilMap[donorId]
      return (
        <AtividadeComentario
          key={r.id}
          usernameAtor={ator?.username ?? 'usuario'}
          interactorFoto={ator?.foto_perfil_url ?? null}
          usernameDono={donor?.username ?? 'usuario'}
          hrefInteractor={hrefUsuario(r.autor_id)}
          hrefDono={hrefUsuario(donorId)}
          emFoto={emFoto}
          textoComentario={texto}
          postId={postId}
          comentarioId={comentarioId}
        />
      )
    }

    if (r.tipo === 'seguiu') {
      const ex = r.dados_extras ?? {}
      const seguidorId = typeof ex.seguidor_id === 'string' ? ex.seguidor_id : r.autor_id
      const seguidoId = typeof ex.seguido_id === 'string' ? ex.seguido_id : r.usuario_id
      const seguidoTipo = typeof ex.seguido_tipo === 'string' ? ex.seguido_tipo : 'turista'
      const uSeg = perfilMap[seguidorId]
      const uAlvo = perfilMap[seguidoId]
      const empId = seguidoTipo === 'empresa' ? seguidoEmpresaMap[seguidoId] ?? null : null
      return (
        <AtividadeSeguidor
          key={r.id}
          seguidorUsuarioId={seguidorId}
          usernameSeguidor={uSeg?.username ?? 'usuario'}
          seguidorFoto={uSeg?.foto_perfil_url ?? null}
          usernameSeguido={uAlvo?.username ?? 'usuario'}
          seguidoUsuarioId={seguidoId}
          seguidoTipo={seguidoTipo}
          empresaId={empId}
        />
      )
    }

    if (r.tipo === 'avaliou') {
      const ex = r.dados_extras ?? {}
      const empId = String(r.alvo_id)
      const em = empresaMap[empId]
      const nota = typeof ex.nota === 'number' ? ex.nota : Number(ex.nota) || 5
      const feedback = ex.comentario != null ? String(ex.comentario) : null
      return (
        <AtividadeAvaliacao
          key={r.id}
          usuarioAtorId={r.autor_id}
          usernameAtor={ator?.username ?? 'usuario'}
          interactorFoto={ator?.foto_perfil_url ?? null}
          nomeEmpresa={em?.nome ?? 'Empresa'}
          empresaId={empId}
          nota={nota}
          feedback={feedback}
        />
      )
    }

    return null
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">Carregando atividades…</p>
      </div>
    )
  }

  if (meuRole === 'empresa') {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <p className="p-6 text-gray-600">O feed de atividades está disponível para contas de turista e profissional.</p>
      </div>
    )
  }

  if (!meuId) {
    return (
      <div className="p-6 pb-24">
        <p className="text-gray-600">Entre na sua conta para ver as atividades.</p>
        <Link href="/login" className="mt-4 inline-block text-[#0097b2]">
          Ir para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-white/20 bg-[#0097b2] px-4 py-3">
        <label className="flex w-full items-center gap-2 rounded-xl border border-white/60 bg-white px-3 py-2 shadow-sm">
          <Search className="pointer-events-none h-5 w-5 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
          <input
            type="search"
            placeholder="Pesquisar usuário por @ ou nome..."
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
            enterKeyHint="search"
            value={buscaEdicao}
            onChange={(e) => setBuscaEdicao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') buscarUsuario()
            }}
            aria-label="Pesquisar atividades por usuário"
          />
        </label>
      </header>

      <AbasAtividades aba={aba} onAba={onAba} />

      <div className="p-4">
        {blocosComTitulo.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {aba === 'amigos' && qtdSeguindo === 0
              ? 'Siga pessoas no perfil delas para ver aqui o que estão curtindo, comentando e fazendo no app.'
              : 'Nenhuma atividade por aqui ainda.'}
          </p>
        ) : (
          blocosComTitulo.map((bloco) => (
            <section key={bloco.key} className="mb-6">
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-gray-400">── {bloco.titulo} ──</h2>
              <div className="space-y-3">{bloco.itens.map((it, i) => renderItem(it, i))}</div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
