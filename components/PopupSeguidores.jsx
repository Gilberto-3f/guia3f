'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BotaoSeguir from '@/components/BotaoSeguir'
import { dedupePerfisPorUsuario, getPerfilHref } from '@/lib/perfil-utils'
import { listarUsuarioIdsSeguidoresEmpresa } from '@/lib/favoritosEmpresa'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { podeVerConteudoEmpresaPreviewApp } from '@/lib/modoApresentacaoVisibilidade'

/**
 * @param {{ isOpen: boolean, onClose: () => void, empresaId: string }} props
 */
export default function PopupSeguidores({ isOpen, onClose, empresaId }) {
  const { modoAtivo } = useModoApresentacao()
  const [seguidores, setSeguidores] = useState(
    /** @type {{ id: string, nome: string, username: string, foto_url: string | null, tipo?: string, empresa_id?: string | null }[]} */ ([])
  )
  const [loading, setLoading] = useState(true)
  const [meuId, setMeuId] = useState(/** @type {string | null} */ (null))
  const [seguindoMap, setSeguindoMap] = useState(/** @type {Record<string, boolean>} */ ({}))

  const seguindoSet = useMemo(() => {
    const s = new Set()
    for (const [k, v] of Object.entries(seguindoMap)) if (v) s.add(k)
    return s
  }, [seguindoMap])

  useEffect(() => {
    if (!isOpen || !empresaId) return

    let ativo = true

    const carregar = async () => {
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const uid = session?.user?.id ?? null
        const emailSessao = session?.user?.email ?? null
        const podeVerPreview = podeVerConteudoEmpresaPreviewApp(emailSessao, modoAtivo)
        if (ativo) setMeuId(uid)

        let ids = []
        try {
          ids = await listarUsuarioIdsSeguidoresEmpresa(supabase, empresaId)
        } catch (err) {
          console.error('listar seguidores empresa:', err)
          if (ativo) setSeguidores([])
          return
        }
        if (ids.length === 0) {
          if (ativo) setSeguidores([])
          return
        }

        const [meusSegRes, previewRes, perfisRes, usuariosRes] = await Promise.all([
          uid
            ? supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', uid).in('seguido_id', ids)
            : Promise.resolve({ data: [], error: null }),
          !modoAtivo
            ? supabase
                .from('empresas')
                .select('usuario_id')
                .in('usuario_id', ids)
                .eq('somente_modo_apresentacao', true)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('perfis_para_busca')
            .select('usuario_id, empresa_id, username, nome, foto_url, tipo')
            .in('usuario_id', ids),
          supabase.from('usuarios').select('id, email').in('id', ids),
        ])

        if (uid && ativo) {
          const m = /** @type {Record<string, boolean>} */ ({})
          for (const r of meusSegRes.data ?? []) m[String(r.seguido_id)] = true
          setSeguindoMap(m)
        } else if (ativo) {
          setSeguindoMap({})
        }

        /** Fora do modo apresentação: não misturar empresa demo no nome/avatar (preferir turista no dedupe). */
        /** @type {Map<string, string | null>} */
        const preferTipoPorUsuarioId = new Map()
        for (const row of previewRes.data ?? []) {
          const u = row?.usuario_id != null ? String(row.usuario_id).trim() : ''
          if (u) preferTipoPorUsuarioId.set(u, 'turista')
        }

        if (perfisRes.error) console.error('perfis_para_busca (seguidores empresa):', perfisRes.error)

        const perfisDedup = dedupePerfisPorUsuario(perfisRes.data ?? [], preferTipoPorUsuarioId)
        const porUsuario = new Map(perfisDedup.map((p) => [String(p.usuario_id), p]))

        const usuarios = usuariosRes.data

        let lista = ids.map((id) => {
          const p = porUsuario.get(id)
          if (p) {
            return {
              id,
              nome: String(p.nome ?? 'Usuário'),
              username: String(p.username ?? 'usuario'),
              foto_url: p.foto_url != null ? String(p.foto_url) : null,
              tipo: p.tipo != null ? String(p.tipo) : undefined,
              empresa_id: p.empresa_id != null ? String(p.empresa_id) : null,
            }
          }
          const u = usuarios?.find((x) => x.id === id)
          const email = u?.email ?? ''
          return {
            id,
            nome: email ? email.split('@')[0] : 'Usuário',
            username: email ? email.split('@')[0] : 'usuario',
            foto_url: null,
            tipo: undefined,
            empresa_id: null,
          }
        })

        /** Ainda “empresa” após dedupe (só preview na view): forçar nome/@ de turista ou profissional se existir (só fora do modo apresentação). */
        const previewUids = new Set([...preferTipoPorUsuarioId.keys()])
        const aindaEmpresa =
          !podeVerPreview && previewUids.size > 0
            ? lista.filter((row) => previewUids.has(row.id) && String(row.tipo ?? '').toLowerCase() === 'empresa')
            : []
        if (aindaEmpresa.length > 0) {
          const uids = aindaEmpresa.map((r) => r.id)
          const [{ data: turRows }, { data: profRows }] = await Promise.all([
            supabase.from('turistas').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url').in('usuario_id', uids),
            supabase.from('profissionais').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url').in('usuario_id', uids),
          ])
          const socialById = new Map()
          for (const t of turRows ?? []) {
            const uid = t?.usuario_id != null ? String(t.usuario_id) : ''
            if (!uid) continue
            socialById.set(uid, {
              nome: t.nome_completo != null ? String(t.nome_completo) : '',
              username: t.nome_usuario != null ? String(t.nome_usuario) : '',
              foto: t.foto_perfil_url != null ? String(t.foto_perfil_url) : null,
            })
          }
          for (const p of profRows ?? []) {
            const uid = p?.usuario_id != null ? String(p.usuario_id) : ''
            if (!uid || socialById.has(uid)) continue
            socialById.set(uid, {
              nome: p.nome_completo != null ? String(p.nome_completo) : '',
              username: p.nome_usuario != null ? String(p.nome_usuario) : '',
              foto: p.foto_perfil_url != null ? String(p.foto_perfil_url) : null,
            })
          }
          lista = lista.map((row) => {
            if (!previewUids.has(row.id) || String(row.tipo ?? '').toLowerCase() !== 'empresa') return row
            const s = socialById.get(row.id)
            if (!s || (!s.username && !s.nome)) return row
            return {
              ...row,
              nome: s.nome.trim() !== '' ? s.nome : row.nome,
              username: s.username.trim() !== '' ? s.username : row.username,
              foto_url: s.foto ?? row.foto_url,
              tipo: 'turista',
              empresa_id: null,
            }
          })
        }

        if (ativo) setSeguidores(lista)
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [isOpen, empresaId, modoAtivo])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-gray-900 shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <User className="h-5 w-5 text-[#0097b2]" aria-hidden />
            <h2 className="text-xl font-bold text-[#0097b2]">SEGUIDORES</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1 text-gray-700 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        <div className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Carregando...</div>
          ) : seguidores.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">Nenhum seguidor ainda</div>
          ) : (
            <div className="space-y-1">
              {seguidores.map((seguidor) => (
                <div
                  key={seguidor.id}
                  className="flex items-center gap-3 rounded-lg border-b border-gray-100 py-2 last:border-0"
                >
                  <Link
                    href={getPerfilHref({
                      usuario_id: seguidor.id,
                      tipo: seguidor.tipo,
                      role: seguidor.tipo,
                      empresa_id: seguidor.empresa_id,
                    })}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:bg-gray-50"
                  >
                    {seguidor.foto_url ? (
                      <Image
                        src={seguidor.foto_url}
                        alt={seguidor.nome}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                        <User size={20} className="text-gray-500" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{seguidor.nome}</p>
                      <p className="truncate text-sm text-gray-500">@{seguidor.username}</p>
                    </div>
                  </Link>
                  {meuId && seguidor.id !== meuId ? (
                    <BotaoSeguir
                      alvoId={seguidor.id}
                      alvoTipo="usuario"
                      isFollowing={seguindoSet.has(String(seguidor.id))}
                      layout="inline"
                      size="compact"
                      leadingIcon="none"
                      showInlineError={false}
                      onToggle={(novo) => {
                        setSeguindoMap((prev) => ({ ...prev, [String(seguidor.id)]: Boolean(novo) }))
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
