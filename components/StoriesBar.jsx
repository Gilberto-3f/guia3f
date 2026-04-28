'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AvatarImage from '@/components/AvatarImage'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchFotoPerfilUsuario,
  fetchNomeUsuarioParaStory,
  pickAutorDisplay,
  STORY_RING_GRADIENT,
  visualizadoPorEmails,
} from '@/lib/feed-autor'
import { isTipoVideoPost } from '@/lib/feedFiltroSeguidos'
import StoryCircle from '@/components/StoryCircle'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

const MAX_STORY_RINGS = 12

/** @param {unknown} tipo */
function isAutorEmpresa(tipo) {
  return String(tipo ?? '').toLowerCase() === 'empresa'
}

/**
 * Intercala até `len` itens: a,a,a,b,a,a,a,b,...
 * @param {string[]} seguidos
 * @param {string | null} obrigatorio
 * @param {number} len
 */
function intercalar(seguidos, obrigatorio, len) {
  const out = /** @type {string[]} */ ([])
  if (!obrigatorio && seguidos.length === 0) return out
  let i = 0
  while (out.length < len) {
    for (let k = 0; k < 3 && out.length < len; k++) {
      if (seguidos.length === 0) break
      out.push(seguidos[i % seguidos.length])
      i++
    }
    if (obrigatorio && out.length < len) out.push(obrigatorio)
    if (seguidos.length === 0 && !obrigatorio) break
  }
  return out
}

/**
 * @param {unknown} visualizado_por
 * @param {string | null} userEmail
 */
function foiVisualizado(visualizado_por, userEmail) {
  if (!userEmail) return false
  return visualizadoPorEmails(visualizado_por).includes(userEmail)
}

/** Rótulo curto a partir do objeto já processado por pickAutorDisplay. */
function abreviarLabelStory(s, max = 11) {
  const t = String(s ?? '').trim()
  if (!t) return t
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function labelStoryDeAutor(d) {
  const h = d.username != null ? String(d.username).trim() : ''
  if (h && h !== 'usuario') return abreviarLabelStory(h.startsWith('@') ? h : `@${h.replace(/^@/, '')}`)
  const n = d.nome != null ? String(d.nome).trim() : ''
  if (n) return abreviarLabelStory(n)
  return abreviarLabelStory('Usuário')
}

/**
 * Username para o texto abaixo do anel: prioriza `nome_usuario` nos embeds (igual ao @ do feed).
 * @param {unknown} u linha de `usuarios` com turistas/profissionais/empresas
 */
function labelFromUsuarioRow(u) {
  if (!u || typeof u !== 'object') return abreviarLabelStory('Usuário')
  const row = /** @type {Record<string, unknown>} */ (u)
  const firstEmbed = (v) => {
    if (v == null) return null
    if (Array.isArray(v)) {
      const x = v[0]
      return x != null && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x) : null
    }
    return typeof v === 'object' ? /** @type {Record<string, unknown>} */ (v) : null
  }
  const t = firstEmbed(row.turistas)
  const p = firstEmbed(row.profissionais)
  const e = firstEmbed(row.empresas)
  const colUsername =
    typeof row.username === 'string' && row.username.trim() !== '' ? row.username.trim() : null
  const colUsernameOk = colUsername && colUsername.toLowerCase() !== 'usuario' ? colUsername : null
  /** Embeds primeiro (mesma fonte do @ no feed); `usuarios.username` só como fallback. */
  const raw =
    (t?.nome_usuario != null ? String(t.nome_usuario).trim() : null) ??
    (p?.nome_usuario != null ? String(p.nome_usuario).trim() : null) ??
    (e?.nome_usuario != null ? String(e.nome_usuario).trim() : null) ??
    colUsernameOk
  if (raw && raw.toLowerCase() !== 'usuario') {
    const out = raw.startsWith('@') ? raw : `@${raw.replace(/^@/, '')}`
    return abreviarLabelStory(out)
  }
  return abreviarLabelStory(labelStoryDeAutor(pickAutorDisplay(u)))
}

/** @param {string | null | undefined} s */
function formatStoryHandle(s) {
  const t = String(s ?? '').trim()
  if (!t || t.toLowerCase() === 'usuario') return null
  return t.startsWith('@') ? t : `@${t.replace(/^@/, '')}`
}

/** Empresa na barra: @nome_usuario ou nome fantasia curto. */
function labelStoryEmpresa(e) {
  const nu = e.nome_usuario != null ? String(e.nome_usuario).trim() : ''
  if (nu) return abreviarLabelStory(nu.startsWith('@') ? nu : `@${nu.replace(/^@/, '')}`)
  const nf = e.nome_fantasia != null ? String(e.nome_fantasia).trim() : 'Empresa'
  return abreviarLabelStory(nf)
}

/**
 * @param {{
 *   hidden?: boolean
 *   userEmail: string | null
 *   onOpenStory: (id: string) => void
 *   reloadSignal?: number
 * }} props
 */
export default function StoriesBar({ hidden = false, userEmail, onOpenStory, reloadSignal = 0 }) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  /** @type {{ avatarUrl: string | null, storyId: string | null, visualizado_por: unknown }} */
  const [meuSlot, setMeuSlot] = useState({
    avatarUrl: null,
    storyId: null,
    visualizado_por: null,
  })

  /** @type {{ id: string, label: string, avatarUrl: string | null, visualizado_por: unknown }[]} */
  const [rings, setRings] = useState([])
  const [meuUserId, setMeuUserId] = useState(/** @type {string | null} */ (null))

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setRings([])
      setMeuUserId(null)
      setMeuSlot({ avatarUrl: null, storyId: null, visualizado_por: null })
      return
    }

    const uid = session.user.id
    setMeuUserId(uid)

    const USUARIOS_MEU_SELECT = `
      id,
      email,
      role,
      turistas (nome_completo, nome_usuario, foto_perfil_url, foto_url),
      profissionais (nome_completo, nome_usuario, foto_perfil_url, foto_url),
      empresas (id, nome_fantasia, nome_usuario, foto_url)
    `

    /** @param {string} userId */
    const carregarMeuAvatar = async (userId) => {
      let meuAvatarUrl = await fetchFotoPerfilUsuario(supabase, userId)
      if (!meuAvatarUrl) {
        const { data: meU, error: meErr } = await supabase.from('usuarios').select(USUARIOS_MEU_SELECT).eq('id', userId).maybeSingle()
        if (!meErr && meU) {
          meuAvatarUrl = pickAutorDisplay(meU).foto_perfil_url
        }
      }
      return meuAvatarUrl
    }

    const [
      { data: seguidosRows },
      { data: storiesRows, error: storiesErr },
      { data: destaque },
      meuAvatarUrl,
    ] = await Promise.all([
      supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', uid),
      supabase
        .from('stories')
        .select('id, autor_id, conteudo_url, visualizado_por, created_at, tipo, autor_tipo')
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('empresas').select('usuario_id, nome_fantasia, nome_usuario, foto_url').eq('is_publicidade', true).limit(1).maybeSingle(),
      carregarMeuAvatar(uid),
    ])

    if (storiesErr) {
      console.error(storiesErr)
      setRings([])
      setMeuSlot({ avatarUrl: meuAvatarUrl, storyId: null, visualizado_por: null })
      return
    }

    const seguidosIds = new Set((seguidosRows ?? []).map((r) => String(r.seguido_id)))

    const storyAutorIds = [...new Set((storiesRows ?? []).map((s) => String(s.autor_id)).filter(Boolean))]
    let empresasRows = /** @type {{ usuario_id: string, nome_fantasia: string | null, nome_usuario: string | null, foto_url: string | null }[]} */ (
      []
    )
    if (storyAutorIds.length > 0) {
      const { data: empData } = await supabase
        .from('empresas')
        .select('usuario_id, nome_fantasia, nome_usuario, foto_url')
        .in('usuario_id', storyAutorIds)
      empresasRows = empData ?? []
    }

    const empresaAutorSet = new Set(empresasRows.map((e) => String(e.usuario_id)).filter(Boolean))
    const emps = empresasRows

    /** Stories permitidos: o próprio utilizador, seguidos (não empresa) ou qualquer empresa; sem vídeo. */
    const storiesFiltradas = (storiesRows ?? []).filter((s) => {
      if (isTipoVideoPost(s.tipo)) return false
      const aid = String(s.autor_id)
      if (aid === uid) return true
      const isEmp = isAutorEmpresa(s.autor_tipo) || empresaAutorSet.has(aid)
      if (isEmp) return true
      return seguidosIds.has(aid)
    })

    const byAutor = /** @type {Map<string, NonNullable<typeof storiesFiltradas>[0]>} */ (new Map())
    for (const s of storiesFiltradas) {
      const aid = String(s.autor_id)
      if (!byAutor.has(aid)) byAutor.set(aid, s)
    }

    const meuStoryRow = byAutor.get(uid)
    const meuTemStoryRow = meuStoryRow && !isTipoVideoPost(meuStoryRow.tipo)
    setMeuSlot({
      avatarUrl: meuAvatarUrl,
      storyId: meuTemStoryRow ? String(meuStoryRow.id) : null,
      visualizado_por: meuStoryRow?.visualizado_por ?? null,
    })

    const obrAutor = destaque?.usuario_id != null ? String(destaque.usuario_id) : null

    /** @type {string[]} */
    const ordered = []
    const seen = new Set()

    const pushAid = (aid) => {
      if (ordered.length >= MAX_STORY_RINGS) return false
      if (seen.has(aid) || !byAutor.has(aid)) return false
      ordered.push(aid)
      seen.add(aid)
      return true
    }

    seen.add(uid)

    // 1) Seguidos turista/profissional (não empresa)
    const seguidosNaoEmpresa = [...byAutor.entries()]
      .filter(([aid, s]) => aid !== uid && seguidosIds.has(aid) && !isAutorEmpresa(s.autor_tipo) && !empresaAutorSet.has(aid))
      .sort((a, b) => {
        const ta = new Date(/** @type {string} */ (a[1].created_at ?? 0)).getTime()
        const tb = new Date(/** @type {string} */ (b[1].created_at ?? 0)).getTime()
        return tb - ta
      })
    for (const [aid] of seguidosNaoEmpresa) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    // 2) Stories de empresas (visíveis para todos) — intercala destaque publicitário
    const empresaComStory = [...byAutor.keys()].filter((aid) => empresaAutorSet.has(aid))
    const sObr = obrAutor ? byAutor.get(obrAutor) : null
    const obrEmpresaValido = obrAutor && sObr && (isAutorEmpresa(sObr.autor_tipo) || empresaAutorSet.has(obrAutor)) ? obrAutor : null
    const obrFinal = obrEmpresaValido ?? empresaComStory.find((a) => byAutor.has(a)) ?? null
    const ordemEmpresa = intercalar(empresaComStory, obrFinal, 24)
    for (const aid of ordemEmpresa) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    const labels = /** @type {Record<string, string>} */ ({})
    const previews = /** @type {Record<string, string | null>} */ ({})
    for (const e of emps ?? []) {
      const uid = String(e.usuario_id)
      labels[uid] = labelStoryEmpresa(e)
      previews[uid] = e.foto_url != null ? String(e.foto_url) : null
    }
    if (destaque?.usuario_id) {
      const uid = String(destaque.usuario_id)
      labels[uid] = labelStoryEmpresa(destaque)
      previews[uid] = destaque.foto_url != null ? String(destaque.foto_url) : null
    }

    const precisaPerfil = ordered.filter((aid) => labels[aid] == null)
    const usuariosPromise =
      precisaPerfil.length > 0
        ? supabase.from('usuarios').select(USUARIOS_MEU_SELECT).in('id', precisaPerfil)
        : Promise.resolve({ data: null, error: null })

    const { data: usuariosRows, error: uErr } = await usuariosPromise
    if (uErr) {
      console.error('[StoriesBar] usuarios (perfis story):', uErr)
    }
    if (!uErr && usuariosRows?.length) {
      for (const u of usuariosRows) {
        const d = pickAutorDisplay(u)
        const id = String(u.id)
        labels[id] = labelFromUsuarioRow(u)
        previews[id] = d.foto_perfil_url
      }
    }

    await Promise.all(
      ordered.map(async (aid) => {
        if (!previews[aid]) {
          const url = await fetchFotoPerfilUsuario(supabase, aid)
          if (url) previews[aid] = url
        }
      })
    )

    for (const aid of ordered) {
      if (labels[aid] != null) continue
      const { data: uRow, error: oneErr } = await supabase
        .from('usuarios')
        .select(USUARIOS_MEU_SELECT)
        .eq('id', aid)
        .maybeSingle()
      if (oneErr) console.warn('[StoriesBar] usuarios fallback', aid, oneErr)
      if (uRow) {
        const d = pickAutorDisplay(uRow)
        labels[aid] = labelFromUsuarioRow(uRow)
        if (!previews[aid] && d.foto_perfil_url) previews[aid] = d.foto_perfil_url
      } else {
        labels[aid] = 'Usuário'
      }
    }

    await Promise.all(
      ordered.map(async (aid) => {
        if (empresaAutorSet.has(aid)) return
        const nu = await fetchNomeUsuarioParaStory(supabase, aid)
        const h = formatStoryHandle(nu)
        if (h) labels[aid] = h
      })
    )

    const built = ordered
      .map((aid) => {
        const s = byAutor.get(aid)
        if (!s) return null
        const avatarUrl = previews[aid] ?? null
        return {
          id: String(s.id),
          label: labels[aid] ?? 'Usuário',
          avatarUrl,
          visualizado_por: s.visualizado_por,
        }
      })
      .filter(Boolean)

    const naoVistos = /** @type {NonNullable<(typeof built)[0]>[]} */ (
      built.filter((b) => b && !foiVisualizado(b.visualizado_por, userEmail))
    )
    const vistos = /** @type {NonNullable<(typeof built)[0]>[]} */ (
      built.filter((b) => b && foiVisualizado(b.visualizado_por, userEmail))
    )

    setRings([...naoVistos, ...vistos])
  }, [userEmail])

  useEffect(() => {
    void load()
  }, [load, reloadSignal])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const onFocus = () => {
      void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
    }
  }, [load])

  useEffect(() => {
    const onPerfil = () => void load()
    window.addEventListener('perfil-atualizado', onPerfil)
    return () => window.removeEventListener('perfil-atualizado', onPerfil)
  }, [load])

  if (hidden) return null

  const meuVisto = foiVisualizado(meuSlot.visualizado_por, userEmail)
  const meuTemStory = Boolean(meuSlot.storyId)

  return (
    <div className="border-b border-gray-200 bg-transparent py-1.5">
      <div className="flex items-start gap-3 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Slot fixo estilo Instagram: foto do utilizador + criar story */}
        <div className="flex w-[76px] shrink-0 flex-col items-center gap-1">
          <div className="relative flex aspect-square w-[76px] items-center justify-center">
            <div
              className={`box-border w-full max-w-[76px] rounded-full p-[3px] ${
                meuTemStory && meuVisto ? 'bg-gray-300' : !meuTemStory ? 'border-2 border-gray-300/90 bg-white' : ''
              }`}
              style={meuTemStory && !meuVisto ? { background: STORY_RING_GRADIENT } : undefined}
            >
              <div className="rounded-full bg-white p-[2px]">
                {meuUserId ? (
                  meuTemStory ? (
                    <button
                      type="button"
                      onClick={() => meuSlot.storyId && onOpenStory(meuSlot.storyId)}
                      className="relative block aspect-square w-full max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100"
                      aria-label="Ver seu story"
                    >
                      <AvatarImage
                        key={meuSlot.avatarUrl || 'def'}
                        src={meuSlot.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="76px"
                        priority
                      />
                    </button>
                  ) : (
                    <Link
                      href="/feed/story/criar"
                      className="relative block aspect-square w-full max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100"
                      aria-label="Criar seu story"
                    >
                      <AvatarImage
                        key={meuSlot.avatarUrl || 'def'}
                        src={meuSlot.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="76px"
                        priority
                      />
                    </Link>
                  )
                ) : (
                  <div className="relative block aspect-square max-h-[68px] max-w-[68px] overflow-hidden rounded-full bg-gray-100" />
                )}
              </div>
            </div>
            {podeInteragir ? (
              <Link
                href="/feed/story/criar"
                onClick={(e) => e.stopPropagation()}
                className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#0097b2] text-white shadow-md ring-2 ring-white"
                aria-label="Novo story"
              >
                <Plus size={16} strokeWidth={2.5} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  notificarSomenteLeitura()
                }}
                className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-400 text-white shadow-md ring-2 ring-white"
                aria-label="Novo story (bloqueado no modo apresentação)"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <span className="max-w-[5rem] truncate text-center text-xs leading-tight text-gray-700">Seu story</span>
        </div>

        {rings.map((s) => (
          <StoryCircle
            key={s.id}
            id={s.id}
            label={s.label}
            avatarUrl={s.avatarUrl}
            visualizado_por={s.visualizado_por}
            userEmail={userEmail}
            onOpen={onOpenStory}
          />
        ))}
      </div>
    </div>
  )
}
