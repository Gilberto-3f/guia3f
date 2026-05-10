'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

function debugSeguir(/** @type {unknown[]} */ ...args) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

/**
 * @param {{
 *   empresaId?: string,
 *   alvoId?: string,
 *   alvoTipo?: 'empresa' | 'usuario',
 *   seguidoTipo?: string | null,
 *   isFollowing?: boolean,
 *   onToggle?: (seguindo: boolean) => void
 *   layout?: 'default' | 'inline'
 *   buttonClassName?: string
 *   leadingIcon?: 'heart' | 'none'
 *   showInlineError?: boolean
 *   size?: 'default' | 'compact'
 * }} props
 */
export default function BotaoSeguir({
  empresaId,
  alvoId,
  alvoTipo,
  seguidoTipo = null,
  isFollowing: initialFollowing = false,
  onToggle,
  layout = 'default',
  buttonClassName = '',
  leadingIcon = 'heart',
  showInlineError = true,
  size = 'default',
}) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const [seguindo, setSeguindo] = useState(initialFollowing)
  const [erro, setErro] = useState(/** @type {string | null} */ (null))
  const [loading, setLoading] = useState(false)

  /** Evita que `isFollowing` desatualizado do pai sobrescreva o estado durante o request. */
  useEffect(() => {
    debugSeguir('[BotaoSeguir] useEffect sync', {
      initialFollowing,
      loading,
      acao: loading ? 'skip (loading)' : 'setSeguindo(initialFollowing)',
    })
    if (loading) return
    setSeguindo(initialFollowing)
  }, [initialFollowing, loading])

  const handleToggle = async (e) => {
    e.stopPropagation()
    setErro(null)
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    const estadoAntes = seguindo
    const novoEsperado = !estadoAntes
    debugSeguir('[BotaoSeguir] handleToggle iniciado', {
      empresaId: empresaId ?? null,
      alvoId: alvoId ?? null,
      alvoTipo: alvoTipo ?? null,
      estadoAntes,
      novoEsperadoOtimista: novoEsperado,
      podeInteragir,
    })
    setLoading(true)
    setSeguindo(!estadoAntes)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        debugSeguir('[BotaoSeguir] sem sessão, revertendo estado')
        setErro('Entre na sua conta para seguir.')
        setSeguindo(estadoAntes)
        return
      }

      debugSeguir('[BotaoSeguir] sessão OK', { usuarioId: session.user.id })

      const tipo = alvoTipo || (empresaId ? 'empresa' : 'usuario')
      const id = tipo === 'empresa' ? String(empresaId || alvoId || '') : String(alvoId || '')
      if (!id) {
        debugSeguir('[BotaoSeguir] id vazio após resolver tipo', { tipo })
        setErro('Ação indisponível.')
        setSeguindo(estadoAntes)
        return
      }

      if (tipo === 'empresa') {
        const operacao = estadoAntes ? 'delete_favorito_empresa' : 'insert_favorito_empresa'
        debugSeguir('[BotaoSeguir] operação empresa', { operacao, idAlvo: id })

        if (estadoAntes) {
          const { error } = await supabase
            .from('favoritos')
            .delete()
            .eq('usuario_id', session.user.id)
            .eq('alvo_id', id)
            .eq('alvo_tipo', 'empresa')
          debugSeguir('[BotaoSeguir] resposta Supabase (delete favoritos)', { error })
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('favoritos')
            .insert({
              usuario_id: session.user.id,
              alvo_id: id,
              alvo_tipo: 'empresa',
            })
            .select('id')
            .maybeSingle()
          debugSeguir('[BotaoSeguir] resposta Supabase (insert favoritos)', { data, error })
          if (error) throw error
        }
      } else {
        if (id === session.user.id) {
          debugSeguir('[BotaoSeguir] mesmo usuário, revertendo')
          setSeguindo(estadoAntes)
          return
        }
        const operacaoRede = estadoAntes ? 'delete_redecontatos' : 'insert_redecontatos'
        debugSeguir('[BotaoSeguir] operação rede', { operacaoRede, id })

        if (estadoAntes) {
          const { error } = await supabase.from('redecontatos').delete().eq('seguidor_id', session.user.id).eq('seguido_id', id)
          debugSeguir('[BotaoSeguir] resposta Supabase (delete redecontatos)', { error })
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('redecontatos')
            .insert({ seguidor_id: session.user.id, seguido_id: id, seguido_tipo: seguidoTipo || 'user' })
            .select('id')
            .maybeSingle()
          debugSeguir('[BotaoSeguir] resposta Supabase (insert redecontatos)', { data, error })
          if (error) throw error
        }
      }

      const novo = !estadoAntes
      debugSeguir('[BotaoSeguir] toggle concluído com sucesso', {
        novoEstadoEsperado: novo,
        chamaOnToggle: true,
      })
      onToggle?.(novo)
      window.dispatchEvent(new Event('perfil-atualizado'))
      if (tipo === 'empresa') {
        window.dispatchEvent(new Event('guia-feed-rede-reload'))
      }
    } catch (err) {
      debugSeguir('[BotaoSeguir] catch — revertendo para estadoAntes', { estadoAntes, err })
      setSeguindo(estadoAntes)
      let msg = 'Não foi possível concluir a ação. Tente de novo.'
      const raw =
        err && typeof err === 'object' && 'message' in err && typeof /** @type {{ message?: unknown }} */ (err).message === 'string'
          ? String(/** @type {{ message: string }} */ (err).message)
          : err instanceof Error
            ? err.message
            : ''
      if (raw) {
        const lower = raw.toLowerCase()
        if (lower.includes('duplicate') || lower.includes('unique')) {
          msg = 'Você já segue este perfil.'
        } else if (lower.includes('violates') || lower.includes('permission') || lower.includes('policy')) {
          msg = 'Sem permissão para esta ação.'
        } else if (raw.trim()) {
          msg = raw
        }
      }
      setErro(msg)
    } finally {
      debugSeguir('[BotaoSeguir] finally — loading=false (próximo useEffect pode sincronizar com prop)')
      setLoading(false)
    }
  }

  const wrapperClass =
    layout === 'inline'
      ? 'flex shrink-0 flex-col items-end gap-1'
      : 'flex flex-col items-end gap-1'

  const defaultBtn =
    size === 'compact'
      ? [
          'flex min-w-[72px] max-w-[100px] items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1 text-[11px] font-semibold transition-colors',
          seguindo
            ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
            : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
        ].join(' ')
      : [
          'flex min-w-[84px] items-center justify-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors',
          seguindo
            ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
            : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
        ].join(' ')

  const iconSize = size === 'compact' ? 12 : 14

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || !podeInteragir}
        title={!showInlineError && erro ? erro : undefined}
        aria-label={seguindo ? 'Deixar de seguir' : 'Seguir'}
        className={buttonClassName.trim() ? buttonClassName : defaultBtn}
      >
        {leadingIcon === 'heart' && !seguindo ? (
          <Heart size={iconSize} className="text-white" aria-hidden />
        ) : null}
        <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
      </button>
      {showInlineError && erro ? (
        <span className="max-w-[240px] text-right text-xs text-red-600">{erro}</span>
      ) : null}
      {!showInlineError && erro ? (
        <span className="sr-only" role="status">
          {erro}
        </span>
      ) : null}
    </div>
  )
}
