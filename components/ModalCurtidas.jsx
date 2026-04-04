'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'

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
    /** @type {{ id: string, nome: string, username: string, foto: string | null, role: string, empresaId: string }[]} */ ([])
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
      const { data: likes, error: e1 } = await supabase.from('curtidas').select('usuario_id').eq('post_id', postId)
      if (e1 || !likes?.length) {
        if (e1) console.error('ModalCurtidas curtidas:', e1)
        setLista([])
        return
      }
      const ids = [...new Set(likes.map((r) => String(r.usuario_id)))]
      const { data: users, error: e2 } = await supabase.from('usuarios').select(USUARIOS_SELECT).in('id', ids)
      if (e2) {
        console.error('ModalCurtidas usuarios:', e2)
        setLista([])
        return
      }
      const linhas = (users ?? []).map((u) => {
        const a = pickAutorDisplay(u)
        const row = /** @type {{ id?: string }} */ (u)
        const id = row.id != null ? String(row.id) : ''
        return {
          id,
          nome: a.nome,
          username: a.username,
          foto: a.foto_perfil_url,
          role: a.role || 'user',
          empresaId: a.empresa_id || '',
        }
      })
      setLista(linhas)

      if (meuUsuarioId && ids.length) {
        const { data: rede } = await supabase
          .from('redecontatos')
          .select('seguido_id')
          .eq('seguidor_id', meuUsuarioId)
          .in('seguido_id', ids)
        const m = /** @type {Record<string, boolean>} */ ({})
        for (const r of rede ?? []) {
          m[String(r.seguido_id)] = true
        }
        const { data: favs } = await supabase
          .from('favoritos')
          .select('empresa_id')
          .eq('usuario_id', meuUsuarioId)
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
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[min(520px,85vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white text-black shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-bold text-gray-900">Curtidas</h3>
          <button type="button" onClick={onFechar} className="p-1 text-gray-700" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {carregando ? <p className="py-8 text-center text-sm text-gray-500">Carregando…</p> : null}
          {!carregando && lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhuma curtida ainda.</p> : null}
          {!carregando &&
            lista.map((u) => {
              const ehEu = meuUsuarioId && u.id === meuUsuarioId
              const seguindo = Boolean(seguindoMap[u.id])
              return (
                <div key={u.id} className="flex items-center justify-between gap-2 border-b border-gray-50 py-2 last:border-0">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {u.foto ? (
                        <AvatarImage src={u.foto} alt="" width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">?</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{u.nome}</p>
                      <p className="truncate text-xs text-gray-500">@{u.username}</p>
                    </div>
                  </div>
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
