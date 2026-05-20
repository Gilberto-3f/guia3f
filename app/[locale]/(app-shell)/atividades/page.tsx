'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay, fetchFotoPerfilUsuario } from '@/lib/feed-autor'
import { fetchVerificadoPorUsuarioIds } from '@/lib/contaVerificada'
import AbasAtividades from '@/components/atividades/AbasAtividades'
import AtividadeCurtidas from '@/components/atividades/AtividadeCurtidas'
import AtividadeCurtiuComentario from '@/components/atividades/AtividadeCurtiuComentario'
import AtividadeCurtiuPost from '@/components/atividades/AtividadeCurtiuPost'
import AtividadeCurtiuVerificacaoProfissional from '@/components/atividades/AtividadeCurtiuVerificacaoProfissional'
import AtividadeCurtiuRepost from '@/components/atividades/AtividadeCurtiuRepost'
import AtividadeCurtiuAvaliacao from '@/components/atividades/AtividadeCurtiuAvaliacao'
import AtividadeCurtiuStory from '@/components/atividades/AtividadeCurtiuStory'
import AtividadeRepostouStory from '@/components/atividades/AtividadeRepostouStory'
import AtividadeComentario from '@/components/atividades/AtividadeComentario'
import AtividadeSeguidor from '@/components/atividades/AtividadeSeguidor'
import AtividadeAvaliacao from '@/components/atividades/AtividadeAvaliacao'
import StoryViewer from '@/components/StoryViewer'
import AvatarImage from '@/components/AvatarImage'
import {
  atividadeVisivelNaMinhaContaEmpresa,
  atividadeVisivelNaMinhaContaPessoal,
  agruparAtividadesCurtidasPost,
  filtrarAtividadesAposDescurtir,
  urlFotoPost,
} from '@/lib/atividades-feed'
import { buscarPerfisPorIds } from '@/lib/perfil-utils'
import { formatarDataAtividades } from '@/lib/formatarDataPublicacao'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { podeVerConteudoEmpresaPreviewApp } from '@/lib/modoApresentacaoVisibilidade'
import { GUIA_ATIVIDADES_RELOAD_EVENT } from '@/lib/atividades-events'
import { resolverUsernameOriginalRepostStory, normalizarUsernameAtividade } from '@/lib/formatarTextoRepostStory'
import { fetchAutorIdsSeguidosAmigos } from '@/lib/feedSeguidosEmpresasFavoritas'

const LS_AMIGOS_VISTO = 'guia3f_atividades_amigos_visto_em'

/** Interações por pedido; “Mais atividades…” carrega outro bloco (aba Amigos). */
const ATIVIDADES_LIMITE_PAGINA = 50
/** Minha conta: só as últimas N por tempo; sem janela 48h nem “carregar mais”. */
const ATIVIDADES_LIMITE_MINHA_CONTA = ATIVIDADES_LIMITE_PAGINA

/** TESTE: janela 48h na aba Amigos desligada. Reativar: `const lim = new Date(Date.now() - 48*60*60*1000).toISOString()` + `.gte('created_at', lim)` nas duas queries Amigos. */

function logDiagAmigos(
  etapa: string,
  payload: {
    uid?: string
    seguindo?: string[]
    res?: unknown
    amigosLen?: number
  }
) {
  if (process.env.NODE_ENV !== 'development') return
  const res = payload.res as { data?: unknown; error?: { message?: string } | null; status?: number } | undefined
  // eslint-disable-next-line no-console
  console.log(`[Atividades][Amigos][diag] ${etapa}`, {
    uid: payload.uid,
    seguindo: payload.seguindo,
    seguindoLen: payload.seguindo?.length,
    amigosLen: payload.amigosLen,
    dataIsArray: Array.isArray(res?.data),
    dataLen: Array.isArray(res?.data) ? res.data.length : undefined,
    error: res?.error ?? null,
    status: res?.status,
  })
}

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
type EmpresaAvaliacaoMap = Record<string, { nome: string; username: string; foto_url: string | null }>

type StoryViewerState = {
  id: string
  tipo: string
  conteudo_url: string
  texto_sobreposto: {
    texto?: string | null
    posicao_x?: number
    posicao_y?: number
    link_posicao_x?: number
    link_posicao_y?: number
    fundo_fit?: 'contain' | 'cover'
    fundo_scale?: number
    fundo_pan_x_pct?: number
    fundo_pan_y_pct?: number
    texto_scale?: number
  } | null
  link: string | null
  duracao_segundos: number | null
  autorUsuarioId: string | null
  curtidas?: unknown
  visualizado_por?: unknown
  marcacoes?: unknown
  repost_story_id?: string | null
}

type StoryRowSelect = {
  id: unknown
  conteudo_url?: unknown
  texto_sobreposto?: unknown
  link?: unknown
  tipo?: unknown
  duracao_segundos?: unknown
  autor_id?: unknown
  curtidas?: unknown
  visualizado_por?: unknown
  marcacoes?: unknown
  repost_story_id?: unknown
}

function mapStoryRowToViewerState(data: StoryRowSelect | null): StoryViewerState | null {
  if (!data) return null
  const id = String(data.id ?? '').trim()
  const url = String(data.conteudo_url ?? '').trim()
  const autorId = String(data.autor_id ?? '').trim()
  if (!id || !url || !autorId) return null
  const ts = data.texto_sobreposto
  const textoParsed =
    ts && typeof ts === 'object' && !Array.isArray(ts) ? (ts as StoryViewerState['texto_sobreposto']) : null
  return {
    id,
    tipo: data.tipo != null ? String(data.tipo) : 'foto',
    conteudo_url: url,
    texto_sobreposto: textoParsed,
    link: data.link != null ? String(data.link) : null,
    duracao_segundos: data.duracao_segundos != null ? Number(data.duracao_segundos) : null,
    autorUsuarioId: autorId,
    curtidas: data.curtidas ?? null,
    visualizado_por: data.visualizado_por ?? null,
    marcacoes: data.marcacoes ?? null,
    repost_story_id: data.repost_story_id != null ? String(data.repost_story_id) : null,
  }
}

/** Uma entrada por UUID em `atividades`, antes de enriquecer — evita merges bloqueados por `!m[uid]`. */
function placeholderPerfil(uid: string): ReturnType<typeof pickAutorDisplay> {
  return {
    nome: 'Usuário',
    username: 'usuario',
    foto_perfil_url: null,
    usuario_id: uid,
    empresa_id: '',
    role: 'user',
    verificado: false,
  }
}

const USUARIOS_SELECT = `
  id,
  email,
  role,
  username
`

export default function AtividadesPage() {
  const router = useRouter()
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()
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
  const swipeRef = useRef<{
    startX: number
    startY: number
    lastX: number
    lastY: number
    pointerDown: boolean
  }>({ startX: 0, startY: 0, lastX: 0, lastY: 0, pointerDown: false })
  const termoBuscaRef = useRef('')
  const latestRequestId = useRef(0)
  const [meuId, setMeuId] = useState<string | null>(null)
  const [meuEmail, setMeuEmail] = useState<string | null>(null)
  const [meuRole, setMeuRole] = useState<string | null>(null)
  /** Nome da empresa logada (aba Atividades — linhas `avaliou` e texto da página). */
  const [minhaEmpresaAtividades, setMinhaEmpresaAtividades] = useState<{ id: string; nome: string } | null>(null)
  const [empresaAvaliacaoMap, setEmpresaAvaliacaoMap] = useState<EmpresaAvaliacaoMap>({})
  const [carregando, setCarregando] = useState(true)
  const [listaAmigos, setListaAmigos] = useState<AtividadeRow[]>([])
  const [listaMinha, setListaMinha] = useState<AtividadeRow[]>([])
  const [offsetAmigos, setOffsetAmigos] = useState(0)
  const [offsetMinha, setOffsetMinha] = useState(0)
  const [temMaisAmigos, setTemMaisAmigos] = useState(false)
  const [temMaisMinha, setTemMaisMinha] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  /** Erro na query da aba Amigos (RLS, rede, etc.); só diagnóstico/UX mínima. */
  const [erroAmigos, setErroAmigos] = useState<string | null>(null)
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
  const [storyModal, setStoryModal] = useState<StoryViewerState | null>(null)
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
        const autorExtra = ex.autor_id
        const autorOriginalId = ex.autor_original_id
        if (typeof seguidor === 'string') ids.add(seguidor)
        if (typeof seguido === 'string') ids.add(seguido)
        if (typeof autorExtra === 'string') ids.add(autorExtra)
        if (typeof autorOriginalId === 'string') ids.add(autorOriginalId)
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

  const carregarStoryPorId = useCallback(async (storyId: string) => {
    const id = String(storyId ?? '').trim()
    if (!id) return
    const { data, error } = await supabase
      .from('stories')
      .select('id, conteudo_url, texto_sobreposto, link, tipo, duracao_segundos, autor_id, curtidas, visualizado_por, marcacoes, repost_story_id')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[Atividades] carregar story:', error)
      return
    }
    const mapped = mapStoryRowToViewerState(data as StoryRowSelect | null)
    if (!mapped) {
      console.warn('[Atividades] story inválido:', id)
      return
    }
    setStoryModal(mapped)
  }, [])

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
      const { data: previewEmpRows } = await supabase
        .from('empresas')
        .select('id')
        .in('usuario_id', ids)
        .eq('somente_modo_apresentacao', true)
      const previewEmpresaIdSet = new Set(
        (previewEmpRows ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean)
      )

      const perfisBusca = await buscarPerfisPorIds(supabase, ids, preferTipo)
      for (const pb of perfisBusca) {
        const uid = String(pb.usuario_id ?? '')
        if (!uid) continue
        const cur = m[uid] ?? placeholderPerfil(uid)
        const uName = (pb.username ?? '').trim()
        const nome = (pb.nome ?? '').trim()
        const tipo = String(pb.tipo ?? '').toLowerCase()
        const empId = pb.empresa_id != null && String(pb.empresa_id).trim() !== '' ? String(pb.empresa_id) : null
        const permitirEmpresaPreview =
          podeVerConteudoEmpresaPreviewApp(meuEmail, modoAtivo) &&
          Boolean(
            meuId &&
              uid === meuId &&
              meuRole === 'admin' &&
              perfilSimulado?.tipo === 'empresa' &&
              contextoEmpresaId
          ) &&
          tipo === 'empresa'

        const podeAplicarEmpresa = tipo === 'empresa' ? permitirEmpresaPreview : true

        /** Sem permissão de preview: nunca misturar nome/foto/username da empresa demo (`perfis_para_busca`). */
        if (tipo === 'empresa' && empId && previewEmpresaIdSet.has(empId) && !podeVerConteudoEmpresaPreviewApp(meuEmail, modoAtivo)) {
          continue
        }

        m[uid] = {
          ...cur,
          username: uName || cur.username,
          nome: nome || cur.nome,
          foto_perfil_url:
            pb.foto_url != null && String(pb.foto_url).trim() !== '' ? String(pb.foto_url) : cur.foto_perfil_url,
          ...(tipo && podeAplicarEmpresa ? { role: tipo } : {}),
          ...(tipo === 'empresa' && empId && podeAplicarEmpresa ? { empresa_id: empId } : {}),
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
        supabase.from('empresas').select('usuario_id, nome_usuario, foto_url, somente_modo_apresentacao').in('usuario_id', ids),
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
        const u = e as {
          usuario_id: string
          nome_usuario?: string | null
          foto_url?: string | null
          somente_modo_apresentacao?: boolean | null
        }
        if (!u.usuario_id) continue
        if (!podeVerConteudoEmpresaPreviewApp(meuEmail, modoAtivo) && u.somente_modo_apresentacao === true) continue
        empBy.set(String(u.usuario_id), u)
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
          /** Com modo inativo, `empBy` já exclui preview; se ainda assim não houver `emp`, cai nos ramos turista/admin abaixo. */
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

      const verificadoMap = await fetchVerificadoPorUsuarioIds(supabase, ids)
      for (const id of ids) {
        if (m[id]) {
          m[id] = { ...m[id], verificado: Boolean(verificadoMap.get(id)) }
        }
      }

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
        /** Ignorar empresas só modo apresentação para o mapa gestor → empresa, exceto ADM demo com modo ativo. */
        let qEmpSeguido = supabase
          .from('empresas')
          .select('id, usuario_id, somente_modo_apresentacao')
          .in('usuario_id', empresaUsuarioIds)
        if (!podeVerConteudoEmpresaPreviewApp(meuEmail, modoAtivo)) {
          qEmpSeguido = qEmpSeguido.not('somente_modo_apresentacao', 'eq', true)
        }
        const { data: emps } = await qEmpSeguido
        const sm: Record<string, string> = {}
        for (const e of emps ?? []) {
          const rec = e as { id: string; usuario_id: string }
          const uid = String(rec.usuario_id)
          if (uid && !sm[uid]) sm[uid] = String(rec.id)
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
    [coletarIdsPerfis, meuId, meuEmail, meuRole, modoAtivo, perfilSimulado?.tipo, contextoEmpresaId]
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

    const postsAvaliacao = Object.values(m).filter((p) => {
      const tipo = String(p.tipo ?? '').toLowerCase()
      return tipo === 'avaliacao' && p.avaliacao_meta && typeof p.avaliacao_meta === 'object' && !Array.isArray(p.avaliacao_meta)
    })

    if (postsAvaliacao.length > 0) {
      const empresaIds = new Set<string>()
      const profissionalIds = new Set<string>()

      for (const p of postsAvaliacao) {
        const meta = p.avaliacao_meta as Record<string, unknown>
        const alvoTipo = String(meta.alvo_tipo ?? '').toLowerCase()
        const empresaId = meta.empresa_id != null ? String(meta.empresa_id).trim() : ''
        const profissionalId =
          meta.profissional_id != null
            ? String(meta.profissional_id).trim()
            : alvoTipo === 'profissional' && meta.alvo_id != null
              ? String(meta.alvo_id).trim()
              : ''
        if (empresaId) empresaIds.add(empresaId)
        if (profissionalId) profissionalIds.add(profissionalId)
      }

      const empresaIdsArr = [...empresaIds]
      const profissionalIdsArr = [...profissionalIds]
      const [empRes, profIdRes, profUsuarioRes] = await Promise.all([
        empresaIdsArr.length > 0
          ? supabase.from('empresas').select('id, nome_fantasia, nome_usuario, foto_url').in('id', empresaIdsArr)
          : Promise.resolve({ data: [], error: null }),
        profissionalIdsArr.length > 0
          ? supabase
              .from('profissionais')
              .select('id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url')
              .in('id', profissionalIdsArr)
          : Promise.resolve({ data: [], error: null }),
        profissionalIdsArr.length > 0
          ? supabase
              .from('profissionais')
              .select('id, usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url')
              .in('usuario_id', profissionalIdsArr)
          : Promise.resolve({ data: [], error: null }),
      ])

      const empresasAtuais = new Map<string, { nome_fantasia?: string | null; nome_usuario?: string | null; foto_url?: string | null }>()
      if (!empRes.error) {
        for (const raw of empRes.data ?? []) {
          const e = raw as { id?: string | null; nome_fantasia?: string | null; nome_usuario?: string | null; foto_url?: string | null }
          const id = e.id != null ? String(e.id) : ''
          if (id) empresasAtuais.set(id, e)
        }
      }

      type ProfAtual = {
        id?: string | null
        usuario_id?: string | null
        nome_completo?: string | null
        nome_usuario?: string | null
        foto_perfil_url?: string | null
        foto_url?: string | null
      }
      const profissionaisAtuais = new Map<string, ProfAtual>()
      for (const res of [profIdRes, profUsuarioRes]) {
        if (res.error) continue
        for (const raw of res.data ?? []) {
          const p = raw as ProfAtual
          const id = p.id != null ? String(p.id) : ''
          const uid = p.usuario_id != null ? String(p.usuario_id) : ''
          if (id) profissionaisAtuais.set(id, p)
          if (uid) profissionaisAtuais.set(uid, p)
        }
      }

      for (const p of postsAvaliacao) {
        const meta = p.avaliacao_meta as Record<string, unknown>
        const alvoTipo = String(meta.alvo_tipo ?? '').toLowerCase()
        const empresaId = meta.empresa_id != null ? String(meta.empresa_id).trim() : ''
        const profissionalId =
          meta.profissional_id != null
            ? String(meta.profissional_id).trim()
            : alvoTipo === 'profissional' && meta.alvo_id != null
              ? String(meta.alvo_id).trim()
              : ''
        const emp = empresaId ? empresasAtuais.get(empresaId) : null
        if (emp) {
          p.avaliacao_meta = {
            ...meta,
            nome_fantasia: emp.nome_fantasia != null ? String(emp.nome_fantasia) : meta.nome_fantasia,
            nome_usuario: emp.nome_usuario != null ? String(emp.nome_usuario) : meta.nome_usuario,
            foto_url: emp.foto_url != null && String(emp.foto_url).trim() !== '' ? String(emp.foto_url) : null,
          }
          continue
        }
        const prof = profissionalId ? profissionaisAtuais.get(profissionalId) : null
        if (prof) {
          const fotoPerfil =
            prof.foto_perfil_url != null && String(prof.foto_perfil_url).trim() !== ''
              ? String(prof.foto_perfil_url)
              : prof.foto_url != null && String(prof.foto_url).trim() !== ''
                ? String(prof.foto_url)
                : null
          p.avaliacao_meta = {
            ...meta,
            alvo_tipo: 'profissional',
            nome_fantasia: prof.nome_completo != null ? String(prof.nome_completo) : meta.nome_fantasia,
            nome_usuario: prof.nome_usuario != null ? String(prof.nome_usuario) : meta.nome_usuario,
            foto_url: fotoPerfil,
          }
        }
      }
    }

    if (merge) {
      setPostMetaMap((prev) => ({ ...prev, ...m }))
    } else {
      setPostMetaMap(m)
    }
  }, [])

  const carregarEmpresasAvaliacoes = useCallback(async (rows: AtividadeRow[], opcoes?: { merge?: boolean }) => {
    const merge = Boolean(opcoes?.merge)
    const empresaIds = [
      ...new Set(
        rows
          .filter((r) => r.tipo === 'avaliou')
          .map((r) => {
            const ex = r.dados_extras ?? {}
            return typeof ex.empresa_id === 'string' && ex.empresa_id.trim() !== ''
              ? ex.empresa_id.trim()
              : String(r.alvo_id ?? '').trim()
          })
          .filter(Boolean)
      ),
    ]

    if (empresaIds.length === 0) {
      if (!merge) setEmpresaAvaliacaoMap({})
      return
    }

    const { data, error } = await supabase
      .from('empresas')
      .select('id, nome_fantasia, nome_usuario, foto_url')
      .in('id', empresaIds)

    if (error || !data) {
      if (!merge) setEmpresaAvaliacaoMap({})
      return
    }

    const mapa: EmpresaAvaliacaoMap = {}
    for (const raw of data) {
      const e = raw as { id: string; nome_fantasia?: string | null; nome_usuario?: string | null; foto_url?: string | null }
      const id = String(e.id ?? '')
      if (!id) continue
      mapa[id] = {
        nome:
          e.nome_fantasia != null && String(e.nome_fantasia).trim() !== ''
            ? String(e.nome_fantasia).trim()
            : 'Empresa',
        username:
          e.nome_usuario != null && String(e.nome_usuario).trim() !== '' ? String(e.nome_usuario).trim() : '',
        foto_url: e.foto_url != null && String(e.foto_url).trim() !== '' ? String(e.foto_url) : null,
      }
    }

    if (merge) {
      setEmpresaAvaliacaoMap((prev) => ({ ...prev, ...mapa }))
    } else {
      setEmpresaAvaliacaoMap(mapa)
    }
  }, [])

  const aplicarRemocaoLocal = useCallback(
    (
      crit: {
        autorId?: string
        postId?: string
        comentarioId?: string
        curtidaId?: string
        atividadeId?: string
      } | null
    ) => {
      if (!crit) return
      setListaAmigos((prev) => filtrarAtividadesAposDescurtir(prev, crit))
      setListaMinha((prev) => filtrarAtividadesAposDescurtir(prev, crit))
    },
    []
  )

  const recarregar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id ?? null
    setMeuId(uid)
    setMeuEmail(session?.user?.email ?? null)
    if (!uid) {
      setCarregando(false)
      setMinhaEmpresaAtividades(null)
      setListaAmigos([])
      setListaMinha([])
      setEmpresaAvaliacaoMap({})
      setQtdSeguindo(0)
      seguindoRef.current = []
      setOffsetAmigos(0)
      setOffsetMinha(0)
      setTemMaisAmigos(false)
      setTemMaisMinha(false)
      setErroAmigos(null)
      return
    }

    const { data: urow } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
    const role = (urow as { role?: string } | null)?.role ?? null
    setMeuRole(role)

    if (role === 'empresa') {
      setErroAmigos(null)
      setListaAmigos([])
      setEmpresaAvaliacaoMap({})
      setQtdSeguindo(0)
      seguindoRef.current = []
      setOffsetAmigos(0)
      setTemMaisAmigos(false)
      setTemMaisMinha(false)

      const limEmp = ATIVIDADES_LIMITE_MINHA_CONTA
      const minhaEmpresaRes = await supabase
        .from('atividades')
        .select('*')
        .eq('usuario_id', uid)
        /* Empresa deve ver novos seguidores da página; só avaliações ficam fora daqui. */
        .not('tipo', 'in', '(avaliou)')
        .order('created_at', { ascending: false })
        .range(0, limEmp - 1)

      if (minhaEmpresaRes.error && process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[Atividades][empresa] erro ao carregar Minha conta:', minhaEmpresaRes.error)
      }

      const minhaEmpresa = ((minhaEmpresaRes.data ?? []) as AtividadeRow[]).filter(atividadeVisivelNaMinhaContaEmpresa)
      setListaMinha(minhaEmpresa)
      setOffsetMinha(minhaEmpresa.length)

      await carregarPerfis(minhaEmpresa, { merge: false })
      await carregarEmpresasAvaliacoes(minhaEmpresa, { merge: false })

      const postIdsEmp: string[] = []
      for (const r of minhaEmpresa) {
        if (r.tipo === 'curtiu_post') postIdsEmp.push(r.alvo_id)
        const ex = r.dados_extras
        if (ex && typeof ex === 'object') {
          const pid = ex.post_id
          if (typeof pid === 'string') postIdsEmp.push(pid)
        }
      }
      await carregarPostsMeta(postIdsEmp, { merge: false })

      setCarregando(false)
      return
    }

    setMinhaEmpresaAtividades(null)

    const seguindo = await fetchAutorIdsSeguidosAmigos(supabase, uid)
    seguindoRef.current = seguindo
    setQtdSeguindo(seguindo.length)

    const lim = ATIVIDADES_LIMITE_PAGINA
    setErroAmigos(null)

    const [amigosRes, minhaRes] = await Promise.all([
      seguindo.length
        ? supabase
            .from('atividades')
            .select('*')
            .in('autor_id', seguindo)
            /* Destinatário = eu → fica só na aba "Minha conta"; aqui só o que seguidos fazem no conteúdo de terceiros. */
            .neq('usuario_id', uid)
            .not('tipo', 'in', '(avaliou,marcou_em_story)')
            .order('created_at', { ascending: false })
            .range(0, lim - 1)
        : Promise.resolve({ data: [] as AtividadeRow[], error: null }),
      supabase
        .from('atividades')
        .select('*')
        .eq('usuario_id', uid)
        /* Um único `not…in`: dois `.neq('tipo', …)` no mesmo campo podem colidir no PostgREST. */
        .not('tipo', 'in', '(avaliou,seguiu_empresa)')
        .order('created_at', { ascending: false })
        .range(0, ATIVIDADES_LIMITE_MINHA_CONTA - 1),
    ])

    logDiagAmigos('resposta atividades (amigos)', { uid, seguindo, res: amigosRes })
    if (minhaRes.error && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[Atividades][diag] erro query Minha conta:', minhaRes.error)
    }

    if (amigosRes.error) {
      const msg = amigosRes.error.message ?? String(amigosRes.error)
      setErroAmigos(msg)
      // eslint-disable-next-line no-console
      console.error('[Atividades][Amigos] erro ao carregar atividades de amigos:', amigosRes.error)
    }

    const amigos = (amigosRes.data ?? []) as AtividadeRow[]
    const minha = ((minhaRes.data ?? []) as AtividadeRow[]).filter(atividadeVisivelNaMinhaContaPessoal)

    logDiagAmigos('após parse', { uid, seguindo, amigosLen: amigos.length, res: amigosRes })

    setListaAmigos(amigos)
    setListaMinha(minha)
    setOffsetAmigos(amigos.length)
    setOffsetMinha(minha.length)
    setTemMaisAmigos(amigos.length === lim)
    setTemMaisMinha(false)

    const todos = [...amigos, ...minha]
    await carregarPerfis(todos, { merge: false })
    await carregarEmpresasAvaliacoes(todos, { merge: false })

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

    setCarregando(false)
  }, [carregarEmpresasAvaliacoes, carregarPerfis, carregarPostsMeta])

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
        .not('tipo', 'in', '(avaliou,marcou_em_story)')
        .order('created_at', { ascending: false })
        .range(start, start + lim - 1)
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[Atividades][Amigos] carregarMaisAtividades:', error)
        setErroAmigos(error.message ?? String(error))
        return
      }
      setErroAmigos(null)
      const novas = (data ?? []) as AtividadeRow[]
      if (novas.length === 0) {
        setTemMaisAmigos(false)
        return
      }
      setListaAmigos((prev) => mergeAtividadesPorId(prev, novas))
      setOffsetAmigos(start + novas.length)
      setTemMaisAmigos(novas.length === lim)
      await carregarPerfis(novas, { merge: true })
      await carregarEmpresasAvaliacoes(novas, { merge: true })
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
    } finally {
      setCarregandoMais(false)
    }
  }, [aba, meuId, offsetAmigos, temMaisAmigos, carregarEmpresasAvaliacoes, carregarPerfis, carregarPostsMeta])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const onRedeReload = () => {
      void recarregar()
    }
    window.addEventListener('guia-feed-rede-reload', onRedeReload)
    return () => window.removeEventListener('guia-feed-rede-reload', onRedeReload)
  }, [recarregar])

  useEffect(() => {
    const onReload = (e: Event) => {
      const detail =
        e instanceof CustomEvent
          ? (e.detail as {
              autorId?: string
              postId?: string
              comentarioId?: string
              curtidaId?: string
              atividadeId?: string
            } | null)
          : null
      aplicarRemocaoLocal(detail)
      void recarregar()
    }
    window.addEventListener(GUIA_ATIVIDADES_RELOAD_EVENT, onReload as EventListener)
    return () => window.removeEventListener(GUIA_ATIVIDADES_RELOAD_EVENT, onReload as EventListener)
  }, [recarregar, aplicarRemocaoLocal])

  /** Seguidores com a aba aberta: reflete DELETE em `atividades` após descurtir (trigger no banco). */
  useEffect(() => {
    if (!meuId) return
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const agendarRecarga = () => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined
        void recarregar()
      }, 400)
    }
    const channel = supabase
      .channel(`atividades-sync-${meuId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'atividades' },
        (payload) => {
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log('[Atividades][Realtime] DELETE atividade', payload)
          }
          const old = payload.old as { id?: string } | undefined
          if (old?.id) {
            aplicarRemocaoLocal({ atividadeId: String(old.id) })
          }
          agendarRecarga()
        }
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('[Atividades][Realtime] subscription status:', status)
        }
      })
    return () => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [meuId, recarregar, aplicarRemocaoLocal])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void recarregar()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [recarregar])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    // eslint-disable-next-line no-console
    console.log('[Atividades][diag] listaAmigos atualizada, length:', listaAmigos.length)
  }, [listaAmigos])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    // eslint-disable-next-line no-console
    console.log('[Atividades][diag] meuRole / meuId:', {
      meuRole,
      meuId: meuId ? `${meuId.slice(0, 8)}…` : null,
    })
  }, [meuRole, meuId])

  const marcarMinhaLidas = useCallback(async () => {
    if (!meuId) return
    const { error } = await supabase
      .from('atividades')
      .update({ lida: true })
      .eq('usuario_id', meuId)
      .eq('lida', false)
    if (error) return
    setListaMinha((prev) => prev.map((r) => ({ ...r, lida: true })))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('perfil-atualizado'))
    }
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

  /** Empresa só tem “Minha conta”: força aba e marca lidas (antes era só `setAba`, sem `marcarMinhaLidas`). */
  useEffect(() => {
    if (meuRole !== 'empresa' || !meuId) return
    onAba('minha')
  }, [meuRole, meuId, onAba])

  const SWIPE_MIN_PX = 60
  const SWIPE_DOMINANCIA = 1.5

  const gestoComecouDentroDeModal = useCallback((target: EventTarget | null) => {
    if (!target) return false
    const el = target as Element
    if (!el || typeof (el as Element).closest !== 'function') return false
    /** Qualquer modal (incl. ModalVisualizacao) deve capturar swipe localmente. */
    return Boolean(el.closest('[role="dialog"]'))
  }, [])

  const tentarTrocarAbaPorSwipe = useCallback(
    (dx: number, dy: number) => {
      if (meuRole === 'empresa') return
      if (Math.abs(dx) < SWIPE_MIN_PX) return
      if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DOMINANCIA) return
      if (dx < 0) {
        // esquerda → Minha conta
        if (aba !== 'minha') onAba('minha')
      } else {
        // direita → Amigos
        if (aba !== 'amigos') onAba('amigos')
      }
    },
    [aba, meuRole, onAba]
  )

  const onTouchStartAtividades = useCallback((e: React.TouchEvent) => {
    if (gestoComecouDentroDeModal(e.target)) return
    const t = e.touches[0]
    if (!t) return
    swipeRef.current.pointerDown = true
    swipeRef.current.startX = t.clientX
    swipeRef.current.startY = t.clientY
    swipeRef.current.lastX = t.clientX
    swipeRef.current.lastY = t.clientY
  }, [gestoComecouDentroDeModal])

  const onTouchMoveAtividades = useCallback((e: React.TouchEvent) => {
    if (gestoComecouDentroDeModal(e.target)) return
    if (!swipeRef.current.pointerDown) return
    const t = e.touches[0]
    if (!t) return
    swipeRef.current.lastX = t.clientX
    swipeRef.current.lastY = t.clientY
  }, [gestoComecouDentroDeModal])

  const onTouchEndAtividades = useCallback(
    (e: React.TouchEvent) => {
      if (gestoComecouDentroDeModal(e.target)) return
      if (!swipeRef.current.pointerDown) return
      swipeRef.current.pointerDown = false
      const t = e.changedTouches[0]
      const endX = t?.clientX ?? swipeRef.current.lastX
      const endY = t?.clientY ?? swipeRef.current.lastY
      const dx = endX - swipeRef.current.startX
      const dy = endY - swipeRef.current.startY
      tentarTrocarAbaPorSwipe(dx, dy)
    },
    [tentarTrocarAbaPorSwipe, gestoComecouDentroDeModal]
  )

  const onPointerDownAtividades = useCallback((e: React.PointerEvent) => {
    // Desktop (mouse) para testes; touch usa onTouch* (evita duplicar).
    if (gestoComecouDentroDeModal(e.target)) return
    if (e.pointerType !== 'mouse') return
    swipeRef.current.pointerDown = true
    swipeRef.current.startX = e.clientX
    swipeRef.current.startY = e.clientY
    swipeRef.current.lastX = e.clientX
    swipeRef.current.lastY = e.clientY
  }, [gestoComecouDentroDeModal])

  const onPointerMoveAtividades = useCallback((e: React.PointerEvent) => {
    if (gestoComecouDentroDeModal(e.target)) return
    if (e.pointerType !== 'mouse') return
    if (!swipeRef.current.pointerDown) return
    swipeRef.current.lastX = e.clientX
    swipeRef.current.lastY = e.clientY
  }, [gestoComecouDentroDeModal])

  const onPointerUpAtividades = useCallback(
    (e: React.PointerEvent) => {
      if (gestoComecouDentroDeModal(e.target)) return
      if (e.pointerType !== 'mouse') return
      if (!swipeRef.current.pointerDown) return
      swipeRef.current.pointerDown = false
      const dx = e.clientX - swipeRef.current.startX
      const dy = e.clientY - swipeRef.current.startY
      tentarTrocarAbaPorSwipe(dx, dy)
    },
    [tentarTrocarAbaPorSwipe, gestoComecouDentroDeModal]
  )

  const listaAtividadesFiltrada = useMemo(() => {
    const raw = aba === 'amigos' ? listaAmigos : listaMinha
    const comentariosVistos = new Set<string>()
    return raw.filter((r) => {
      if (r.tipo === 'avaliou') return false
      if (r.tipo === 'comentou' || r.tipo === 'curtiu_comentario') {
        const ex = r.dados_extras ?? {}
        const texto = typeof ex.texto === 'string' ? ex.texto.trim() : ''
        if (!texto) return false
        const comentarioId =
          typeof ex.comentario_id === 'string' && ex.comentario_id.trim() !== ''
            ? ex.comentario_id.trim()
            : r.tipo === 'curtiu_comentario'
              ? String(r.alvo_id ?? '').trim()
              : ''
        if (comentarioId) {
          const key = `${r.tipo}:${comentarioId}`
          if (comentariosVistos.has(key)) return false
          comentariosVistos.add(key)
        }
      }
      return true
    })
  }, [aba, listaAmigos, listaMinha])

  const itensAgrupados = useMemo((): ReturnType<typeof agruparAtividadesCurtidasPost> => {
    const ord = [...listaAtividadesFiltrada].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const out = agruparAtividadesCurtidasPost(ord, postMetaMap)
    if (process.env.NODE_ENV === 'development' && aba === 'amigos') {
      // eslint-disable-next-line no-console
      console.log('[Atividades][Amigos][diag] itensAgrupados', {
        len: out.length,
        listaFiltradaLen: listaAtividadesFiltrada.length,
        primeiro: out[0] ?? null,
      })
    }
    return out
  }, [listaAtividadesFiltrada, postMetaMap, aba])

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
      const urlsGrid = item.rows.map((r: AtividadeRow) => {
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
          postIds={item.rows.map((r: AtividadeRow) => String(r.alvo_id))}
          totalCurtidas={item.rows.length}
          tempoInteracao={formatarDataAtividades(item.created_at)}
          modoMinhaConta={modoMinhaConta}
        />
      )
    }

    if (item.kind === 'curtiu_post_fotos_multi') {
      const inter = perfilMap[item.autor_id]
      /** Uma URL por linha (alinhada a `postIds`); placeholder se a meta ainda não tiver foto. */
      const urlsGrid = item.rows.map((r: AtividadeRow) => {
        const u = urlFotoPost(postMetaMap[r.alvo_id])
        return u && String(u).trim() !== '' ? String(u) : '/window.svg'
      })
      return (
        <AtividadeCurtidas
          key={`cfm-${item.autor_id}-${item.created_at}-${idx}`}
          interactorUsername={inter?.username ?? 'usuario'}
          interactorFoto={inter?.foto_perfil_url ?? null}
          hrefInteractor={hrefUsuario(item.autor_id)}
          urls={urlsGrid}
          postIds={item.rows.map((r: AtividadeRow) => String(r.alvo_id))}
          totalCurtidas={item.rows.length}
          tempoInteracao={formatarDataAtividades(item.created_at)}
          modoMinhaConta={modoMinhaConta}
          modoColetivo
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

      if (item.categoria === 'verificacao_profissional') {
        const rawMeta = post?.avaliacao_meta
        const meta =
          rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
            ? { ...(rawMeta as Record<string, unknown>) }
            : {}
        const cat = typeof meta.categoria_rotulo === 'string' ? meta.categoria_rotulo : '—'
        return (
          <AtividadeCurtiuVerificacaoProfissional
            key={r.id}
            interactorUsername={inter?.username ?? 'usuario'}
            interactorFoto={inter?.foto_perfil_url ?? null}
            donorUsername={donor?.username ?? 'usuario'}
            hrefInteractor={hrefI}
            hrefDonor={hrefD}
            texto={textoPost}
            postId={r.alvo_id}
            categoriaRotulo={cat}
            tempoInteracao={formatarDataAtividades(r.created_at)}
            modoMinhaConta={modoMinhaConta}
          />
        )
      }

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
            tempoInteracao={formatarDataAtividades(r.created_at)}
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
            tempoInteracao={formatarDataAtividades(r.created_at)}
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
            tempoInteracao={formatarDataAtividades(r.created_at)}
            modoMinhaConta={modoMinhaConta}
          />
        )
      }

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[Atividades][renderItem] curtiu_post_solo sem UI para categoria:', item.categoria, 'row id:', item.row?.id)
      }
      return null
    }

    const r = item.row
    const ator = perfilMap[r.autor_id]

    if (r.tipo === 'avaliou') {
      const ex = r.dados_extras ?? {}
      const empresaIdRaw =
        typeof ex.empresa_id === 'string' && ex.empresa_id.trim() !== ''
          ? ex.empresa_id.trim()
          : String(r.alvo_id ?? '').trim()
      const notaRaw = ex.nota
      const nota =
        typeof notaRaw === 'number'
          ? notaRaw
          : typeof notaRaw === 'string'
            ? Number(notaRaw)
            : 0
      const feedback =
        typeof ex.feedback === 'string' && ex.feedback.trim() !== '' ? String(ex.feedback).trimEnd() : null
      const empresaAvaliacao = empresaAvaliacaoMap[empresaIdRaw]
      const nomeEmpresa =
        empresaAvaliacao?.nome ??
        (minhaEmpresaAtividades && minhaEmpresaAtividades.id === empresaIdRaw
          ? minhaEmpresaAtividades.nome
          : minhaEmpresaAtividades?.nome ?? 'sua empresa')
      return (
        <AtividadeAvaliacao
          key={r.id}
          usuarioAtorId={r.autor_id}
          usernameAtor={ator?.username ?? 'usuario'}
          interactorFoto={ator?.foto_perfil_url ?? null}
          hrefAtor={hrefUsuario(r.autor_id)}
          nomeEmpresa={nomeEmpresa}
          empresaId={empresaIdRaw || (minhaEmpresaAtividades?.id ?? '')}
          empresaUsername={empresaAvaliacao?.username ?? ''}
          empresaFoto={empresaAvaliacao?.foto_url ?? null}
          nota={Number.isFinite(nota) ? nota : 0}
          feedback={feedback}
          tempoInteracao={formatarDataAtividades(r.created_at)}
        />
      )
    }

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
          tempoInteracao={formatarDataAtividades(r.created_at)}
          modoMinhaConta={modoMinhaConta}
        />
      )
    }

    if (r.tipo === 'repostou_story') {
      const ex = r.dados_extras ?? {}
      const storyId =
        typeof ex.story_id === 'string' && ex.story_id.trim() !== ''
          ? ex.story_id.trim()
          : String(r.alvo_id ?? '').trim()
      if (!storyId) return null
      const originalAuthorId =
        typeof ex.autor_original_id === 'string' && ex.autor_original_id.trim() !== ''
          ? ex.autor_original_id.trim()
          : r.usuario_id
      const donor = perfilMap[originalAuthorId]
      const reposterUsername =
        normalizarUsernameAtividade(
          typeof ex.autor_username === 'string' ? ex.autor_username : ator?.username
        ) || 'usuario'
      const originalUsername = resolverUsernameOriginalRepostStory(ex, donor?.username ?? '')
      const conteudoUrl =
        typeof ex.conteudo_url === 'string' && ex.conteudo_url.trim() !== '' ? ex.conteudo_url.trim() : null
      return (
        <AtividadeRepostouStory
          key={r.id}
          reposterUsername={reposterUsername}
          reposterFoto={ator?.foto_perfil_url ?? null}
          hrefReposter={hrefUsuario(r.autor_id)}
          originalUsername={originalUsername}
          hrefOriginal={hrefUsuario(originalAuthorId)}
          conteudoUrl={conteudoUrl}
          tempoInteracao={formatarDataAtividades(r.created_at)}
          modoMinhaConta={modoMinhaConta}
          euRepostei={Boolean(meuId && r.autor_id === meuId)}
          onAbrirStory={() => void carregarStoryPorId(storyId)}
        />
      )
    }

    if (r.tipo === 'curtiu_comentario') {
      const ex = r.dados_extras ?? {}
      const postId = typeof ex.post_id === 'string' ? ex.post_id : ''
      const texto = String(ex.texto ?? '')
      if (!texto.trim()) return null
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
          tempoInteracao={formatarDataAtividades(r.created_at)}
          modoMinhaConta={modoMinhaConta}
        />
      )
    }

    if (r.tipo === 'comentou') {
      const ex = r.dados_extras ?? {}
      const texto = String(ex.texto ?? '')
      if (!texto.trim()) return null
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
          atorVerificado={Boolean(ator?.verificado)}
          donoVerificado={Boolean(donor?.verificado)}
          hrefInteractor={hrefUsuario(r.autor_id)}
          hrefDono={hrefUsuario(donorId)}
          emFoto={emFoto}
          textoComentario={texto}
          postId={postId}
          comentarioId={comentarioId}
          tempoInteracao={formatarDataAtividades(r.created_at)}
          modoMinhaConta={modoMinhaConta}
        />
      )
    }

    if (r.tipo === 'marcou_em_story') {
      const ex = r.dados_extras ?? {}
      const storyId =
        typeof ex.story_id === 'string' && ex.story_id.trim() !== ''
          ? ex.story_id.trim()
          : String(r.alvo_id ?? '').trim()
      if (!storyId) return null
      const autorId =
        typeof ex.autor_id === 'string' && ex.autor_id.trim() !== '' ? ex.autor_id.trim() : r.autor_id
      const autorPerfil = perfilMap[autorId] ?? ator
      const autorUsername =
        typeof ex.autor_username === 'string' && ex.autor_username.trim() !== ''
          ? ex.autor_username.trim().replace(/^@+/, '')
          : (autorPerfil?.username ?? 'usuario')
      const conteudoUrl =
        typeof ex.conteudo_url === 'string' && ex.conteudo_url.trim() !== '' ? ex.conteudo_url.trim() : null
      return (
        <div key={r.id} className="grid min-w-0 grid-cols-[2.5rem_1fr] items-start gap-x-2 text-sm text-gray-800">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.push(hrefUsuario(autorId))}
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
              aria-label={`Perfil de @${autorUsername}`}
            >
              <AvatarImage src={autorPerfil?.foto_perfil_url ?? null} alt="" fill className="object-cover" sizes="40px" />
            </button>
            <span className="max-w-[2.5rem] text-center text-[10px] leading-tight text-gray-500">
              {formatarDataAtividades(r.created_at)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void carregarStoryPorId(storyId)}
            className="flex min-w-0 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-gray-100"
          >
            <span className="min-w-0 flex-1">
              <span className="text-sm leading-snug text-gray-800">
                <span className="font-medium text-[#0097b2]">@{autorUsername}</span> marcou você em um story.
              </span>
            </span>
            {conteudoUrl ? (
              <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
                <AvatarImage src={conteudoUrl} alt="" fill className="object-cover" sizes="36px" />
              </span>
            ) : null}
          </button>
        </div>
      )
    }

    if (r.tipo === 'seguiu_empresa') {
      const ex = r.dados_extras ?? {}
      const seguidorId = typeof ex.seguidor_id === 'string' ? ex.seguidor_id : r.autor_id
      const empresaIdStr =
        typeof ex.empresa_id === 'string' ? ex.empresa_id : typeof r.alvo_id === 'string' ? r.alvo_id : ''
      const usernameSeg =
        typeof ex.seguidor_username === 'string' && ex.seguidor_username.trim() !== ''
          ? ex.seguidor_username.trim()
          : (perfilMap[seguidorId]?.username ?? 'usuario')
      const usernameEmp =
        typeof ex.empresa_username === 'string' && ex.empresa_username.trim() !== ''
          ? ex.empresa_username.trim()
          : 'empresa'
      const uSeg = perfilMap[seguidorId]
      return (
        <AtividadeSeguidor
          key={r.id}
          seguidorUsuarioId={seguidorId}
          usernameSeguidor={usernameSeg}
          seguidorFoto={uSeg?.foto_perfil_url ?? null}
          hrefSeguidor={hrefUsuario(seguidorId)}
          usernameSeguido={usernameEmp}
          seguidoUsuarioId={empresaIdStr || seguidorId}
          seguidoTipo="empresa"
          empresaId={empresaIdStr || null}
          tempoInteracao={formatarDataAtividades(r.created_at)}
          modoMinhaConta={modoMinhaConta}
          meuUsuarioId={meuId}
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
      const empresaIdExtra =
        ex && typeof ex === 'object' && typeof (ex as Record<string, unknown>).empresa_id === 'string'
          ? String((ex as Record<string, unknown>).empresa_id).trim()
          : ''
      const empId =
        seguidoTipo === 'empresa'
          ? (empresaIdExtra !== '' ? empresaIdExtra : seguidoEmpresaMap[seguidoId] ?? null)
          : null
      return (
        <AtividadeSeguidor
          key={r.id}
          seguidorUsuarioId={seguidorId}
          usernameSeguidor={uSeg?.username ?? 'usuario'}
          seguidorFoto={uSeg?.foto_perfil_url ?? null}
          hrefSeguidor={hrefUsuario(seguidorId)}
          usernameSeguido={uAlvo?.username ?? 'usuario'}
          seguidoUsuarioId={seguidoId}
          seguidoTipo={seguidoTipo}
          empresaId={empId}
          tempoInteracao={formatarDataAtividades(r.created_at)}
          modoMinhaConta={modoMinhaConta}
          meuUsuarioId={meuId}
        />
      )
    }

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[Atividades][renderItem] tipo sem UI:', r.tipo, 'id:', r.id)
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
          <div className="relative flex min-h-[3rem] w-full items-center sm:min-h-[3.35rem]">
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-10 transition-[opacity,transform] duration-300 ease-out ${
                pesquisaAberta ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'
              }`}
              aria-hidden={pesquisaAberta}
            >
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">ATIVIDADES</h1>
              <p className="text-center text-xs font-medium leading-tight text-white/90 sm:text-sm">
                {meuRole === 'empresa' ? 'Minha Conta' : 'Atividades recentes'}
              </p>
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

      <AbasAtividades aba={aba} onAba={onAba} somenteMinhaConta={meuRole === 'empresa'} />

      {erroAmigos ? (
        <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          Não foi possível carregar a aba Amigos: {erroAmigos}
        </div>
      ) : null}

      <div
        className="px-4 py-3"
        onTouchStart={onTouchStartAtividades}
        onTouchMove={onTouchMoveAtividades}
        onTouchEnd={onTouchEndAtividades}
        onPointerDown={onPointerDownAtividades}
        onPointerMove={onPointerMoveAtividades}
        onPointerUp={onPointerUpAtividades}
      >
        {itensAgrupados.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {aba === 'amigos' && qtdSeguindo === 0
              ? 'Siga pessoas no perfil delas para ver aqui o que estão curtindo, comentando e fazendo no app.'
              : 'Nenhuma atividade por aqui ainda.'}
          </p>
        ) : (
          <>
            <div className="space-y-6">
              {itensAgrupados.map((it: (typeof itensAgrupados)[number], i: number) => {
                const rowKey =
                  it.kind === 'curtiu_post_fotos'
                    ? `cf-${it.autor_id}-${it.usuario_dono_id}-${it.created_at}`
                    : it.kind === 'curtiu_post_fotos_multi'
                      ? `cfm-${it.autor_id}-${it.created_at}`
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
      {storyModal ? (
        <StoryViewer
          story={storyModal}
          userEmail={meuEmail}
          meuUsuarioId={meuId}
          storyQueueLength={1}
          storyQueueIndex={0}
          onFechar={() => setStoryModal(null)}
        />
      ) : null}
    </div>
  )
}
