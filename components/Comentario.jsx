'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarDataComentarioCurta } from '@/lib/formatarDataPublicacao'
import AvatarImage from '@/components/AvatarImage'

/**
 * @typedef {{
 *   id: string
 *   texto: string
 *   created_at: string
 *   total_curtidas: number
 *   autor: { nome: string, username: string, foto_perfil_url: string | null, usuario_id?: string }
 *   replies: ComentarioNode[]
 * }} ComentarioNode
 */

/**
 * @param {{
 *   node: ComentarioNode
 *   usuarioId: string | null
 *   destacarComentarioId?: string | null
 *   onEnviarResposta?: (parentId: string, texto: string) => Promise<void>
 *   onExcluir?: (commentId: string) => Promise<void>
 *   nivel?: number
 *   enviando?: boolean
 * }} props
 */
export default function Comentario({
  node,
  usuarioId,
  destacarComentarioId = null,
  onEnviarResposta,
  onExcluir,
  nivel = 0,
  enviando = false,
}) {
  const [curtiu, setCurtiu] = useState(false)
  const [total, setTotal] = useState(node.total_curtidas ?? 0)
  const [modoResposta, setModoResposta] = useState(false)
  const [textoResposta, setTextoResposta] = useState('')
  const [mostrarRespostas, setMostrarRespostas] = useState(true)
  const [removendo, setRemovendo] = useState(false)

  const respostas = node.replies ?? []
  const destacado = Boolean(destacarComentarioId && node.id === destacarComentarioId)

  useEffect(() => {
    setTotal(node.total_curtidas ?? 0)
  }, [node.total_curtidas])

  useEffect(() => {
    if (!usuarioId) return
    const check = async () => {
      const { data } = await supabase
        .from('curtidas')
        .select('id')
        .eq('comentario_id', node.id)
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      setCurtiu(Boolean(data))
    }
    void check()
  }, [node.id, usuarioId])

  const toggle = async () => {
    if (!usuarioId) return
    if (curtiu) {
      await supabase.from('curtidas').delete().eq('comentario_id', node.id).eq('usuario_id', usuarioId)
      setCurtiu(false)
      setTotal((t) => Math.max(0, t - 1))
    } else {
      const { error } = await supabase.from('curtidas').insert({ comentario_id: node.id, usuario_id: usuarioId })
      if (error) return
      setCurtiu(true)
      setTotal((t) => t + 1)
    }
  }

  const enviarRespostaInline = async () => {
    const t = textoResposta.trim()
    if (!t || !usuarioId || !onEnviarResposta) return
    await onEnviarResposta(node.id, t)
    setTextoResposta('')
    setModoResposta(false)
  }

  const tempo = formatarDataComentarioCurta(node.created_at)
  const uname = node.autor?.username ?? 'usuario'
  const avatar = node.autor?.foto_perfil_url
  const perfilHref = node.autor?.usuario_id ? `/perfil/${node.autor.usuario_id}` : null
  const avatarInner = avatar ? (
    <AvatarImage src={avatar} alt="" width={32} height={32} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">?</div>
  )

  const ehRaiz = nivel === 0
  const ehMeuComentario =
    Boolean(usuarioId && node.autor?.usuario_id && String(node.autor.usuario_id) === String(usuarioId))

  const handleExcluir = async () => {
    if (!onExcluir || !ehMeuComentario) return
    if (!window.confirm('Excluir este comentário?')) return
    setRemovendo(true)
    try {
      await onExcluir(node.id)
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <div
      id={`comentario-${node.id}`}
      className={ehRaiz ? 'border-b border-gray-100 py-3 last:border-b-0' : 'mt-2'}
    >
      <div className={`flex min-w-0 gap-2 ${!ehRaiz ? 'ml-8' : ''}`}>
        {perfilHref ? (
          <Link href={perfilHref} className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">
            {avatarInner}
          </Link>
        ) : (
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">{avatarInner}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
            {perfilHref ? (
              <Link href={perfilHref} className="text-sm font-semibold text-gray-900 hover:text-[#0097b2]">
                @{uname}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-gray-900">@{uname}</span>
            )}
            <span className="text-xs text-gray-400">· {tempo}</span>
          </div>
          <p
            className={`mt-0.5 max-w-full whitespace-pre-wrap break-words text-sm text-gray-800 [overflow-wrap:anywhere] ${destacado ? 'font-bold' : ''}`}
          >
            {node.texto}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {onEnviarResposta && usuarioId ? (
              <button
                type="button"
                onClick={() => setModoResposta((v) => !v)}
                className="text-xs font-semibold text-gray-500 hover:text-[#0097b2]"
              >
                Responder
              </button>
            ) : null}
            {ehMeuComentario && onExcluir ? (
              <button
                type="button"
                onClick={() => void handleExcluir()}
                disabled={removendo || enviando}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-500 hover:text-[#0097b2] disabled:opacity-40"
                aria-label="Excluir comentário"
              >
                <Trash2 size={14} className="shrink-0" aria-hidden />
                Excluir
              </button>
            ) : null}
            {respostas.length > 0 ? (
              <button
                type="button"
                onClick={() => setMostrarRespostas((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {mostrarRespostas
                  ? 'Ocultar respostas'
                  : `Ver ${respostas.length} ${respostas.length === 1 ? 'resposta' : 'respostas'}`}
              </button>
            ) : null}
          </div>

          {modoResposta && onEnviarResposta && usuarioId ? (
            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
              <textarea
                rows={2}
                className="min-h-[40px] min-w-0 w-full flex-1 resize-y rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400"
                placeholder={`Responder para @${uname}…`}
                value={textoResposta}
                disabled={enviando}
                onChange={(e) => setTextoResposta(e.target.value)}
              />
              <button
                type="button"
                disabled={!textoResposta.trim() || enviando}
                onClick={() => void enviarRespostaInline()}
                className="shrink-0 rounded-lg bg-[#0097b2] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {enviando ? '…' : 'Enviar'}
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          className="flex shrink-0 flex-col items-center gap-0.5 self-start text-xs text-gray-500"
          disabled={!usuarioId}
        >
          <Heart size={18} className={curtiu ? 'fill-red-500 text-red-500' : ''} aria-hidden />
          {total}
        </button>
      </div>

      {mostrarRespostas && respostas.length > 0 ? (
        <div className={ehRaiz ? 'mt-2 pl-0' : 'mt-1'}>
          {respostas.map((child) => (
            <Comentario
              key={child.id}
              node={child}
              usuarioId={usuarioId}
              destacarComentarioId={destacarComentarioId}
              onEnviarResposta={onEnviarResposta}
              onExcluir={onExcluir}
              nivel={nivel + 1}
              enviando={enviando}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
