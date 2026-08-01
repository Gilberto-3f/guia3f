'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ShieldCheck, Star, User, X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import EscudoVerificacaoPendente from '@/components/EscudoVerificacaoPendente'
import IconWhatsApp from '@/components/IconWhatsApp'
import PopupRecomendarProfissional from '@/components/PopupRecomendarProfissional'
import PopupRecomendarMobilidade from '@/components/PopupRecomendarMobilidade'
import EstrelasAvaliacao from '@/components/EstrelasAvaliacao'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import {
  normalizarCategoriasProfissional,
  resolverAcoesCartaoVisitaProfissional,
  resolverVisaoCartaoVisita,
  tituloAvaliarDesabilitadoCartao,
} from '@/lib/cartaoVisitaProfissional'
import { labelIdiomaGuia, normalizarIdiomasGuia } from '@/lib/idiomasGuia'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { supabase } from '@/lib/supabase'

function formatMesAno(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * @param {{
 *  aberto: boolean
 *  onFechar: () => void
 *  nome: string
 *  username: string
 *  avatarUrl: string | null
 *  verificadoEm: string | null
 *  cadastradoEm?: string | null
 *  categorias?: string[] | null
 *  placaVermelha?: boolean
 *  profissionalVerificado?: boolean
 *  paisBandeira?: string | null
 *  notaMedia?: number | null
 *  totalAvaliacoes?: number | null
 *  meuId?: string | null
 *  profileId: string
 *  meuRole?: string | null
 *  visitantePlacaVermelha?: boolean
 *  visitanteCategorias?: string[] | null
 *  profissionalIndicadoId?: string | null
 *  temParceriaFechada?: boolean
 *  turistaContratouProfissional?: boolean
 *  cidadeAtuacaoVisitado?: string | null
 *  idiomas?: string[] | null
 *  onContratar?: () => void
 *  onAvaliacaoConcluida?: () => void
 * }} props
 */
export default function PopupCartaoVisitaProfissional({
  aberto,
  onFechar,
  nome,
  username,
  avatarUrl,
  verificadoEm,
  cadastradoEm = null,
  categorias = null,
  placaVermelha = false,
  profissionalVerificado = false,
  paisBandeira = null,
  notaMedia = null,
  totalAvaliacoes = 0,
  meuId = null,
  profileId,
  meuRole = null,
  visitantePlacaVermelha = false,
  visitanteCategorias = null,
  profissionalIndicadoId = null,
  temParceriaFechada = false,
  turistaContratouProfissional = false,
  cidadeAtuacaoVisitado = null,
  idiomas: idiomasProp = null,
  onContratar,
  onAvaliacaoConcluida,
}) {
  useModalScrollLock(aberto)
  const [modo, setModo] = useState(/** @type {'cartao' | 'avaliar'} */ ('cartao'))
  const [notaUsuario, setNotaUsuario] = useState(0)
  const [feedbackUsuario, setFeedbackUsuario] = useState('')
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false)
  const [erroAvaliacao, setErroAvaliacao] = useState('')
  const [jaAvaliou, setJaAvaliou] = useState(false)
  const [checandoJaAvaliou, setChecandoJaAvaliou] = useState(false)
  const [popupRecomendarAberto, setPopupRecomendarAberto] = useState(false)
  const [popupMobilidadeAberto, setPopupMobilidadeAberto] = useState(false)
  const [idiomasGuia, setIdiomasGuia] = useState(/** @type {string[]} */ ([]))

  const verificado = profissionalVerificado === true
  const mesAnoCadastro = formatMesAno(cadastradoEm ?? verificadoEm)
  const u = String(username ?? '').trim().replace(/^@+/, '')
  const uShown = u.length > 15 ? `${u.slice(0, 15)}…` : u
  const rotuloCategoria = formatProfissionalCategorias(categorias)
  const ehGuia = normalizarCategoriasProfissional(categorias).includes('guia')

  useEffect(() => {
    if (!aberto || !ehGuia) {
      setIdiomasGuia([])
      return
    }
    const fromProp = normalizarIdiomasGuia(idiomasProp)
    if (fromProp.length > 0) {
      setIdiomasGuia(fromProp)
      return
    }
    let ativo = true
    void (async () => {
      const { data, error } = await supabase
        .from('profissionais')
        .select('idiomas')
        .eq('usuario_id', profileId)
        .maybeSingle()
      if (!ativo) return
      if (error && String(error.message ?? '').toLowerCase().includes('idiomas')) {
        setIdiomasGuia([])
        return
      }
      setIdiomasGuia(normalizarIdiomasGuia(data?.idiomas))
    })()
    return () => {
      ativo = false
    }
  }, [aberto, ehGuia, profileId, idiomasProp])

  const souDono = Boolean(meuId && profileId && meuId === profileId)
  const visao = resolverVisaoCartaoVisita({ meuId, profileId, meuRole, souDono })

  const acoes = useMemo(
    () =>
      resolverAcoesCartaoVisitaProfissional({
        visao,
        profissionalVerificado: verificado,
        visitantePlacaVermelha,
        visitanteCategorias,
        visitadoPlacaVermelha: placaVermelha,
        visitadoCategorias: categorias,
        temParceriaFechada,
        turistaContratouProfissional,
      }),
    [
      visao,
      verificado,
      visitantePlacaVermelha,
      visitanteCategorias,
      placaVermelha,
      categorias,
      temParceriaFechada,
      turistaContratouProfissional,
    ],
  )

  const media = notaMedia != null && Number.isFinite(Number(notaMedia)) ? Number(notaMedia) : 0
  const total = totalAvaliacoes != null && Number.isFinite(Number(totalAvaliacoes)) ? Number(totalAvaliacoes) : 0

  const profissionalRecomendacao =
    profissionalIndicadoId && profileId
      ? {
          id: profissionalIndicadoId,
          usuarioId: profileId,
          nome: nome || 'Profissional',
          nomeUsuario: username,
          categorias,
          notaMedia: media || null,
          totalAvaliacoes: total || null,
          paisBandeira,
        }
      : null

  const tituloAvaliarDesabilitado = tituloAvaliarDesabilitadoCartao({
    visao,
    visitadoPlacaVermelha: placaVermelha,
    visitadoCategorias: categorias,
  })

  const alvoIdsAvaliacao = useMemo(
    () => [...new Set([profissionalIndicadoId, profileId].filter(Boolean).map(String))],
    [profissionalIndicadoId, profileId],
  )

  const resetAvaliacao = useCallback(() => {
    setModo('cartao')
    setNotaUsuario(0)
    setFeedbackUsuario('')
    setErroAvaliacao('')
    setJaAvaliou(false)
    setChecandoJaAvaliou(false)
  }, [])

  useEffect(() => {
    if (!aberto) resetAvaliacao()
  }, [aberto, resetAvaliacao])

  useEffect(() => {
    if (!aberto || modo !== 'avaliar' || !meuId || alvoIdsAvaliacao.length === 0) return
    let ativo = true
    setChecandoJaAvaliou(true)
    void supabase
      .from('avaliacoes')
      .select('id')
      .eq('usuario_id', meuId)
      .eq('alvo_tipo', 'profissional')
      .in('alvo_id', alvoIdsAvaliacao)
      .limit(1)
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) console.error('[CartaoVisita] checar avaliacao:', error.message)
        setJaAvaliou((data?.length ?? 0) > 0)
        setChecandoJaAvaliou(false)
      })
    return () => {
      ativo = false
    }
  }, [aberto, modo, meuId, alvoIdsAvaliacao])

  const confirmarAvaliacao = async () => {
    if (!meuId || notaUsuario === 0 || jaAvaliou || enviandoAvaliacao) return
    const alvoId = profissionalIndicadoId || profileId
    if (!alvoId) {
      setErroAvaliacao('Não foi possível identificar o profissional.')
      return
    }

    setEnviandoAvaliacao(true)
    setErroAvaliacao('')
    try {
      const { data: avaliacaoId, error } = await supabase.rpc('inserir_avaliacao_profissional', {
        p_alvo_id: alvoId,
        p_nota: notaUsuario,
        p_feedback: feedbackUsuario.trim() !== '' ? feedbackUsuario.trim() : null,
      })
      if (error) {
        const msg = String(error.message ?? '')
        if (msg.includes('ja_avaliou')) {
          setErroAvaliacao('Você já avaliou este profissional.')
        } else if (msg.includes('not_authenticated')) {
          setErroAvaliacao('Faça login para avaliar.')
        } else if (msg.includes('role_nao_pode_avaliar')) {
          setErroAvaliacao('Seu tipo de conta não pode avaliar profissionais.')
        } else {
          setErroAvaliacao(msg)
        }
        return
      }
      if (!avaliacaoId) {
        setErroAvaliacao('Não foi possível registrar a avaliação.')
        return
      }
      window.dispatchEvent(new Event('perfil-atualizado'))
      window.dispatchEvent(new CustomEvent('avaliacao-enviada', { detail: { profileId, alvoId } }))
      resetAvaliacao()
      onFechar()
      onAvaliacaoConcluida?.()
    } finally {
      setEnviandoAvaliacao(false)
    }
  }

  const fecharPopup = () => {
    resetAvaliacao()
    onFechar()
  }

  const mostrarRodape =
    acoes.mostrarContratar ||
    acoes.mostrarRecomendar ||
    acoes.mostrarRecomendarMobilidade ||
    acoes.mostrarAvaliar

  if (!aberto) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[240] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        onClick={fecharPopup}
        role="presentation"
      >
        <div
          className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
          style={{ height: 'min(72vh, 86vh)' }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-3">
            {modo === 'avaliar' ? (
              <>
                <button
                  type="button"
                  onClick={() => setModo('cartao')}
                  className="absolute left-3 top-3 rounded-full p-1 text-gray-500 transition hover:bg-gray-100"
                  aria-label="Voltar ao cartão de visita"
                >
                  <ChevronLeft size={22} strokeWidth={2} aria-hidden />
                </button>
                <h2 className="px-10 text-center text-xl font-bold text-[#0097b2]">Avaliar Profissional</h2>
              </>
            ) : verificado ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#00D443]" fill="currentColor" stroke="white" strokeWidth={2} aria-hidden />
                  <h2 className="text-xl font-bold tracking-wide text-[#00D443]">VERIFICADO</h2>
                </div>
                <p className="mt-1 px-4 text-center text-sm text-gray-600">
                  {mesAnoCadastro ? (
                    <>
                      desde <span className="font-semibold text-gray-800">{mesAnoCadastro}</span>
                    </>
                  ) : (
                    'Profissional verificado'
                  )}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <EscudoVerificacaoPendente className="h-6 w-6" iconSize={20} />
                <h2 className="text-xl font-bold tracking-wide text-[#F44336]">EM ANÁLISE</h2>
              </div>
            )}
            <button
              type="button"
              onClick={fecharPopup}
              className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-500"
              aria-label="Fechar"
            >
              <X size={22} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            {modo === 'avaliar' ? (
              <div className="flex flex-col items-center">
                <div className="flex w-full max-w-sm justify-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-2 ring-[#0097b2]/15">
                      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" fill className="object-cover" sizes="48px" /> : null}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="line-clamp-2 text-base font-bold text-gray-900">{nome || 'Profissional'}</p>
                      <p className="truncate text-sm text-[#0097b2]">@{uShown || 'usuario'}</p>
                    </div>
                  </div>
                </div>

                {checandoJaAvaliou ? (
                  <p className="mt-8 text-sm text-gray-500">Carregando…</p>
                ) : jaAvaliou ? (
                  <p className="mt-8 text-center text-sm text-gray-600">Você já avaliou este profissional.</p>
                ) : (
                  <>
                    <div className="mt-8 flex justify-center">
                      <EstrelasAvaliacao
                        nota={notaUsuario}
                        onChange={(n) => {
                          setNotaUsuario(n)
                          setErroAvaliacao('')
                        }}
                        tamanho={40}
                      />
                    </div>
                    {notaUsuario > 0 ? (
                      <div className="mt-6 w-full max-w-sm">
                        <textarea
                          value={feedbackUsuario}
                          onChange={(e) => {
                            setFeedbackUsuario(e.target.value)
                            setErroAvaliacao('')
                          }}
                          placeholder="Compartilhe sua experiência (opcional)"
                          className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                          rows={3}
                        />
                        {erroAvaliacao ? (
                          <p className="mt-2 text-center text-sm text-red-600">{erroAvaliacao}</p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void confirmarAvaliacao()}
                          disabled={enviandoAvaliacao}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                          style={{ backgroundColor: '#00D443' }}
                        >
                          <User size={20} className="shrink-0 text-white" strokeWidth={2.25} aria-hidden />
                          {enviandoAvaliacao ? 'CONFIRMANDO…' : 'CONFIRMAR'}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : verificado ? (
              <>
                <div className="space-y-4">
                  <div className="flex w-full justify-center">
                    <div className="flex max-w-full flex-row items-center gap-3 sm:gap-5">
                      <div className="relative h-[3.75rem] w-[3.75rem] shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-2 ring-[#0097b2]/15 sm:h-[4.25rem] sm:w-[4.25rem]">
                        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" fill className="object-cover" sizes="68px" /> : null}
                      </div>
                      <div className="flex min-w-0 flex-col items-start justify-center gap-0.5 text-left">
                        <p className="line-clamp-2 max-w-[min(100%,18rem)] text-lg font-bold text-gray-900 sm:text-xl">
                          {nome || 'Profissional'}
                        </p>
                        <p className="flex max-w-[min(100%,18rem)] items-center gap-1.5 truncate text-sm font-normal text-gray-600 sm:text-base">
                          {paisBandeira ? (
                            <span className="shrink-0 text-base leading-none" aria-hidden>
                              {paisBandeira}
                            </span>
                          ) : null}
                          <span className="truncate">@{uShown || 'usuario'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="w-full whitespace-normal px-1 text-center text-2xl font-bold leading-snug tracking-wide text-[#0097b2] sm:text-3xl">
                    {rotuloCategoria}
                  </p>
                  {ehGuia && idiomasGuia.length > 0 ? (
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {idiomasGuia.map((cod) => (
                        <span
                          key={cod}
                          className="inline-flex items-center gap-1 rounded-full bg-[#0097b2]/10 px-2.5 py-1 text-xs font-semibold text-[#0097b2]"
                        >
                          {labelIdiomaGuia(cod)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
                  <p className="text-center text-sm font-semibold text-gray-800">Nota de avaliação</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden />
                    <span className="text-xl font-bold text-gray-900">
                      {total ? media.toFixed(1).replace('.', ',') : '—'}
                    </span>
                    <span className="text-sm text-gray-500">({total} avaliações)</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-2 ring-gray-200 sm:h-[5rem] sm:w-[5rem]">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" fill className="object-cover" sizes="80px" /> : null}
                </div>
                <div className="flex min-w-0 flex-col items-center gap-0.5">
                  <p className="line-clamp-2 max-w-md text-lg font-bold text-gray-900 sm:text-xl">{nome || 'Profissional'}</p>
                  <p className="flex items-center justify-center gap-1.5 truncate text-sm font-normal text-gray-600 sm:text-base">
                    {paisBandeira ? (
                      <span className="shrink-0 text-base leading-none" aria-hidden>
                        {paisBandeira}
                      </span>
                    ) : null}
                    <span className="truncate">@{uShown || 'usuario'}</span>
                  </p>
                </div>
                <p className="max-w-md px-1 text-sm leading-relaxed text-gray-600">
                  Novo perfil profissional cadastrado. Usuário aguarda verificação da plataforma.
                </p>
              </div>
            )}
          </div>

          {verificado && mostrarRodape && modo === 'cartao' ? (
            <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
              <div className="flex flex-col gap-2">
                {acoes.mostrarContratar ? (
                  <button
                    type="button"
                    onClick={() => onContratar?.()}
                    className="w-full rounded-xl py-3 text-base font-bold text-white"
                    style={{ backgroundColor: '#00D443' }}
                  >
                    CONTRATAR PROFISSIONAL
                  </button>
                ) : null}
                {acoes.mostrarRecomendar ? (
                  <button
                    type="button"
                    onClick={() => setPopupRecomendarAberto(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white"
                    style={{ backgroundColor: '#00D443' }}
                  >
                    <IconWhatsApp size={20} className="shrink-0 text-white" />
                    RECOMENDAR
                  </button>
                ) : null}
                {acoes.mostrarRecomendarMobilidade ? (
                  <button
                    type="button"
                    onClick={() => setPopupMobilidadeAberto(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white"
                    style={{ backgroundColor: '#00D443' }}
                  >
                    <IconWhatsApp size={20} className="shrink-0 text-white" />
                    RECOMENDAR MOBILIDADE
                  </button>
                ) : null}
                {acoes.mostrarAvaliar ? (
                  <button
                    type="button"
                    disabled={!acoes.avaliarHabilitado}
                    title={acoes.avaliarHabilitado ? 'Avaliar profissional' : tituloAvaliarDesabilitado}
                    onClick={() => {
                      if (acoes.avaliarHabilitado) setModo('avaliar')
                    }}
                    className={`w-full rounded-xl bg-[#0097b2] py-3 text-base font-bold text-white ${
                      acoes.avaliarHabilitado ? 'hover:opacity-95' : 'opacity-60'
                    }`}
                  >
                    AVALIAR PROFISSIONAL
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {profissionalRecomendacao ? (
        <PopupRecomendarProfissional
          aberto={popupRecomendarAberto}
          onFechar={() => setPopupRecomendarAberto(false)}
          profissional={profissionalRecomendacao}
        />
      ) : null}

      <PopupRecomendarMobilidade
        aberto={popupMobilidadeAberto}
        onFechar={() => setPopupMobilidadeAberto(false)}
        cidadeAtuacao={cidadeAtuacaoVisitado}
      />
    </>
  )
}
