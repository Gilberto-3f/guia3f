'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Link2, Loader2, MessageCircle, Radio, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { COMUNIDADES_PROFISSIONAIS_SLUG } from '@/lib/canaisProfissionaisListaUi'
import {
  buscarContextoEmpresaUsuario,
  enviarPostFeedNoCanalEmpresa,
  PAISES_CANAL_COMPARTILHAR,
  ROTULO_COMUNIDADE_CANAL,
  ROTULO_PAIS_CANAL,
} from '@/lib/compartilharPostCanal'

const LOGO_AZUL = '#0097b2'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   postUrl: string
 *   tituloResumo: string
 *   imagemUrl?: string | null
 * }} props
 */
export default function ModalCompartilhar({
  aberto,
  onFechar,
  postUrl,
  tituloResumo,
  imagemUrl = null,
}) {
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const { recursosEmpresaLiberados, loading: gateLoading } = useProfissionalGate()

  const [tela, setTela] = useState(/** @type {'principal' | 'canal'} */ ('principal'))
  const [ehEmpresa, setEhEmpresa] = useState(false)
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [usuarioId, setUsuarioId] = useState(/** @type {string | null} */ (null))
  const [paisCanal, setPaisCanal] = useState('geral')
  const [comunidade, setComunidade] = useState('guia')
  const [enviando, setEnviando] = useState(false)
  const [erroCanal, setErroCanal] = useState('')
  const [sucessoCanal, setSucessoCanal] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const fechar = useCallback(() => {
    setTela('principal')
    setErroCanal('')
    setSucessoCanal(false)
    setCopiado(false)
    onFechar()
  }, [onFechar])

  useEffect(() => {
    if (!aberto) {
      setTela('principal')
      setErroCanal('')
      setSucessoCanal(false)
      setCopiado(false)
      return
    }

    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!ativo) return
      setUsuarioId(uid)

      if (!uid) {
        setEhEmpresa(false)
        setEmpresaId(null)
        return
      }

      const ctx = await buscarContextoEmpresaUsuario(supabase, uid)
      if (!ativo) return

      const roleEmpresa =
        ctx.role === 'empresa' || (modoAtivo && perfilSimulado?.tipo === 'empresa')
      setEhEmpresa(roleEmpresa)
      setEmpresaId(ctx.empresaId)
    })()

    return () => {
      ativo = false
    }
  }, [aberto, modoAtivo, perfilSimulado?.tipo])

  const compartilharWhatsApp = () => {
    const texto = `${tituloResumo} ${postUrl}`.trim()
    const u = `https://wa.me/?text=${encodeURIComponent(texto)}`
    fechar()
    requestAnimationFrame(() => {
      const mobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (mobile) {
        window.location.assign(u)
      } else {
        window.open(u, '_blank', 'noopener,noreferrer')
      }
    })
  }

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.alert('Não foi possível copiar')
    }
  }

  const abrirTelaCanal = () => {
    setErroCanal('')
    setSucessoCanal(false)
    setTela('canal')
  }

  const enviarNoCanal = async () => {
    if (!usuarioId || !empresaId || !postUrl) return
    if (!recursosEmpresaLiberados) {
      setErroCanal('Envio no canal liberado após verificação dos documentos da empresa.')
      return
    }

    setEnviando(true)
    setErroCanal('')
    setSucessoCanal(false)
    try {
      await enviarPostFeedNoCanalEmpresa(supabase, {
        usuarioId,
        empresaId,
        comunidadeSlug: comunidade,
        paisAba: paisCanal,
        postUrl,
        resumo: tituloResumo,
        imagemUrl,
      })
      setSucessoCanal(true)
      window.setTimeout(() => fechar(), 1400)
    } catch (e) {
      setErroCanal(e instanceof Error ? e.message : 'Não foi possível enviar no canal.')
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  const itemBtn =
    'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-white transition hover:bg-white/10 active:bg-white/15'

  const conteudoPrincipal = (
    <>
      <div className="flex items-center justify-between border-b border-white/20 px-4 py-3">
        <h3 className="text-base font-bold text-white">Compartilhar</h3>
        <button
          type="button"
          onClick={fechar}
          className="rounded-lg p-1.5 text-white transition hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <div className="min-h-[220px] space-y-1 p-3">
        <button type="button" onClick={() => void copiarLink()} className={itemBtn}>
          <Link2 className="h-5 w-5 shrink-0 text-white" strokeWidth={2} aria-hidden />
          <span className="text-sm font-semibold">{copiado ? 'Link copiado!' : 'Copiar link'}</span>
        </button>
        <button type="button" onClick={compartilharWhatsApp} className={itemBtn}>
          <MessageCircle className="h-5 w-5 shrink-0 text-white" strokeWidth={2} aria-hidden />
          <span className="text-sm font-semibold">Enviar no WhatsApp</span>
        </button>
        {ehEmpresa ? (
          <button type="button" onClick={abrirTelaCanal} className={itemBtn}>
            <Radio className="h-5 w-5 shrink-0 text-white" strokeWidth={2} aria-hidden />
            <span className="text-sm font-semibold">Enviar no canal</span>
          </button>
        ) : null}
      </div>
    </>
  )

  const conteudoCanal = (
    <>
      <div className="flex items-center gap-2 border-b border-white/20 px-3 py-3">
        <button
          type="button"
          onClick={() => {
            setTela('principal')
            setErroCanal('')
            setSucessoCanal(false)
          }}
          className="rounded-lg p-1.5 text-white transition hover:bg-white/10"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
        <h3 className="min-w-0 flex-1 truncate text-base font-bold text-white">Enviar no canal</h3>
        <button
          type="button"
          onClick={fechar}
          className="rounded-lg p-1.5 text-white transition hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <div className="flex min-h-[220px] flex-col gap-4 p-4">
        <p className="text-xs leading-relaxed text-white/85">
          Envie esta publicação do feed para o canal de qualquer comunidade, em qualquer país.
        </p>

        <div>
          <label htmlFor="compartilhar-pais-canal" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/80">
            Qual canal?
          </label>
          <select
            id="compartilhar-pais-canal"
            value={paisCanal}
            onChange={(e) => setPaisCanal(e.target.value)}
            className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-white/50 focus:ring-2 focus:ring-white/20"
          >
            {PAISES_CANAL_COMPARTILHAR.map((p) => (
              <option key={p} value={p} className="text-gray-900">
                {ROTULO_PAIS_CANAL[p] ?? p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="compartilhar-comunidade" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/80">
            Qual comunidade?
          </label>
          <select
            id="compartilhar-comunidade"
            value={comunidade}
            onChange={(e) => setComunidade(e.target.value)}
            className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-white/50 focus:ring-2 focus:ring-white/20"
          >
            {COMUNIDADES_PROFISSIONAIS_SLUG.map((slug) => (
              <option key={slug} value={slug} className="text-gray-900">
                {ROTULO_COMUNIDADE_CANAL[slug] ?? slug}
              </option>
            ))}
          </select>
        </div>

        {gateLoading ? (
          <p className="text-center text-xs text-white/70">Verificando permissões…</p>
        ) : !recursosEmpresaLiberados ? (
          <p className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90">
            O envio no canal é liberado após a verificação dos documentos da empresa (Menu → Usuário → Anexar documentos).
          </p>
        ) : null}

        {erroCanal ? (
          <p className="rounded-xl bg-red-500/25 px-3 py-2 text-xs font-medium text-white">{erroCanal}</p>
        ) : null}
        {sucessoCanal ? (
          <p className="rounded-xl bg-emerald-500/30 px-3 py-2 text-xs font-semibold text-white">
            Publicação enviada ao canal com sucesso!
          </p>
        ) : null}

        <button
          type="button"
          disabled={enviando || gateLoading || !recursosEmpresaLiberados || sucessoCanal}
          onClick={() => void enviarNoCanal()}
          className="mt-auto flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#0097b2] shadow-sm transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Enviando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              ENVIAR
            </>
          )}
        </button>
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl shadow-xl"
        style={{ backgroundColor: LOGO_AZUL }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-compartilhar-titulo"
      >
        <span id="modal-compartilhar-titulo" className="sr-only">
          {tela === 'canal' ? 'Enviar no canal' : 'Compartilhar publicação'}
        </span>
        {tela === 'canal' ? conteudoCanal : conteudoPrincipal}
      </div>
    </div>
  )
}
