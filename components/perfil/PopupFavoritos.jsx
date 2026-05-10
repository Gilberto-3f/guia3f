'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BotaoSeguir from '@/components/BotaoSeguir'
import { buscarPerfisSociaisPorIds, getPerfilHref } from '@/lib/perfil-utils'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   meuId: string | null
 * }} props
 */
export default function PopupFavoritos({ aberto, onFechar, profileId, meuId }) {
  useModalScrollLock(aberto)
  const [aba, setAba] = useState(/** @type {'empresas' | 'usuarios'} */ ('empresas'))
  const [emps, setEmps] = useState(
    /** @type {{ usuario_id: string; empresa_id: string | null; nome: string; username: string; foto_url: string | null }[]} */ ([])
  )
  const [users, setUsers] = useState(
    /** @type {{ usuario_id: string; empresa_id: string | null; tipo: string; nome: string; username: string; foto_url: string | null; jaSigo: boolean }[]} */ (
      []
    )
  )
  const [confirmUser, setConfirmUser] = useState(/** @type {string | null} */ (null))
  const [meuFavEmpresaIds, setMeuFavEmpresaIds] = useState(/** @type {Set<string>} */ (new Set()))
  /** Contagem alinhada à query `favoritos` (linhas com `alvo_tipo = empresa`), não só linhas com perfil em `perfis_para_busca`. */
  const [countEmpresasFavoritas, setCountEmpresasFavoritas] = useState(0)

  const souEu = meuId != null && meuId === profileId

  const carregar = useCallback(async () => {
    const { data: fav, error: errFav } = await supabase
      .from('favoritos')
      .select('alvo_id')
      .eq('usuario_id', profileId)
      .eq('alvo_tipo', 'empresa')
    if (errFav) console.error('Favoritos (empresas):', errFav)

    const empresaIds = [...new Set((fav ?? []).map((r) => String(r.alvo_id)).filter(Boolean))]
    setCountEmpresasFavoritas(empresaIds.length)
    if (empresaIds.length === 0) {
      setEmps([])
      setMeuFavEmpresaIds(new Set())
    } else {
      const { data: perfisEmp, error: errPE } = await supabase
        .from('perfis_para_busca')
        .select('usuario_id, empresa_id, username, nome, foto_url, tipo')
        .eq('tipo', 'empresa')
        .in('empresa_id', empresaIds)

      if (errPE) console.error('perfis_para_busca (favoritos empresas):', errPE)

      /** @type {Map<string, PerfilBuscaRow>} */
      const porEmpresa = new Map()
      for (const r of /** @type {PerfilBuscaRow[]} */ (perfisEmp ?? [])) {
        const eid = r.empresa_id != null ? String(r.empresa_id) : ''
        if (!eid) continue
        const cur = porEmpresa.get(eid)
        if (!cur) porEmpresa.set(eid, r)
        else if (String(r.username ?? '') < String(cur.username ?? '')) porEmpresa.set(eid, r)
      }

      /** Uma linha por `alvo_id` em favoritos; fallback se `perfis_para_busca` não devolver linha (RLS, atraso). */
      setEmps(
        empresaIds.map((eid) => {
          const p = porEmpresa.get(eid)
          if (p) {
            return {
              usuario_id: String(p.usuario_id ?? ''),
              empresa_id: p.empresa_id != null ? String(p.empresa_id) : null,
              nome: String(p.nome ?? 'Empresa'),
              username: String(p.username ?? 'empresa'),
              foto_url: p.foto_url != null ? String(p.foto_url) : null,
            }
          }
          return {
            usuario_id: '',
            empresa_id: eid,
            nome: 'Empresa',
            username: 'empresa',
            foto_url: null,
          }
        })
      )

      if (meuId && empresaIds.length > 0) {
        const { data: meusFav, error: errMF } = await supabase
          .from('favoritos')
          .select('alvo_id')
          .eq('usuario_id', meuId)
          .eq('alvo_tipo', 'empresa')
          .in('alvo_id', empresaIds)
        if (errMF) console.error('favoritos (visitante):', errMF)
        setMeuFavEmpresaIds(new Set((meusFav ?? []).map((r) => String(r.alvo_id)).filter(Boolean)))
      } else {
        setMeuFavEmpresaIds(new Set())
      }
    }

    const { data: seg, error: errSeg } = await supabase
      .from('redecontatos')
      .select('seguido_id, seguido_tipo')
      .eq('seguidor_id', profileId)

    if (errSeg) console.error('redecontatos (favoritos usuários):', errSeg)

    const ids = [...new Set((seg ?? []).map((s) => String(s.seguido_id)).filter(Boolean))]
    if (ids.length === 0) {
      setUsers([])
    } else {
      const perfis = await buscarPerfisSociaisPorIds(supabase, ids)

      /** @type {Set<string>} */
      let minhas = new Set()
      if (meuId) {
        const { data: meus, error: errM } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', meuId)
        if (errM) console.error('redecontatos (meu seguindo):', errM)
        minhas = new Set((meus ?? []).map((m) => String(m.seguido_id)))
      }

      setUsers(
        perfis.map((p) => ({
          usuario_id: String(p.usuario_id ?? ''),
          empresa_id: null,
          tipo: 'usuario',
          nome: String(p.nome ?? 'Usuário'),
          username: String(p.username ?? 'usuario'),
          foto_url: p.foto_url != null ? String(p.foto_url) : null,
          jaSigo: minhas.has(String(p.usuario_id ?? '')),
        }))
      )
    }
  }, [profileId, meuId])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto, carregar])

  const deixarUsuario = async (seguidoId) => {
    if (!souEu || !meuId) return
    await supabase.from('redecontatos').delete().eq('seguidor_id', meuId).eq('seguido_id', seguidoId)
    setConfirmUser(null)
    void carregar()
  }

  if (!aberto) return null

  const lista = aba === 'empresas' ? emps : users

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onFechar} role="presentation">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Heart className="h-5 w-5 text-[#0097b2]" />
            <h2 className="text-xl font-bold text-[#0097b2]">FAVORITOS</h2>
          </div>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <div className="flex shrink-0 justify-center gap-4 border-b px-4 pb-2">
          <button
            type="button"
            onClick={() => setAba('empresas')}
            className={`flex-1 py-2 text-center text-sm ${aba === 'empresas' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'}`}
          >
            EMPRESAS ({countEmpresasFavoritas})
          </button>
          <button
            type="button"
            onClick={() => setAba('usuarios')}
            className={`flex-1 py-2 text-center text-sm ${aba === 'usuarios' ? 'border-b-2 border-[#0097b2] font-semibold text-[#0097b2]' : 'text-gray-500'}`}
          >
            USUÁRIOS ({users.length})
          </button>
        </div>

        <div className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado</p> : null}
      {aba === 'empresas'
        ? emps.map((row) => {
            const href = getPerfilHref({ ...row, tipo: 'empresa' })
            const eid = row.empresa_id ? String(row.empresa_id) : ''
                const jaFavVisitante = eid ? meuFavEmpresaIds.has(eid) : false
                return (
                  <div key={eid || row.usuario_id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 hover:bg-gray-50">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                        {row.foto_url ? <Image src={row.foto_url} alt="" fill className="object-cover" sizes="40px" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">{row.nome}</p>
                        <p className="truncate text-xs text-gray-500">@{row.username}</p>
                      </div>
                    </Link>
                    {meuId && eid ? (
                      <BotaoSeguir
                        empresaId={eid}
                        isFollowing={souEu ? true : jaFavVisitante}
                        layout="inline"
                        size="compact"
                        leadingIcon="none"
                        showInlineError={false}
                        onToggle={() => void carregar()}
                      />
                    ) : null}
                  </div>
                )
              })
            : users.map((row) => {
                const href = getPerfilHref(row)
                return (
                  <div key={row.usuario_id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 hover:bg-gray-50">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                        {row.foto_url ? <Image src={row.foto_url} alt="" fill className="object-cover" sizes="40px" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-800">{row.nome}</p>
                        <p className="truncate text-xs text-gray-500">@{row.username}</p>
                      </div>
                    </Link>
                    {meuId && row.usuario_id !== meuId ? (
                      <BotaoSeguir
                        alvoId={row.usuario_id}
                        alvoTipo="usuario"
                        seguidoTipo={row.tipo}
                        isFollowing={Boolean(row.jaSigo)}
                        layout="inline"
                        size="compact"
                        leadingIcon="none"
                        showInlineError={false}
                        onToggle={() => void carregar()}
                      />
                    ) : null}
                  </div>
                )
              })}
        </div>
      </div>

      {confirmUser ? (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-xl">
            <p className="text-sm text-gray-700">Deixar de seguir este usuário?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="text-sm text-gray-600" onClick={() => setConfirmUser(null)}>
                Cancelar
              </button>
              <button type="button" className="text-sm font-medium text-red-600" onClick={() => void deixarUsuario(confirmUser)}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
