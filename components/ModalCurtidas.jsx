'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarPerfisPorIds, getPerfilHref } from '@/lib/perfil-utils'
import { fetchVerificadoPorUsuarioIds } from '@/lib/contaVerificada'
import AvatarImage from '@/components/AvatarImage'
import NomeComVerificacao from '@/components/NomeComVerificacao'

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
  const [erroCarregar, setErroCarregar] = useState(false)
  const [seguindoMap, setSeguindoMap] = useState(/** @type {Record<string, boolean>} */ ({}))

  const carregar = useCallback(async () => {
    if (!postId) {
      setLista([])
      setErroCarregar(false)
      return
    }
    setCarregando(true)
    setErroCarregar(false)
    try {
      const { data: rows, error } = await supabase
        .from('curtidas')
        .select('id, usuario_id, created_at')
        .eq('post_id', postId)
        .is('comentario_id', null)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('ModalCurtidas curtidas:', error)
        setLista([])
        setErroCarregar(true)
        setSeguindoMap({})
        return
      }

      if (!rows?.length) {
        setLista([])
        setSeguindoMap({})
        return
      }

      const ordemIds = []
      const visto = new Set()
      for (const r of rows) {
        const id = r.usuario_id != null ? String(r.usuario_id) : ''
        if (id && !visto.has(id)) {
          visto.add(id)
          ordemIds.push(id)
        }
      }

      const perfis = await buscarPerfisPorIds(supabase, ordemIds)
      const verificadoPorUsuario = await fetchVerificadoPorUsuarioIds(supabase, ordemIds)
      const byUid = new Map(perfis.map((p) => [String(p.usuario_id), p]))

      const linhas = ordemIds.map((id) => {
        const p = byUid.get(id)
        const username = (p?.username ?? 'usuario').trim().replace(/^@+/, '') || 'usuario'
        const nome = (p?.nome ?? '').trim() || username
        const tipo = String(p?.tipo ?? '').toLowerCase()
        return {
          id,
          nome,
          username,
          foto: p?.foto_url != null && String(p.foto_url).trim() !== '' ? String(p.foto_url) : null,
          role: tipo || 'user',
          empresaId: p?.empresa_id != null ? String(p.empresa_id) : '',
          verificado: Boolean(verificadoPorUsuario.get(id)),
        }
      })

      if (linhas.length === 0 && ordemIds.length > 0) {
        console.warn('ModalCurtidas: curtidas sem perfil em perfis_para_busca para', ordemIds.length, 'usuários')
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
        const { data: favs } = await supabase
          .from('favoritos')
          .select('alvo_id')
          .eq('usuario_id', meuUsuarioId)
          .eq('alvo_tipo', 'empresa')
        const empUserIds = linhas.filter((l) => l.role === 'empresa' && l.id).map((l) => l.id)
        if (empUserIds.length && favs?.length) {
          const { data: emps } = await supabase.from('empresas').select('id, usuario_id').in('usuario_id', empUserIds)
          const favSet = new Set((favs ?? []).map((f) => String(f.alvo_id)))
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
        await supabase
          .from('favoritos')
          .delete()
          .eq('usuario_id', meuUsuarioId)
          .eq('alvo_id', alvo.empresaId)
          .eq('alvo_tipo', 'empresa')
      } else {
        await supabase.from('favoritos').insert({
          usuario_id: meuUsuarioId,
          alvo_id: alvo.empresaId,
          alvo_tipo: 'empresa',
        })
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
          {!carregando && erroCarregar ? (
            <p className="py-8 text-center text-sm text-gray-900">Não foi possível carregar as curtidas.</p>
          ) : null}
          {!carregando && !erroCarregar && lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-900">Nenhuma curtida ainda.</p>
          ) : null}
          {!carregando &&
            !erroCarregar &&
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        <NomeComVerificacao nome={u.nome} verificado={Boolean(u.verificado)} nomeClassName="truncate" />
                      </p>
                      <p className="truncate text-xs text-gray-500">@{u.username}</p>
                    </div>
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
