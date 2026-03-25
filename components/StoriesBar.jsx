'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import StoryCircle from '@/components/StoryCircle'

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
 * @param {{
 *   hidden?: boolean
 *   userEmail: string | null
 *   onOpenStory: (id: string) => void
 * }} props
 */
export default function StoriesBar({ hidden = false, userEmail, onOpenStory }) {
  /** @type {{ id: string, label: string, previewUrl: string | null, isVideo: boolean, visualizado_por: unknown }[]} */
  const [rings, setRings] = useState([])

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) {
      setRings([])
      return
    }

    const uid = session.user.id

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

    const { data: storiesRows } = await supabase
      .from('stories')
      .select('id, autor_id, conteudo_url, visualizado_por, created_at, tipo')
      .gt('expira_em', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(80)

    const byAutor = /** @type {Map<string, typeof storiesRows[0]>} */ (new Map())
    for (const s of storiesRows ?? []) {
      const aid = String(s.autor_id)
      if (!byAutor.has(aid)) byAutor.set(aid, s)
    }

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

    const ordemIds = intercalar(
      autorSeguidos.filter((a) => byAutor.has(a)),
      obrAutor && byAutor.has(obrAutor) ? obrAutor : autorSeguidos.find((a) => byAutor.has(a)) ?? null,
      12
    )

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

    const built = ordemIds
      .map((aid) => {
        const s = byAutor.get(aid)
        if (!s) return null
        const url = s.conteudo_url != null ? String(s.conteudo_url) : null
        const isVideo = String(s.tipo ?? '') === 'video'
        const previewUrl = isVideo
          ? url
          : url && url.match(/\.(jpg|jpeg|png|webp|gif)/i)
            ? url
            : previews[aid] ?? null
        return {
          id: String(s.id),
          label: labels[aid] ?? 'Story',
          previewUrl,
          isVideo,
          visualizado_por: s.visualizado_por,
        }
      })
      .filter(Boolean)

    setRings(/** @type {NonNullable<(typeof built)[0]>[]} */ (built))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (hidden) return null

  return (
    <div className="border-b border-gray-100 bg-white px-2 py-3">
      <div className="flex items-start gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/feed/story/criar"
          className="flex w-16 shrink-0 flex-col items-center gap-1 text-[#0097b2]"
          aria-label="Criar story"
        >
          <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 border-dashed border-[#0097b2] bg-[#0097b2]/5">
            <Plus size={28} strokeWidth={2.5} />
          </div>
          <span className="text-[10px]">Novo</span>
        </Link>
        {rings.map((s) => (
          <StoryCircle
            key={s.id}
            id={s.id}
            label={s.label}
            previewUrl={s.previewUrl}
            isVideo={s.isVideo}
            visualizado_por={s.visualizado_por}
            userEmail={userEmail}
            onOpen={onOpenStory}
          />
        ))}
      </div>
    </div>
  )
}
