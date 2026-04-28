'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { getPerfilHref } from '@/lib/perfil-utils'
import AvatarImage from '@/components/AvatarImage'

/** Ordem: tenta relação padrão; se o PostgREST falhar, use variante com FK explícita. */
const CURTIDAS_SELECT_VARIANTS = [
  `
  id,
  usuario_id,
  created_at,
  usuarios (
    id,
    email,
    role,
    turistas (nome_completo, nome_usuario, foto_perfil_url),
    profissionais (nome_completo, nome_usuario, foto_perfil_url),
    empresas (id, nome_fantasia, nome_usuario, foto_url)
  )
`,
  `
  id,
  usuario_id,
  created_at,
  usuarios!curtidas_usuario_id_fkey (
    id,
    email,
    role,
    turistas (nome_completo, nome_usuario, foto_perfil_url),
    profissionais (nome_completo, nome_usuario, foto_perfil_url),
    empresas (id, nome_fantasia, nome_usuario, foto_url)
  )
`,
]

const USUARIOS_SELECT = `
  id,
  email,
  role,
  turistas (nome_completo, nome_usuario, foto_perfil_url),
  profissionais (nome_completo, nome_usuario, foto_perfil_url),
  empresas (id, nome_fantasia, nome_usuario, foto_url)
`

/**
 * @param {{
 *   postId: string | null
 *   aberto: boolean
 *   onFechar: () => void
 *   meuUsuarioId: string | null
 * }} props
 */
export default function ModalCurtidas({ postId, aberto, onFechar, meuUsuarioId }) {
  const [lista, setLista] = useState(
    /** @type {{ id: string, username: string, foto: string | null, role: string, empresaId: string }[]} */ ([])
  )
  const [carregando, setCarregando] = useState(false)
  const [seguindoMap, setSeguindoMap] = useState(/** @type {Record<string, boolean>} */ ({}))

  const carregar = useCallback(async () => {
    if (!postId) {
      setLista([])
      return
    }
    setCarregando(true)
    try {
      let rows = /** @type {Record<string, unknown>[] | null} */ (null)
      for (const sel of CURTIDAS_SELECT_VARIANTS) {
        const res = await supabase
          .from('curtidas')
          .select(sel)
          .eq('post_id', postId)
          .is('comentario_id', null)
          .order('created_at', { ascending: false })
        if (!res.error && res.data) {
          rows = /** @type {Record<string, unknown>[]} */ (res.data)
          break
        }
        if (res.error) console.warn('ModalCurtidas select:', res.error.message, res.error)
      }

      if (!rows) {
        console.error('ModalCurtidas: nenhuma variante de select em curtidas funcionou')
        setLista([])
        setSeguindoMap({})
        return
      }

      if (rows.length === 0) {
        setLista([])
        setSeguindoMap({})
        return
      }

      /** Preserva ordem da query (mais recente primeiro): um usuário por linha (índice único post+user). */
      const ordemIds = []
      const visto = new Set()
      const faltando = new Set()
      /** @type {Map<string, { id: string, username: string, foto: string | null, role: string, empresaId: string }>} */
      const byId = new Map()

      for (const raw of rows) {
        const r = /** @type {Record<string, unknown>} */ (raw)
        const uidRaw = r.usuario_id != null ? String(r.usuario_id) : ''
        const emb = r.usuarios
        const u = Array.isArray(emb) ? emb[0] : emb
        if (u && typeof u === 'object') {
          const a = pickAutorDisplay(u)
          const row = /** @type {{ id?: string }} */ (u)
          const id = row.id != null ? String(row.id) : ''
          if (id) {
            if (!visto.has(id)) {
              visto.add(id)
              ordemIds.push(id)
            }
            byId.set(id, {
              id,
              username: a.username,
              foto: a.foto_perfil_url,
              role: a.role || 'user',
              empresaId: a.empresa_id || '',
            })
          }
        } else if (uidRaw) {
          faltando.add(uidRaw)
          if (!visto.has(uidRaw)) {
            visto.add(uidRaw)
            ordemIds.push(uidRaw)
          }
        }
      }

      if (faltando.size > 0) {
        const ids = [...faltando]
        const { data: users, error: e2 } = await supabase.from('usuarios').select(USUARIOS_SELECT).in('id', ids)
        if (e2) console.error('ModalCurtidas usuarios fallback:', e2)
        for (const u of users ?? []) {
          const a = pickAutorDisplay(u)
          const row = /** @type {{ id?: string }} */ (u)
          const id = row.id != null ? String(row.id) : ''
          if (id) {
            byId.set(id, {
              id,
              username: a.username,
              foto: a.foto_perfil_url,
              role: a.role || 'user',
              empresaId: a.empresa_id || '',
            })
          }
        }
      }

      const linhas = ordemIds.map((id) => byId.get(id)).filter((l) => l != null && l.id)
      if (linhas.length === 0 && rows.length > 0) {
        console.warn(
          'ModalCurtidas: curtidas retornaram linhas mas nenhum usuário resolvido (embed usuarios vazio e fallback falhou?). Verifique RLS em usuarios/turistas/profissionais e FK usuario_id.'
        )
      }
      setLista(linhas)

      if (meuUsuarioId && linhas.length) {
        const idList = linhas.map((l) => l.id)
        const { data: rede } = await supabase
          .from('redecontatos')
          .select('seguido_id')
          .eq('seguidor_id', meuUsuarioId)
          .in('seguido_id', idList)
        const m = /** @type {Record<string, boolean>} */ ({})
        for (const r of rede ?? []) {
          m[String(r.seguido_id)] = true
        }
        const { data: favs } = await supabase.from('favoritos').select('empresa_id').eq('usuario_id', meuUsuarioId)
        const empUserIds = linhas.filter((l) => l.role === 'empresa' && l.id).map((l) => l.id)
        if (empUserIds.length && favs?.length) {
          const { data: emps } = await supabase.from('empresas').select('id, usuario_id').in('usuario_id', empUserIds)
          const favSet = new Set((favs ?? []).map((f) => String(f.empresa_id)))
          for (const e of emps ?? []) {
            if (favSet.has(String(e.id))) m[String(e.usuario_id)] = true
          }
        }
        setSeguindoMap(m)
      } else {
        setSeguindoMap({})
      }
    } finally {
      setCarregando(false)
    }
  }, [postId, meuUsuarioId])

  useEffect(() => {
    if (!aberto || !postId) return
    void carregar()
  }, [aberto, postId, carregar])

  const toggleSeguir = async (alvo) => {
    if (!meuUsuarioId || alvo.id === meuUsuarioId) return
    const ja = Boolean(seguindoMap[alvo.id])
    if (alvo.role === 'empresa' && alvo.empresaId) {
      if (ja) {
        await supabase.from('favoritos').delete().eq('usuario_id', meuUsuarioId).eq('empresa_id', alvo.empresaId)
      } else {
        await supabase.from('favoritos').insert({ usuario_id: meuUsuarioId, empresa_id: alvo.empresaId })
      }
    } else {
      if (ja) {
        await supabase.from('redecontatos').delete().eq('seguidor_id', meuUsuarioId).eq('seguido_id', alvo.id)
      } else {
        const tipo = alvo.role === 'profissional' ? 'profissional' : 'turista'
        await supabase.from('redecontatos').insert({ seguidor_id: meuUsuarioId, seguido_id: alvo.id, seguido_tipo: tipo })
      }
    }
    setSeguindoMap((prev) => ({ ...prev, [alvo.id]: !ja }))
  }

  if (!aberto || !postId) return null

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-bold text-black">Curtidas</h3>
          <button type="button" onClick={onFechar} className="p-1 text-black" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 text-black">
          {carregando ? <p className="py-8 text-center text-sm text-gray-900">Carregando…</p> : null}
          {!carregando && lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-900">Nenhuma curtida ainda.</p>
          ) : null}
          {!carregando &&
            lista.map((u) => {
              const ehEu = meuUsuarioId && u.id === meuUsuarioId
              const seguindo = Boolean(seguindoMap[u.id])
              const hrefPerfil = getPerfilHref({
                usuario_id: u.id,
                role: u.role,
                empresa_id: u.empresaId || null,
              })
              return (
                <div key={u.id} className="flex items-center justify-between gap-2 border-b border-gray-100 py-3 last:border-0">
                  <Link
                    href={hrefPerfil}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 hover:bg-gray-50"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {u.foto ? (
                        <AvatarImage src={u.foto} alt="" width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">?</div>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold text-gray-900">@{u.username}</p>
                  </Link>
                  {!ehEu && meuUsuarioId ? (
                    <button
                      type="button"
                      onClick={() => void toggleSeguir(u)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        seguindo ? 'border border-gray-200 bg-gray-100 text-gray-700' : 'bg-[#0097b2] text-white'
                      }`}
                    >
                      {seguindo ? 'Seguindo' : 'Seguir'}
                    </button>
                  ) : null}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
