'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BotaoSeguir from '@/components/BotaoSeguir'
import NomeComVerificacao from '@/components/NomeComVerificacao'
import { buscarPerfisSociaisPorIds, getPerfilHref } from '@/lib/perfil-utils'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   meuId: string | null
 *   onMetricasAlteradas?: () => void
 * }} props
 */
export default function PopupFavoritos({ aberto, onFechar, profileId, meuId, onMetricasAlteradas }) {
  useModalScrollLock(aberto)
  const [users, setUsers] = useState(
    /** @type {{ usuario_id: string; empresa_id: string | null; tipo: string; nome: string; username: string; foto_url: string | null; jaSigo: boolean; verificadoProfissional?: boolean }[]} */ (
      []
    )
  )
  const [confirmUser, setConfirmUser] = useState(/** @type {string | null} */ (null))
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false)

  const souEu = meuId != null && meuId === profileId

  const carregarUsuarios = useCallback(async () => {
    setCarregandoUsuarios(true)
    try {
      const { data: seg, error: errSeg } = await supabase
        .from('redecontatos')
        .select('seguido_id, seguido_tipo')
        .eq('seguidor_id', profileId)

      if (errSeg) console.error('redecontatos (favoritos usuários):', errSeg)

      const ids = [...new Set((seg ?? []).map((s) => String(s.seguido_id)).filter(Boolean))]
      if (ids.length === 0) {
        setUsers([])
        return
      }

      const [perfis, meusRes] = await Promise.all([
        buscarPerfisSociaisPorIds(supabase, ids),
        meuId
          ? supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', meuId).in('seguido_id', ids)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (meusRes.error) console.error('redecontatos (meu seguindo):', meusRes.error)
      const minhas = new Set((meusRes.data ?? []).map((m) => String(m.seguido_id)))

      setUsers(
        perfis.map((p) => ({
          usuario_id: String(p.usuario_id ?? ''),
          empresa_id: null,
          tipo: 'usuario',
          nome: String(p.nome ?? 'Usuário'),
          username: String(p.username ?? 'usuario'),
          foto_url: p.foto_url != null ? String(p.foto_url) : null,
          jaSigo: minhas.has(String(p.usuario_id ?? '')),
          verificadoProfissional: Boolean(p.verificadoProfissional),
        }))
      )
    } finally {
      setCarregandoUsuarios(false)
    }
  }, [profileId, meuId])

  const carregar = useCallback(async () => {
    await carregarUsuarios()
    if (meuId != null && meuId === profileId) {
      onMetricasAlteradas?.()
    }
  }, [carregarUsuarios, meuId, profileId, onMetricasAlteradas])

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
            <h2 className="text-xl font-bold text-[#0097b2]">SEGUINDO</h2>
          </div>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <div className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {carregandoUsuarios ? (
            <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Nenhum usuário seguido</p>
          ) : (
            users.map((row) => {
              const href = getPerfilHref(row)
              return (
                <div key={row.usuario_id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
                  <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 hover:bg-gray-50">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                      {row.foto_url ? <Image src={row.foto_url} alt="" fill className="object-cover" sizes="40px" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{row.nome}</p>
                      <p className="truncate text-xs text-gray-500">
                        <NomeComVerificacao
                          nome={`@${row.username}`}
                          verificado={Boolean(row.verificadoProfissional)}
                          verificadoTipo="profissional"
                          nomeClassName="truncate"
                        />
                      </p>
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
                      onToggle={() => void carregarUsuarios()}
                    />
                  ) : null}
                </div>
              )
            })
          )}
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
