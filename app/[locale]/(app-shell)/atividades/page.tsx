'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay, fetchFotoPerfilUsuario } from '@/lib/feed-autor'
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
import { buscarPerfisPorIds } from '@/lib/perfil-utils'

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

/** Uma entrada por UUID em `atividades`, antes de enriquecer — evita merges bloqueados por `!m[uid]`. */
function placeholderPerfil(uid: string): ReturnType<typeof pickAutorDisplay> {
  return {
    nome: 'Usuário',
    username: 'usuario',
    foto_perfil_url: null,
    usuario_id: uid,
    empresa_id: '',
    role: 'user',
  }
}

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
  username,
  turistas (nome_completo, nome_usuario, foto_perfil_url),
  profissionais (nome_completo, nome_usuario, foto_perfil_url),
  empresas (id, nome_fantasia, nome_usuario, foto_url)
`

export default function AtividadesPage() {
  const router = useRouter()
  const [aba, setAba] = useState<'amigos' | 'minha'>('amigos')
  const [termoBusca, setTermoBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<
    Array<{
      usuario_id: string
      empresa_id: string | null
      username: string | null
      nome: string | null
      foto_url: string | null
      tipo: 'turista' | 'profissional' | 'empresa'
    }>
  >([])
  const [buscando, setBuscando] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const latestRequestId = useRef(0)
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

  const buscarUsuarios = useCallback(async (termo: string) => {
    const requestId = ++latestRequestId.current
    const termoLimpo = termo
      .trim()
      .replace(/^@+/, '')
      .replace(/[%_,()]/g, '')

    if (!termoLimpo || termoLimpo.length < 2) {
      setResultadosBusca([])
      setBuscando(false)
      return
    }

    setBuscando(true)
    try {
      const { data, error } = await supabase
        .from('perfis_para_busca')
        .select('usuario_id, empresa_id, username, nome, foto_url, tipo')
        .or(`username.ilike.%${termoLimpo}%,nome.ilike.%${termoLimpo}%`)
        .limit(15)

      if (requestId !== latestRequestId.current) return
      if (error) throw error
      setResultadosBusca((data ?? []) as typeof resultadosBusca)
    } catch (error) {
      if (requestId !== latestRequestId.current) return
      console.error('Erro na busca:', error)
      setResultadosBusca([])
    } finally {
      if (requestId === latestRequestId.current) setBuscando(false)
    }
  }, [])

  // Debounce (300ms) + anti-race por requestId.
  useEffect(() => {
    const t = termoBusca
    if (!t.trim() || t.trim().replace(/^@+/, '').length < 2) {
      latestRequestId.current += 1
      setBuscando(false)
      setResultadosBusca([])
      return
    }
    const id = window.setTimeout(() => {
      void buscarUsuarios(t)
    }, 300)
    return () => window.clearTimeout(id)
  }, [buscarUsuarios, termoBusca])

  // Fechar dropdown ao clicar fora (desktop + mobile).
  useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      const node = dropdownRef.current
      if (!node) return
      const target = event.target as Node | null
      if (target && !node.contains(target)) {
        setResultadosBusca([])
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const handleSelectUser = useCallback(
    (user: (typeof resultadosBusca)[number]) => {
      const destino = user.tipo === 'empresa' && user.empresa_id ? `/empresa/${user.empresa_id}` : `/perfil/${user.usuario_id}`
      router.push(destino)
      setTermoBusca('')
      setResultadosBusca([])
    },
    [router]
  )

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

      const m: PerfilMap = {}
      for (const id of ids) {
        m[id] = placeholderPerfil(id)
      }

      const { data: dataUsuarios, error: errUsuarios } = await supabase.from('usuarios').select(USUARIOS_SELECT).in('id', ids)
      if (errUsuarios) {
        console.warn('Atividades usuarios:', errUsuarios.message)
      }
      if (dataUsuarios) {
        for (const u of dataUsuarios) {
          const row = u as unknown as Record<string, unknown>
          const id = row.id != null ? String(row.id) : ''
          if (id) m[id] = pickAutorDisplay(u)
        }
      }

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[Atividades] perfil ids:', ids.length, ids.slice(0, 8))
      }

      /** Enriquecer com `perfis_para_busca` (@username, nome, foto) — evita fallback “usuario” do embed quando RLS falha. */
      const preferTipo = new Map<string, string | null>()
      for (const id of ids) {
        const role = m[id]?.role
        preferTipo.set(id, role != null && role !== '' ? String(role) : null)
      }
      const perfisBusca = await buscarPerfisPorIds(supabase, ids, preferTipo)
      for (const pb of perfisBusca) {
        const uid = String(pb.usuario_id ?? '')
        if (!uid) continue
        const cur = m[uid] ?? placeholderPerfil(uid)
        const uName = (pb.username ?? '').trim()
        const nome = (pb.nome ?? '').trim()
        m[uid] = {
          ...cur,
          username: uName || cur.username,
          nome: nome || cur.nome,
          foto_perfil_url:
            pb.foto_url != null && String(pb.foto_url).trim() !== '' ? String(pb.foto_url) : cur.foto_perfil_url,
        }
      }

      /** Fallback à rede social: `turistas` / `profissionais` / `empresas` (campos públicos) quando embed em `usuarios` ou view falha. */
      const [
        { data: rowsTur, error: errTur },
        { data: rowsProf, error: errProf },
        { data: rowsEmp, error: errEmp },
      ] = await Promise.all([
        supabase.from('turistas').select('usuario_id, nome_usuario, foto_perfil_url, foto_url').in('usuario_id', ids),
        supabase.from('profissionais').select('usuario_id, nome_usuario, foto_perfil_url, foto_url').in('usuario_id', ids),
        supabase.from('empresas').select('usuario_id, nome_usuario, foto_url').in('usuario_id', ids),
      ])
      if (errTur) console.warn('Atividades turistas:', errTur.message)
      if (errProf) console.warn('Atividades profissionais:', errProf.message)
      if (errEmp) console.warn('Atividades empresas:', errEmp.message)

      const turBy = new Map<string, { nome_usuario?: string | null; foto_perfil_url?: string | null; foto_url?: string | null }>()
      const profBy = new Map<string, { nome_usuario?: string | null; foto_perfil_url?: string | null; foto_url?: string | null }>()
      for (const t of rowsTur ?? []) {
        const u = t as { usuario_id: string; nome_usuario?: string | null; foto_perfil_url?: string | null; foto_url?: string | null }
        if (u.usuario_id) turBy.set(String(u.usuario_id), u)
      }
      for (const p of rowsProf ?? []) {
        const u = p as { usuario_id: string; nome_usuario?: string | null; foto_perfil_url?: string | null; foto_url?: string | null }
        if (u.usuario_id) profBy.set(String(u.usuario_id), u)
      }
      const empBy = new Map<string, { nome_usuario?: string | null; foto_url?: string | null }>()
      for (const e of rowsEmp ?? []) {
        const u = e as { usuario_id: string; nome_usuario?: string | null; foto_url?: string | null }
        if (u.usuario_id) empBy.set(String(u.usuario_id), u)
      }

      const pickFoto = (row: {
        foto_perfil_url?: string | null
        foto_url?: string | null
      }) => {
        const a = row.foto_perfil_url != null && String(row.foto_perfil_url).trim() !== '' ? String(row.foto_perfil_url) : null
        const b = row.foto_url != null && String(row.foto_url).trim() !== '' ? String(row.foto_url) : null
        return a ?? b
      }

      for (const uid of ids) {
        if (!m[uid]) m[uid] = placeholderPerfil(uid)
        const cur = m[uid]
        const role = String(cur.role ?? '').toLowerCase()
        const tur = turBy.get(uid)
        const prof = profBy.get(uid)
        const emp = empBy.get(uid)

        if (role === 'empresa' && emp) {
          const nu = emp.nome_usuario != null && String(emp.nome_usuario).trim() !== '' ? String(emp.nome_usuario).trim() : null
          const fp = emp.foto_url != null && String(emp.foto_url).trim() !== '' ? String(emp.foto_url) : null
          m[uid] = {
            ...cur,
            ...(nu ? { username: nu } : {}),
            ...(fp ? { foto_perfil_url: fp } : {}),
          }
          continue
        }

        if (role === 'profissional' && prof) {
          const nu =
            prof.nome_usuario != null && String(prof.nome_usuario).trim() !== ''
              ? String(prof.nome_usuario).trim()
              : null
          const fp = pickFoto(prof)
          if (nu || fp) {
            m[uid] = {
              ...m[uid],
              ...(nu ? { username: nu } : {}),
              ...(fp ? { foto_perfil_url: fp } : {}),
            }
          }
          continue
        }
        if (role === 'turista' && tur) {
          const nu =
            tur.nome_usuario != null && String(tur.nome_usuario).trim() !== '' ? String(tur.nome_usuario).trim() : null
          const fp = pickFoto(tur)
          if (nu || fp) {
            m[uid] = {
              ...m[uid],
              ...(nu ? { username: nu } : {}),
              ...(fp ? { foto_perfil_url: fp } : {}),
            }
          }
          continue
        }
        if (role === 'admin') {
          const un =
            (prof?.nome_usuario != null && String(prof.nome_usuario).trim() !== '' ? String(prof.nome_usuario).trim() : null) ??
            (tur?.nome_usuario != null && String(tur.nome_usuario).trim() !== '' ? String(tur.nome_usuario).trim() : null)
          const fp = (prof && pickFoto(prof)) || (tur && pickFoto(tur))
          if (un || fp) {
            m[uid] = {
              ...m[uid],
              ...(un ? { username: un } : {}),
              ...(fp ? { foto_perfil_url: fp } : {}),
            }
          }
          continue
        }
        if (prof?.nome_usuario != null && String(prof.nome_usuario).trim() !== '') {
          const fp = pickFoto(prof)
          m[uid] = {
            ...m[uid],
            username: String(prof.nome_usuario).trim(),
            ...(fp ? { foto_perfil_url: fp } : {}),
          }
        } else if (tur?.nome_usuario != null && String(tur.nome_usuario).trim() !== '') {
          const fp = pickFoto(tur)
          m[uid] = {
            ...m[uid],
            username: String(tur.nome_usuario).trim(),
            ...(fp ? { foto_perfil_url: fp } : {}),
          }
        }
      }

      await Promise.all(
        ids.map(async (uid) => {
          const cur = m[uid]
          if (!cur) return
          const fp = cur.foto_perfil_url != null ? String(cur.foto_perfil_url).trim() : ''
          const precisaFoto = fp === '' || fp.includes('avatar-default')
          if (!precisaFoto) return
          const foto = await fetchFotoPerfilUsuario(supabase, uid)
          if (foto != null && foto.trim() !== '') {
            m[uid] = { ...m[uid], foto_perfil_url: foto }
          }
        })
      )

      if (process.env.NODE_ENV === 'development') {
        const amostra = ids.slice(0, 5).map((id) => ({
          id: `${id.slice(0, 8)}…`,
          username: m[id]?.username,
          temFoto: Boolean(m[id]?.foto_perfil_url),
        }))
        // eslint-disable-next-line no-console
        console.log('[Atividades] perfilMap amostra:', amostra)
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

  const listaAtividadesFiltrada = useMemo(() => {
    return aba === 'amigos' ? listaAmigos : listaMinha
  }, [aba, listaAmigos, listaMinha])

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
      <header className="border-b border-white/20 bg-[#0097b2] px-3 py-2 shadow-sm sm:px-4 sm:py-3">
        <div className="relative" ref={dropdownRef}>
          <div className="flex w-full items-center gap-2 rounded-xl border border-white/60 bg-white px-3 py-1.5 shadow-sm sm:py-2">
            <Search className="pointer-events-none h-5 w-5 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
            <input
              type="search"
              placeholder="Pesquisar usuário por @ ou nome..."
              className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              enterKeyHint="search"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              aria-label="Pesquisar usuários"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {buscando ? <Loader2 className="h-5 w-5 animate-spin text-[#0097b2]" aria-label="Buscando" /> : null}
          </div>

          {resultadosBusca.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {resultadosBusca.map((u) => {
                const nome = u.nome ?? 'Usuário'
                const username = (u.username ?? '').trim() || 'usuario'
                return (
                  <button
                    key={`${u.tipo}-${u.usuario_id}`}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className="flex w-full items-center gap-3 border-b border-gray-100 p-3 text-left hover:bg-gray-50 last:border-0"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-200">
                      {u.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.foto_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500">
                          {nome.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">{nome}</div>
                      <div className="truncate text-xs text-gray-500">@{username}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-400">{u.tipo}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      </header>

      <AbasAtividades aba={aba} onAba={onAba} />

      <div className="px-2 py-2 sm:px-3">
        {blocosComTitulo.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {aba === 'amigos' && qtdSeguindo === 0
              ? 'Siga pessoas no perfil delas para ver aqui o que estão curtindo, comentando e fazendo no app.'
              : 'Nenhuma atividade por aqui ainda.'}
          </p>
        ) : (
          blocosComTitulo.map((bloco) => (
            <section key={bloco.key} className="mb-4">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">── {bloco.titulo} ──</h2>
              <div className="space-y-0">{bloco.itens.map((it, i) => renderItem(it, i))}</div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
