'use client'

import { useEffect, useState } from 'react'
import { Heart, UserCheck, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { deletarFavoritoEmpresa, payloadFavoritoEmpresa, usuarioSegueEmpresa } from '@/lib/favoritosEmpresa'
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
  const [visitanteEmpresa, setVisitanteEmpresa] = useState(false)

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || cancelado) return
      const { data } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
      if (!cancelado) {
        setVisitanteEmpresa(String(data?.role ?? '') === 'empresa')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  const tipoAlvo = alvoTipo || (empresaId ? 'empresa' : 'usuario')
  const bloqueadoEmpresaPerfilSocial = visitanteEmpresa && tipoAlvo === 'usuario'
  const tituloBloqueadoEmpresa =
    'Empresas não seguem perfis sociais — sem feed nem notificações de conteúdo de turistas ou profissionais.'

  /** Sincroniza com a prop do pai; durante request não sobrescreve estado otimista. */
  useEffect(() => {
    if (loading) return
    setSeguindo(initialFollowing)
  }, [initialFollowing, loading])

  /** Confirma no Supabase (fonte de verdade) — evita prop desatualizada do pai. */
  useEffect(() => {
    const idEmpresa = String(empresaId || alvoId || '')
    const tipo = alvoTipo || (empresaId ? 'empresa' : 'usuario')
    if (tipo !== 'empresa' || !idEmpresa) return

    let cancelado = false
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || cancelado) return
      const segue = await usuarioSegueEmpresa(supabase, uid, idEmpresa)
      if (!cancelado && !loading) {
        /** Não rebaixar para "Seguir" se o pai já indicou seguindo (ex.: popup de favoritos próprios). */
        setSeguindo(Boolean(segue) || Boolean(initialFollowing))
      }
    })()

    return () => {
      cancelado = true
    }
  }, [empresaId, alvoId, alvoTipo, loading, initialFollowing])

  const handleToggle = async (e) => {
    e.stopPropagation()
    setErro(null)
    if (bloqueadoEmpresaPerfilSocial) return
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
          await deletarFavoritoEmpresa(supabase, session.user.id, id)
          debugSeguir('[BotaoSeguir] delete favoritos empresa concluído', { idAlvo: id })
        } else {
          const { data, error } = await supabase
            .from('favoritos')
            .insert(payloadFavoritoEmpresa(session.user.id, id))
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
      ? buttonClassName.trim()
        ? 'flex w-full flex-col items-stretch gap-0'
        : 'flex shrink-0 flex-col items-end gap-1'
      : 'flex flex-col items-end gap-1'

  const defaultBtn =
    size === 'compact'
      ? [
          'flex min-w-[72px] max-w-[100px] items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1 text-[11px] font-semibold transition-colors',
          bloqueadoEmpresaPerfilSocial
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-70'
            : seguindo
              ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
              : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
        ].join(' ')
      : [
          'flex min-w-[84px] items-center justify-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium transition-colors',
          bloqueadoEmpresaPerfilSocial
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-70'
            : seguindo
              ? 'border-[#0097b2] bg-white text-[#0097b2] hover:bg-[#0097b2]/5'
              : 'border-transparent bg-[#0097b2] text-white hover:bg-[#0088a1]',
        ].join(' ')

  const iconSize = size === 'compact' ? 12 : 14

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || !podeInteragir || bloqueadoEmpresaPerfilSocial}
        title={bloqueadoEmpresaPerfilSocial ? tituloBloqueadoEmpresa : !showInlineError && erro ? erro : undefined}
        aria-label={bloqueadoEmpresaPerfilSocial ? 'Seguir indisponível para empresas' : seguindo ? 'Deixar de seguir' : 'Seguir'}
        aria-disabled={bloqueadoEmpresaPerfilSocial || undefined}
        className={
          buttonClassName.trim()
            ? `${buttonClassName.trim()}${bloqueadoEmpresaPerfilSocial ? ' cursor-not-allowed opacity-50' : ''}`
            : defaultBtn
        }
      >
        {leadingIcon === 'heart' && !seguindo && !bloqueadoEmpresaPerfilSocial ? (
          <Heart size={iconSize} className="text-white" aria-hidden />
        ) : null}
        {leadingIcon === 'heart' && !seguindo && bloqueadoEmpresaPerfilSocial ? (
          <Heart size={iconSize} className="text-gray-400" aria-hidden />
        ) : null}
        {leadingIcon === 'user-plus' && !seguindo && !bloqueadoEmpresaPerfilSocial ? (
          <UserPlus size={iconSize} className="shrink-0 text-white" aria-hidden />
        ) : null}
        {leadingIcon === 'user-plus' && !seguindo && bloqueadoEmpresaPerfilSocial ? (
          <UserPlus size={iconSize} className="shrink-0 text-gray-400" aria-hidden />
        ) : null}
        {leadingIcon === 'user-plus' && seguindo && !bloqueadoEmpresaPerfilSocial ? (
          <UserCheck size={iconSize} className="shrink-0 text-white" aria-hidden />
        ) : null}
        <span>{bloqueadoEmpresaPerfilSocial ? 'Seguir' : seguindo ? 'Seguindo' : 'Seguir'}</span>
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
