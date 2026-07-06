'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarPerfisSociaisPorIds, getPerfilHref } from '@/lib/perfil-utils'
import { fetchVerificadoPorUsuarioIds } from '@/lib/contaVerificada'
import { inserirRedeContato, removerRedeContato } from '@/lib/redeContatos'
import AvatarImage from '@/components/AvatarImage'
import NomeComVerificacao from '@/components/NomeComVerificacao'

function chaveCurtidaLista(usuarioId, empresaInteratorId) {
  const uid = String(usuarioId ?? '').trim()
  const emp = empresaInteratorId != null ? String(empresaInteratorId).trim() : ''
  return emp ? `${uid}:emp:${emp}` : `${uid}:prof`
}

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
    /** @type {{ chave: string, id: string, nome: string, username: string, foto: string | null, role: string, empresaId: string, verificado: boolean }[]} */ (
      []
    ),
  )
  const [carregando, setCarregando] = useState(false)
  const [erroCarregar, setErroCarregar] = useState(false)
  const [seguindoMap, setSeguindoMap] = useState(/** @type {Record<string, boolean>} */ ({}))
  const seguirBusyRef = useRef(false)

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
        .select('id, usuario_id, empresa_interator_id, created_at')
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

      /** @type {typeof rows} */
      const ordenadas = [...rows]
      /** @type {Map<string, (typeof rows)[0]>} */
      const porChave = new Map()
      for (const r of ordenadas) {
        const chave = chaveCurtidaLista(r.usuario_id, r.empresa_interator_id)
        if (!porChave.has(chave)) porChave.set(chave, r)
      }

      const entradas = [...porChave.values()]
      const usuarioIdsProf = [
        ...new Set(
          entradas
            .filter((r) => !(r.empresa_interator_id != null && String(r.empresa_interator_id).trim() !== ''))
            .map((r) => String(r.usuario_id ?? '').trim())
            .filter(Boolean),
        ),
      ]
      const empresaIds = [
        ...new Set(
          entradas
            .map((r) => (r.empresa_interator_id != null ? String(r.empresa_interator_id).trim() : ''))
            .filter(Boolean),
        ),
      ]

      const perfisSociais = await buscarPerfisSociaisPorIds(supabase, usuarioIdsProf)
      const verificadoPorUsuario = await fetchVerificadoPorUsuarioIds(supabase, usuarioIdsProf)
      const byUid = new Map(perfisSociais.map((p) => [String(p.usuario_id), p]))

      /** @type {Record<string, { nome: string, username: string, foto_url: string | null, verificado: boolean }>} */
      const empMap = {}
      if (empresaIds.length > 0) {
        const { data: empRows } = await supabase
          .from('empresas')
          .select('id, nome_fantasia, nome_usuario, foto_url, docs_verificado, status')
          .in('id', empresaIds)
        for (const raw of empRows ?? []) {
          const e = raw
          const id = String(e.id ?? '').trim()
          if (!id) continue
          empMap[id] = {
            nome:
              e.nome_fantasia != null && String(e.nome_fantasia).trim() !== ''
                ? String(e.nome_fantasia).trim()
                : 'Empresa',
            username:
              e.nome_usuario != null && String(e.nome_usuario).trim() !== ''
                ? String(e.nome_usuario).trim()
                : 'empresa',
            foto_url: e.foto_url != null && String(e.foto_url).trim() !== '' ? String(e.foto_url) : null,
            verificado: Boolean(e.docs_verificado) && String(e.status ?? '').toLowerCase() === 'aprovado',
          }
        }
      }

      const linhas = entradas.map((r) => {
        const uid = String(r.usuario_id ?? '').trim()
        const empId = r.empresa_interator_id != null ? String(r.empresa_interator_id).trim() : ''
        const chave = chaveCurtidaLista(uid, empId)

        if (empId && empMap[empId]) {
          const emp = empMap[empId]
          const username = emp.username.trim().replace(/^@+/, '') || 'empresa'
          return {
            chave,
            id: uid,
            nome: emp.nome,
            username,
            foto: emp.foto_url,
            role: 'empresa',
            empresaId: empId,
            verificado: emp.verificado,
          }
        }

        if (empId) {
          return {
            chave,
            id: uid,
            nome: 'Empresa',
            username: 'empresa',
            foto: null,
            role: 'empresa',
            empresaId: empId,
            verificado: false,
          }
        }

        const p = byUid.get(uid)
        const username = (p?.username ?? 'usuario').trim().replace(/^@+/, '') || 'usuario'
        const nome = (p?.nome ?? '').trim() || username
        return {
          chave,
          id: uid,
          nome,
          username,
          foto: p?.foto_url != null && String(p.foto_url).trim() !== '' ? String(p.foto_url) : null,
          role: p?.origem === 'profissionais' ? 'profissional' : 'turista',
          empresaId: '',
          verificado: Boolean(p?.verificadoProfissional ?? verificadoPorUsuario.get(uid)),
        }
      })

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
    if (!meuUsuarioId || alvo.id === meuUsuarioId || seguirBusyRef.current) return
    seguirBusyRef.current = true
    const ja = Boolean(seguindoMap[alvo.id])
    setSeguindoMap((prev) => ({ ...prev, [alvo.id]: !ja }))
    try {
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
      } else if (ja) {
        await removerRedeContato(supabase, meuUsuarioId, alvo.id)
      } else {
        const tipo = alvo.role === 'profissional' ? 'profissional' : 'turista'
        await inserirRedeContato(supabase, {
          seguidor_id: meuUsuarioId,
          seguido_id: alvo.id,
          seguido_tipo: tipo,
        })
      }
    } catch {
      setSeguindoMap((prev) => ({ ...prev, [alvo.id]: ja }))
    } finally {
      seguirBusyRef.current = false
    }
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
                <div key={u.chave} className="flex items-center justify-between gap-2 border-b border-gray-100 py-3 last:border-0">
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
                        <NomeComVerificacao
                          nome={u.nome}
                          verificado={Boolean(u.verificado)}
                          verificadoTipo={u.role === 'empresa' ? 'empresa' : 'profissional'}
                          nomeClassName="truncate"
                        />
                      </p>
                      <p className="truncate text-xs text-gray-500">@{u.username}</p>
                    </div>
                  </Link>
                  {!ehEu && meuUsuarioId && u.role !== 'empresa' ? (
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
