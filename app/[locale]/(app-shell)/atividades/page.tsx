'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import AtividadeCurtiuStory from '@/components/atividades/AtividadeCurtiuStory'
import AtividadeComentario from '@/components/atividades/AtividadeComentario'
import AtividadeSeguidor from '@/components/atividades/AtividadeSeguidor'
import AtividadeAvaliacao from '@/components/atividades/AtividadeAvaliacao'
import { agruparAtividadesCurtidasPost, urlFotoPost } from '@/lib/atividades-feed'
import { buscarPerfisPorIds } from '@/lib/perfil-utils'
import { formatarDataComentarioCurta } from '@/lib/formatarDataPublicacao'

const LS_AMIGOS_VISTO = 'guia3f_atividades_amigos_visto_em'

/** Interações por pedido; “Mais atividades…” carrega outro bloco (aba Amigos). */
const ATIVIDADES_LIMITE_PAGINA = 50
/** Minha conta: só as últimas N por tempo; sem janela 48h nem “carregar mais”. */
const ATIVIDADES_LIMITE_MINHA_CONTA = ATIVIDADES_LIMITE_PAGINA

/** TESTE: janela 48h na aba Amigos desligada. Reativar: `const lim = new Date(Date.now() - 48*60*60*1000).toISOString()` + `.gte('created_at', lim)` nas duas queries Amigos. */

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

function mergeAtividadesPorId(anteriores: AtividadeRow[], novas: AtividadeRow[]): AtividadeRow[] {
  const vistos = new Set(anteriores.map((r) => r.id))
  const out = [...anteriores]
  for (const r of novas) {
    if (!vistos.has(r.id)) {
      vistos.add(r.id)
      out.push(r)
    }
  }
  return out
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
  const [erroBusca, setErroBusca] = useState<string | null>(null)
  const [pesquisaAberta, setPesquisaAberta] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const termoBuscaRef = useRef('')
  const latestRequestId = useRef(0)
  const [meuId, setMeuId] = useState<string | null>(null)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [listaAmigos, setListaAmigos] = useState<AtividadeRow[]>([])
  const [listaMinha, setListaMinha] = useState<AtividadeRow[]>([])
  const [offsetAmigos, setOffsetAmigos] = useState(0)
  const [offsetMinha, setOffsetMinha] = useState(0)
  const [temMaisAmigos, setTemMaisAmigos] = useState(false)
  const [temMaisMinha, setTemMaisMinha] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const seguindoRef = useRef<string[]>([])
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
      setErroBusca(null)
      return
    }

    setBuscando(true)
    setErroBusca(null)
    const cols = 'usuario_id, empresa_id, username, nome, foto_url, tipo'
    const pattern = `%${termoLimpo}%`
    try {
      /** Duas queries `.ilike` evitam falhas de parsing/encoding do `.or()` na URL do PostgREST. */
      const [porUsername, porNome] = await Promise.all([
        supabase.from('perfis_para_busca').select(cols).ilike('username', pattern).limit(15),
        supabase.from('perfis_para_busca').select(cols).ilike('nome', pattern).limit(15),
      ])

      if (requestId !== latestRequestId.current) return

      const err = porUsername.error || porNome.error
      if (err) throw err

      const map = new Map<string, (typeof resultadosBusca)[number]>()
      for (const row of [...(porUsername.data ?? []), ...(porNome.data ?? [])]) {
        const r = row as (typeof resultadosBusca)[number]
        const id = String(r.usuario_id ?? '')
        if (id && !map.has(id)) map.set(id, r)
      }
      const merged = [...map.values()].slice(0, 15)
      setResultadosBusca(merged)
    } catch (error) {
      if (requestId !== latestRequestId.current) return
      console.error('Erro na busca:', error)
      setResultadosBusca([])
      setErroBusca('Não foi possível carregar os resultados. Tente de novo.')
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
      setErroBusca(null)
      return
    }
    setBuscando(true)
    const id = window.setTimeout(() => {
      void buscarUsuarios(t)
    }, 300)
    return () => window.clearTimeout(id)
  }, [buscarUsuarios, termoBusca])

  useEffect(() => {
    termoBuscaRef.current = termoBusca
  }, [termoBusca])

  const fecharPesquisa = useCallback(() => {
    setPesquisaAberta(false)
    setTermoBusca('')
    setResultadosBusca([])
    setBuscando(false)
    setErroBusca(null)
    latestRequestId.current += 1
    inputRef.current?.blur()
  }, [])

  // Fechar dropdown ao clicar fora (desktop + mobile).
  useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      const node = dropdownRef.current
      if (!node) return
      const target = event.target as Node | null
      if (target && !node.contains(target)) {
        setResultadosBusca([])
        setErroBusca(null)
        if (!termoBuscaRef.current.trim()) {
          setPesquisaAberta(false)
        }
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
      setErroBusca(null)
      setPesquisaAberta(false)
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
    async (rows: AtividadeRow[], opcoes?: { merge?: boolean }) => {
      const merge = Boolean(opcoes?.merge)
      const ids = coletarIdsPerfis(rows)
      if (ids.length === 0) {
        if (!merge) {
          setPerfilMap({})
          setSeguidoEmpresaMap({})
        }
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

      if (merge) {
        setPerfilMap((prev) => ({ ...prev, ...m }))
      } else {
        setPerfilMap(m)
      }

      const empresaUsuarioIds = ids.filter((id) => m[id]?.role === 'empresa')
      if (empresaUsuarioIds.length > 0) {
        const { data: emps } = await supabase.from('empresas').select('id, usuario_id').in('usuario_id', empresaUsuarioIds)
        const sm: Record<string, string> = {}
        for (const e of emps ?? []) {
          const rec = e as { id: string; usuario_id: string }
          sm[rec.usuario_id] = String(rec.id)
        }
        if (merge) {
          setSeguidoEmpresaMap((prev) => ({ ...prev, ...sm }))
        } else {
          setSeguidoEmpresaMap(sm)
        }
      } else if (!merge) {
        setSeguidoEmpresaMap({})
      }
    },
    [coletarIdsPerfis]
  )

  const carregarPostsMeta = useCallback(async (postIds: string[], opcoes?: { merge?: boolean }) => {
    const merge = Boolean(opcoes?.merge)
    const uniq = [...new Set(postIds)].filter(Boolean)
    if (uniq.length === 0) {
      if (!merge) setPostMetaMap({})
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
      if (!merge) setPostMetaMap({})
      return
    }
    let m = mergeRows({}, data as unknown[])

    const originais = [...new Set(Object.values(m).map((p) => p.post_original_id).filter((x): x is string => Boolean(x)))].filter((id) => !m[id])

    if (originais.length > 0) {
      const { data: origData } = await supabase.from('posts').select(sel).in('id', originais)
      m = mergeRows(m, (origData ?? []) as unknown[])
    }

    if (merge) {
      setPostMetaMap((prev) => ({ ...prev, ...m }))
    } else {
      setPostMetaMap(m)
    }
  }, [])

  const carregarEmpresasAvaliacao = useCallback(async (empresaIds: string[], opcoes?: { merge?: boolean }) => {
    const merge = Boolean(opcoes?.merge)
    const uniq = [...new Set(empresaIds)].filter(Boolean)
    if (uniq.length === 0) {
      if (!merge) setEmpresaMap({})
      return
    }
    const { data, error } = await supabase.from('empresas').select('id, nome_fantasia, nome_usuario').in('id', uniq)
    if (error || !data) {
      if (!merge) setEmpresaMap({})
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
    if (merge) {
      setEmpresaMap((prev) => ({ ...prev, ...m }))
    } else {
      setEmpresaMap(m)
    }
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
      seguindoRef.current = []
      setOffsetAmigos(0)
      setOffsetMinha(0)
      setTemMaisAmigos(false)
      setTemMaisMinha(false)
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
      seguindoRef.current = []
      setOffsetAmigos(0)
      setOffsetMinha(0)
      setTemMaisAmigos(false)
      setTemMaisMinha(false)
      return
    }

    const { data: segRows } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', uid)
    const seguindo = (segRows ?? []).map((r) => String((r as { seguido_id: string }).seguido_id))
    seguindoRef.current = seguindo
    setQtdSeguindo(seguindo.length)

    const lim = ATIVIDADES_LIMITE_PAGINA

    const [amigosRes, minhaRes] = await Promise.all([
      seguindo.length
        ? supabase
            .from('atividades')
            .select('*')
            .in('autor_id', seguindo)
            /* Destinatário = eu → fica só na aba "Minha conta"; aqui só o que seguidos fazem no conteúdo de terceiros. */
            .neq('usuario_id', uid)
            .order('created_at', { ascending: false })
            .range(0, lim - 1)
        : Promise.resolve({ data: [] as AtividadeRow[], error: null }),
      supabase
        .from('atividades')
        .select('*')
        .eq('usuario_id', uid)
        .order('created_at', { ascending: false })
        .range(0, ATIVIDADES_LIMITE_MINHA_CONTA - 1),
    ])

    const amigos = (amigosRes.data ?? []) as AtividadeRow[]
    const minha = (minhaRes.data ?? []) as AtividadeRow[]

    setListaAmigos(amigos)
    setListaMinha(minha)
    setOffsetAmigos(amigos.length)
    setOffsetMinha(minha.length)
    setTemMaisAmigos(amigos.length === lim)
    setTemMaisMinha(false)

    const todos = [...amigos, ...minha]
    await carregarPerfis(todos, { merge: false })

    const postIds: string[] = []
    for (const r of todos) {
      if (r.tipo === 'curtiu_post') postIds.push(r.alvo_id)
      const ex = r.dados_extras
      if (ex && typeof ex === 'object') {
        const pid = ex.post_id
        if (typeof pid === 'string') postIds.push(pid)
      }
    }
    await carregarPostsMeta(postIds, { merge: false })

    const empIds: string[] = []
    for (const r of todos) {
      if (r.tipo === 'avaliou') empIds.push(r.alvo_id)
    }
    await carregarEmpresasAvaliacao(empIds, { merge: false })

    setCarregando(false)
  }, [carregarPerfis, carregarPostsMeta, carregarEmpresasAvaliacao])

  const carregarMaisAtividades = useCallback(async () => {
    if (carregandoMais) return
    const uid = meuId
    if (!uid) return
    /* Minha conta: só as últimas N em `recarregar`; scroll infinito só na aba Amigos. */
    if (aba !== 'amigos') return
    setCarregandoMais(true)
    const lim = ATIVIDADES_LIMITE_PAGINA
    try {
      const seg = seguindoRef.current
      if (seg.length === 0 || !temMaisAmigos) return
      const start = offsetAmigos
      const { data, error } = await supabase
        .from('atividades')
        .select('*')
        .in('autor_id', seg)
        .neq('usuario_id', uid)
        .order('created_at', { ascending: false })
        .range(start, start + lim - 1)
      if (error) {
        console.error(error)
        return
      }
      const novas = (data ?? []) as AtividadeRow[]
      if (novas.length === 0) {
        setTemMaisAmigos(false)
        return
      }
      setListaAmigos((prev) => mergeAtividadesPorId(prev, novas))
      setOffsetAmigos(start + novas.length)
      setTemMaisAmigos(novas.length === lim)
      await carregarPerfis(novas, { merge: true })
      const postIds: string[] = []
      for (const r of novas) {
        if (r.tipo === 'curtiu_post') postIds.push(r.alvo_id)
        const ex = r.dados_extras
        if (ex && typeof ex === 'object') {
          const pid = ex.post_id
          if (typeof pid === 'string') postIds.push(pid)
        }
      }
      await carregarPostsMeta(postIds, { merge: true })
      const empIds = novas.filter((r) => r.tipo === 'avaliou').map((r) => r.alvo_id)
      await carregarEmpresasAvaliacao(empIds, { merge: true })
    } finally {
      setCarregandoMais(false)
    }
  }, [aba, meuId, offsetAmigos, temMaisAmigos, carregarPerfis, carregarPostsMeta, carregarEmpresasAvaliacao])

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

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (carregandoMais) return
        const temMais = aba === 'amigos' ? temMaisAmigos : temMaisMinha
        if (!temMais) return
        void carregarMaisAtividades()
      },
      { rootMargin: '120px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [
    aba,
    carregarMaisAtividades,
    carregandoMais,
    temMaisAmigos,
    temMaisMinha,
    itensAgrupados.length,
  ])

  const renderItem = (item: (typeof itensAgrupados)[number], idx: number) => {
    const modoMinhaConta = aba === 'minha'

    if (item.kind === 'curtiu_post_fotos') {
      const inter = perfilMap[item.autor_id]
      const donor = perfilMap[item.usuario_dono_id]
      /** Uma URL por linha (alinhada a `postIds`); placeholder se a meta ainda não tiver foto. */
      const urlsGrid = item.rows.map((r) => {
        const u = urlFotoPost(postMetaMap[r.alvo_id])
        return u && String(u).trim() !== '' ? String(u) : '/window.svg'
      })
      return (
        <AtividadeCurtidas
          key={`cf-${item.autor_id}-${item.usuario_dono_id}-${item.created_at}-${idx}`}
          interactorUsername={inter?.username ?? 'usuario'}
          interactorFoto={inter?.foto_perfil_url ?? null}
          donorUsername={donor?.username ?? 'usuario'}
          hrefInteractor={hrefUsuario(item.autor_id)}
          hrefDonor={hrefUsuario(item.usuario_dono_id)}
          urls={urlsGrid}
          postIds={item.rows.map((r) => String(r.alvo_id))}
          totalCurtidas={item.rows.length}
          tempoInteracao={formatarDataComentarioCurta(item.created_at)}
          modoMinhaConta={modoMinhaConta}
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
            tempoInteracao={formatarDataComentarioCurta(r.created_at)}
            modoMinhaConta={modoMinhaConta}
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
            tempoInteracao={formatarDataComentarioCurta(r.created_at)}
            modoMinhaConta={modoMinhaConta}
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
            tempoInteracao={formatarDataComentarioCurta(r.created_at)}
            modoMinhaConta={modoMinhaConta}
          />
        )
      }

      return null
    }

    const r = item.row
    const ator = perfilMap[r.autor_id]

    if (r.tipo === 'curtiu_story') {
      const donor = perfilMap[r.usuario_id]
      return (
        <AtividadeCurtiuStory
          key={r.id}
          interactorUsername={ator?.username ?? 'usuario'}
          interactorFoto={ator?.foto_perfil_url ?? null}
          donorUsername={donor?.username ?? 'usuario'}
          hrefInteractor={hrefUsuario(r.autor_id)}
          hrefDonor={hrefUsuario(r.usuario_id)}
          tempoInteracao={formatarDataComentarioCurta(r.created_at)}
          modoMinhaConta={modoMinhaConta}
        />
      )
    }

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
          tempoInteracao={formatarDataComentarioCurta(r.created_at)}
          modoMinhaConta={modoMinhaConta}
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
          tempoInteracao={formatarDataComentarioCurta(r.created_at)}
          modoMinhaConta={modoMinhaConta}
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
          tempoInteracao={formatarDataComentarioCurta(r.created_at)}
          modoMinhaConta={modoMinhaConta}
          meuUsuarioId={meuId}
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
          tempoInteracao={formatarDataComentarioCurta(r.created_at)}
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
      <header className="sticky top-0 z-30 overflow-visible border-b border-white/20 bg-[#0097b2] px-3 py-2 shadow-sm sm:px-4 sm:py-3">
        <div className="relative" ref={dropdownRef}>
          <div className="relative flex min-h-10 w-full items-center sm:min-h-11">
            <div
              className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-out ${
                pesquisaAberta ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'
              }`}
              aria-hidden={pesquisaAberta}
            >
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">ATIVIDADES</h1>
            </div>
            <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end gap-2">
            <div
              className={`flex min-w-0 justify-end overflow-hidden transition-[max-width,opacity] duration-300 ease-out ${
                pesquisaAberta ? 'max-w-full flex-1 opacity-100' : 'max-w-0 flex-none opacity-0'
              }`}
            >
              <div className="ml-auto flex w-full min-w-0 max-w-full items-center gap-2 rounded-xl border border-white/60 bg-white px-3 py-1.5 shadow-sm sm:py-2">
                <Search className="pointer-events-none h-5 w-5 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
                <input
                  ref={inputRef}
                  type="search"
                  tabIndex={pesquisaAberta ? 0 : -1}
                  placeholder="Pesquisar usuário por @ ou nome..."
                  className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  enterKeyHint="search"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  onBlur={(e) => {
                    const valor = e.currentTarget.value.trim()
                    window.requestAnimationFrame(() => {
                      window.requestAnimationFrame(() => {
                        const a = document.activeElement
                        if (dropdownRef.current?.contains(a)) return
                        if (!valor) setPesquisaAberta(false)
                      })
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      fecharPesquisa()
                    }
                  }}
                  aria-label="Pesquisar usuários"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {buscando ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#0097b2]" aria-label="Buscando" /> : null}
              </div>
            </div>
            <button
              type="button"
              className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/95 text-[#0097b2] shadow-sm ring-1 ring-white/40 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={pesquisaAberta ? 'Fechar pesquisa' : 'Abrir pesquisa de usuários'}
              aria-expanded={pesquisaAberta}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (pesquisaAberta) {
                  fecharPesquisa()
                  return
                }
                setPesquisaAberta(true)
                const focar = () => inputRef.current?.focus()
                window.requestAnimationFrame(() => {
                  window.requestAnimationFrame(focar)
                })
              }}
            >
              <Search className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </button>
            </div>
          </div>

          {pesquisaAberta && resultadosBusca.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {resultadosBusca.map((u) => {
                const nome = u.nome ?? 'Usuário'
                const username = (u.username ?? '').trim() || 'usuario'
                return (
                  <button
                    key={`${u.tipo}-${u.usuario_id}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
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
          {pesquisaAberta &&
          termoBusca.trim().replace(/^@+/, '').length >= 2 &&
          !buscando &&
          resultadosBusca.length === 0 &&
          erroBusca ? (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-red-200 bg-white p-4 text-center text-sm text-red-600 shadow-lg"
              role="alert"
            >
              {erroBusca}
            </div>
          ) : null}
          {pesquisaAberta &&
          termoBusca.trim().replace(/^@+/, '').length >= 2 &&
          !buscando &&
          resultadosBusca.length === 0 &&
          !erroBusca ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-lg">
              Nenhum usuário encontrado para &ldquo;{termoBusca.trim()}&rdquo;.
            </div>
          ) : null}
        </div>
      </header>

      <AbasAtividades aba={aba} onAba={onAba} />

      <div className="px-4 py-3">
        {itensAgrupados.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {aba === 'amigos' && qtdSeguindo === 0
              ? 'Siga pessoas no perfil delas para ver aqui o que estão curtindo, comentando e fazendo no app.'
              : 'Nenhuma atividade por aqui ainda.'}
          </p>
        ) : (
          <>
            <div className="space-y-6">
              {itensAgrupados.map((it, i) => {
                const rowKey =
                  it.kind === 'curtiu_post_fotos'
                    ? `cf-${it.autor_id}-${it.usuario_dono_id}-${it.created_at}`
                    : it.kind === 'curtiu_post_solo'
                      ? it.row.id
                      : `row-${it.row.id}`
                return (
                  <div key={rowKey} className="min-w-0">
                    {renderItem(it, i)}
                  </div>
                )
              })}
            </div>
            {(aba === 'amigos' ? temMaisAmigos : temMaisMinha) ? (
              <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
            ) : null}
            {carregandoMais ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-[#0097b2]" aria-label="Carregando mais atividades" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
