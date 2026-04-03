'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay, visualizadoPorEmails } from '@/lib/feed-autor'
import StoryCircle from '@/components/StoryCircle'

const MAX_STORY_RINGS = 12

const GRADIENT =
  'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'

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

/**
 * @param {{
 *   hidden?: boolean
 *   userEmail: string | null
 *   onOpenStory: (id: string) => void
 *   reloadSignal?: number
 * }} props
 */
export default function StoriesBar({ hidden = false, userEmail, onOpenStory, reloadSignal = 0 }) {
  /** @type {{ avatarUrl: string | null, storyId: string | null, visualizado_por: unknown }} */
  const [meuSlot, setMeuSlot] = useState({
    avatarUrl: null,
    storyId: null,
    visualizado_por: null,
  })

  /** @type {{ id: string, label: string, avatarUrl: string | null, isVideo: boolean, visualizado_por: unknown }[]} */
  const [rings, setRings] = useState([])

  const router = useRouter()

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setRings([])
      setMeuSlot({ avatarUrl: null, storyId: null, visualizado_por: null })
      return
    }

    const uid = session.user.id

    const { data: meU, error: meErr } = await supabase
      .from('usuarios')
      .select(
        `
        id,
        email,
        role,
        turistas (nome_completo, nome_usuario, foto_perfil_url),
        profissionais (nome_completo, nome_usuario, foto_perfil_url),
        empresas (id, nome_fantasia, nome_usuario, foto_url)
      `
      )
      .eq('id', uid)
      .maybeSingle()

    let meuAvatarUrl = null
    if (!meErr && meU) {
      meuAvatarUrl = pickAutorDisplay(meU).foto_perfil_url
    }

    const { data: seguidosRows } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', uid)

    const seguidosIds = new Set((seguidosRows ?? []).map((r) => String(r.seguido_id)))

    const { data: favs } = await supabase.from('favoritos').select('empresa_id').eq('usuario_id', uid).not('empresa_id', 'is', null)

    const empresaIds = [...new Set((favs ?? []).map((f) => f.empresa_id).filter(Boolean))]

    let emps = /** @type {{ id: string, usuario_id: string, nome_fantasia: string | null, foto_url: string | null }[]} */ ([])
    let autorSeguidos = /** @type {string[]} */ ([])
    if (empresaIds.length) {
      const { data: empsData } = await supabase
        .from('empresas')
        .select('id, usuario_id, nome_fantasia, foto_url')
        .in('id', empresaIds)
      emps = /** @type {typeof emps} */ (empsData ?? [])
      autorSeguidos = emps.map((e) => String(e.usuario_id)).filter(Boolean)
    }

    const { data: storiesRows, error: storiesErr } = await supabase
      .from('stories')
      .select('id, autor_id, conteudo_url, visualizado_por, created_at, tipo, autor_tipo')
      .gt('expira_em', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(80)

    if (storiesErr) {
      console.error(storiesErr)
      setRings([])
      setMeuSlot({ avatarUrl: meuAvatarUrl, storyId: null, visualizado_por: null })
      return
    }

    const byAutor = /** @type {Map<string, NonNullable<typeof storiesRows>[0]>} */ (new Map())
    for (const s of storiesRows ?? []) {
      const aid = String(s.autor_id)
      if (!byAutor.has(aid)) byAutor.set(aid, s)
    }

    const meuStoryRow = byAutor.get(uid)
    setMeuSlot({
      avatarUrl: meuAvatarUrl,
      storyId: meuStoryRow ? String(meuStoryRow.id) : null,
      visualizado_por: meuStoryRow?.visualizado_por ?? null,
    })

    const { data: destaque } = await supabase
      .from('empresas')
      .select('usuario_id, nome_fantasia, foto_url')
      .eq('is_publicidade', true)
      .limit(1)
      .maybeSingle()

    let obrAutor = destaque?.usuario_id != null ? String(destaque.usuario_id) : null
    if (!obrAutor && empresaIds.length) {
      const { data: uma } = await supabase.from('empresas').select('usuario_id').limit(1).maybeSingle()
      obrAutor = uma?.usuario_id != null ? String(uma.usuario_id) : null
    }

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

    // Próprio utilizador: slot fixo à parte — não entra na lista horizontal
    seen.add(uid)

    // 1) Seguidos (não empresa)
    const seguidosNaoEmpresa = [...byAutor.entries()]
      .filter(([aid, s]) => aid !== uid && seguidosIds.has(aid) && !isAutorEmpresa(s.autor_tipo))
      .sort((a, b) => {
        const ta = new Date(/** @type {string} */ (a[1].created_at ?? 0)).getTime()
        const tb = new Date(/** @type {string} */ (b[1].created_at ?? 0)).getTime()
        return tb - ta
      })
    for (const [aid] of seguidosNaoEmpresa) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    const empresaSeguidosComStory = autorSeguidos.filter((a) => {
      const s = byAutor.get(a)
      return s != null && isAutorEmpresa(s.autor_tipo)
    })
    const sObr = obrAutor ? byAutor.get(obrAutor) : null
    const obrEmpresa =
      obrAutor && sObr && isAutorEmpresa(sObr.autor_tipo) ? obrAutor : empresaSeguidosComStory.find((a) => byAutor.has(a)) ?? null

    const ordemEmpresa = intercalar(empresaSeguidosComStory, obrEmpresa, 24)
    for (const aid of ordemEmpresa) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    const outrosNaoSeguidos = [...byAutor.entries()]
      .filter(([aid, s]) => !seen.has(aid) && !isAutorEmpresa(s.autor_tipo) && aid !== uid && !seguidosIds.has(aid))
      .sort((a, b) => {
        const ta = new Date(/** @type {string} */ (a[1].created_at ?? 0)).getTime()
        const tb = new Date(/** @type {string} */ (b[1].created_at ?? 0)).getTime()
        return tb - ta
      })
    for (const [aid] of outrosNaoSeguidos) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    const restantesEmpresa = [...byAutor.entries()]
      .filter(([aid, s]) => !seen.has(aid) && isAutorEmpresa(s.autor_tipo))
      .sort((a, b) => {
        const ta = new Date(/** @type {string} */ (a[1].created_at ?? 0)).getTime()
        const tb = new Date(/** @type {string} */ (b[1].created_at ?? 0)).getTime()
        return tb - ta
      })
    for (const [aid] of restantesEmpresa) {
      if (ordered.length >= MAX_STORY_RINGS) break
      pushAid(aid)
    }

    const labels = /** @type {Record<string, string>} */ ({})
    const previews = /** @type {Record<string, string | null>} */ ({})
    for (const e of emps ?? []) {
      labels[String(e.usuario_id)] = String(e.nome_fantasia ?? 'Empresa')
      previews[String(e.usuario_id)] = e.foto_url != null ? String(e.foto_url) : null
    }
    if (destaque?.usuario_id) {
      labels[String(destaque.usuario_id)] = String(destaque.nome_fantasia ?? 'Destaque')
      previews[String(destaque.usuario_id)] = destaque.foto_url != null ? String(destaque.foto_url) : null
    }

    const precisaPerfil = ordered.filter((aid) => labels[aid] == null)
    if (precisaPerfil.length > 0) {
      const { data: usuariosRows, error: uErr } = await supabase
        .from('usuarios')
        .select(
          `
          id,
          email,
          role,
          turistas (nome_completo, nome_usuario, foto_perfil_url),
          profissionais (nome_completo, nome_usuario, foto_perfil_url),
          empresas (id, nome_fantasia, nome_usuario, foto_url)
        `
        )
        .in('id', precisaPerfil)

      if (!uErr && usuariosRows?.length) {
        for (const u of usuariosRows) {
          const d = pickAutorDisplay(u)
          const id = String(u.id)
          labels[id] = d.nome
          previews[id] = d.foto_perfil_url
        }
      }
    }

    const built = ordered
      .map((aid) => {
        const s = byAutor.get(aid)
        if (!s) return null
        const isVideo = String(s.tipo ?? '') === 'video'
        const avatarUrl = previews[aid] ?? null
        return {
          id: String(s.id),
          label: labels[aid] ?? 'Story',
          avatarUrl,
          isVideo,
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

  if (hidden) return null

  const meuVisto = foiVisualizado(meuSlot.visualizado_por, userEmail)
  const meuTemStory = Boolean(meuSlot.storyId)

  const abrirMeuStory = () => {
    if (meuSlot.storyId) onOpenStory(meuSlot.storyId)
    else router.push('/feed/story/criar')
  }

  return (
    <div className="border-b border-white/20 bg-transparent px-2 py-3">
      <div className="flex items-start gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Slot fixo estilo Instagram: foto do utilizador + criar story */}
        <div className="flex w-20 shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <div
              className={`rounded-none p-[3px] ${
                meuTemStory && meuVisto ? 'bg-gray-300' : !meuTemStory ? 'border-2 border-white/95 bg-white/10' : ''
              }`}
              style={meuTemStory && !meuVisto ? { background: GRADIENT } : undefined}
            >
              <div className="rounded-none bg-white p-[2px]">
                <button
                  type="button"
                  onClick={() => abrirMeuStory()}
                  className="relative block h-20 w-20 overflow-hidden rounded-none bg-gray-100"
                  aria-label={meuTemStory ? 'Ver seu story' : 'Criar story'}
                >
                  {meuSlot.avatarUrl ? (
                    <Image src={meuSlot.avatarUrl} alt="" fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-medium text-gray-400">
                      {(userEmail || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
              </div>
            </div>
            <Link
              href="/feed/story/criar"
              onClick={(e) => e.stopPropagation()}
              className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#0097b2] text-white shadow-md ring-2 ring-white"
              aria-label="Novo story"
            >
              <Plus size={16} strokeWidth={2.5} />
            </Link>
          </div>
          <span className="max-w-[5rem] truncate text-center text-xs text-white/95">Seu story</span>
        </div>

        {rings.map((s) => (
          <StoryCircle
            key={s.id}
            id={s.id}
            label={s.label}
            avatarUrl={s.avatarUrl}
            isVideo={s.isVideo}
            visualizado_por={s.visualizado_por}
            userEmail={userEmail}
            onOpen={onOpenStory}
            labelOnDark
          />
        ))}
      </div>
    </div>
  )
}
