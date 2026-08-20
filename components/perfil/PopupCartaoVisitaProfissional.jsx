'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Building2, Car, ChevronLeft, Languages, ShieldCheck, Star, User, X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import EscudoVerificacaoPendente from '@/components/EscudoVerificacaoPendente'
import IconWhatsApp from '@/components/IconWhatsApp'
import PopupRecomendarProfissional from '@/components/PopupRecomendarProfissional'
import PopupRecomendarMobilidade from '@/components/PopupRecomendarMobilidade'
import EstrelasAvaliacao from '@/components/EstrelasAvaliacao'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import {
  classificarTipoProfissionalCartao,
  normalizarCategoriasProfissional,
  resolverAcoesCartaoVisitaProfissional,
  resolverVisaoCartaoVisita,
} from '@/lib/cartaoVisitaProfissional'
import {
  normalizarVeiculoAno,
  normalizarVeiculoFotos,
  normalizarVeiculoModelo,
  profissionalElegivelPerfilMobilidade,
} from '@/lib/mobilidadePerfilProfissional'
import { labelIdiomaGuia, normalizarIdiomasGuia } from '@/lib/idiomasGuia'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

function formatMesAno(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Cache de extras do cartão (pastas veículo/idiomas) — evita flash ao abrir. */
const EXTRAS_CACHE_TTL_MS = 5 * 60 * 1000
/** @type {Map<string, { at: number, idiomas: string[], veiculo: { fotos: string[], modelo: string, ano: number | null } | null, empresaHospedagem: { id: string, nomeFantasia: string, username: string | null, fotoUrl: string | null, notaMedia: number | null } | null }>} */
const extrasCartaoCache = new Map()

function lerExtrasCache(profileId) {
  const hit = extrasCartaoCache.get(profileId)
  if (!hit) return null
  if (Date.now() - hit.at > EXTRAS_CACHE_TTL_MS) {
    extrasCartaoCache.delete(profileId)
    return null
  }
  return hit
}

function montarVeiculo(row) {
  const fotos = normalizarVeiculoFotos(row?.veiculo_fotos)
  const modelo = normalizarVeiculoModelo(row?.veiculo_modelo)
  const ano = normalizarVeiculoAno(row?.veiculo_ano)
  if (fotos.length > 0 || modelo || ano != null) return { fotos, modelo, ano }
  return null
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
 *  turistaPodeAvaliarProfissional?: boolean
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
  turistaPodeAvaliarProfissional = false,
  cidadeAtuacaoVisitado = null,
  idiomas: idiomasProp = null,
  onContratar,
  onAvaliacaoConcluida,
}) {
  useModalScrollLock(aberto)
  const router = useRouter()
  const [modo, setModo] = useState(/** @type {'cartao' | 'avaliar'} */ ('cartao'))
  const [notaUsuario, setNotaUsuario] = useState(0)
  const [feedbackUsuario, setFeedbackUsuario] = useState('')
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false)
  const [erroAvaliacao, setErroAvaliacao] = useState('')
  const [jaAvaliou, setJaAvaliou] = useState(false)
  const [checandoJaAvaliou, setChecandoJaAvaliou] = useState(false)
  const [popupRecomendarAberto, setPopupRecomendarAberto] = useState(false)
  const [popupMobilidadeAberto, setPopupMobilidadeAberto] = useState(false)
  const [pastaVeiculoAberta, setPastaVeiculoAberta] = useState(false)
  const [pastaIdiomasAberta, setPastaIdiomasAberta] = useState(false)

  const idiomasDaProp = useMemo(() => normalizarIdiomasGuia(idiomasProp), [idiomasProp])
  const extrasCached = profileId ? lerExtrasCache(profileId) : null
  const [idiomasGuia, setIdiomasGuia] = useState(() =>
    extrasCached?.idiomas?.length ? extrasCached.idiomas : idiomasDaProp,
  )
  /** @type {[{ fotos: string[], modelo: string, ano: number | null } | null, Function]} */
  const [veiculo, setVeiculo] = useState(() => extrasCached?.veiculo ?? null)
  /** @type {[{ id: string, nomeFantasia: string, username: string | null, fotoUrl: string | null, notaMedia: number | null } | null, Function]} */
  const [empresaHospedagem, setEmpresaHospedagem] = useState(() => extrasCached?.empresaHospedagem ?? null)
  const [extrasProntos, setExtrasProntos] = useState(() => extrasCached != null || idiomasDaProp.length > 0)

  const verificado = profissionalVerificado === true
  const mesAnoCadastro = formatMesAno(cadastradoEm ?? verificadoEm)
  const u = String(username ?? '').trim().replace(/^@+/, '')
  const uShown = u.length > 15 ? `${u.slice(0, 15)}…` : u
  const rotuloCategoria = formatProfissionalCategorias(categorias)
  const catsNorm = normalizarCategoriasProfissional(categorias)
  const ehGuia = catsNorm.includes('guia')
  const ehMobilidade = profissionalElegivelPerfilMobilidade(placaVermelha, categorias)
  const ehAnfitriao =
    classificarTipoProfissionalCartao(placaVermelha, categorias) === 'anfitriao' ||
    catsNorm.includes('anfitriao')
  const precisaExtras = verificado && (ehGuia || ehMobilidade || ehAnfitriao)

  /** Prefetch mesmo com o popup fechado — ao abrir, pastas já vêm no cartão. */
  useEffect(() => {
    if (!profileId || !verificado) {
      setExtrasProntos(true)
      return
    }
    if (!ehGuia && !ehMobilidade && !ehAnfitriao) {
      setExtrasProntos(true)
      return
    }

    const cached = lerExtrasCache(profileId)
    if (cached) {
      setIdiomasGuia(cached.idiomas)
      setVeiculo(cached.veiculo)
      setEmpresaHospedagem(cached.empresaHospedagem)
      setExtrasProntos(true)
      return
    }
    if (idiomasDaProp.length > 0) setIdiomasGuia(idiomasDaProp)

    let ativo = true
    setExtrasProntos(false)
    void (async () => {
      const cols = [
        ehGuia ? 'idiomas' : null,
        ehMobilidade ? 'veiculo_fotos, veiculo_modelo, veiculo_ano' : null,
        ehAnfitriao ? 'empresa_hospedagem_id' : null,
      ]
        .filter(Boolean)
        .join(', ')
      const { data, error } = await supabase
        .from('profissionais')
        .select(cols)
        .eq('usuario_id', profileId)
        .maybeSingle()
      if (!ativo) return
      if (error) {
        console.error('[CartaoVisita] extras:', error.message)
        setIdiomasGuia(idiomasDaProp)
        setVeiculo(null)
        setEmpresaHospedagem(null)
        setExtrasProntos(true)
        return
      }

      const idiomas = ehGuia
        ? normalizarIdiomasGuia(data?.idiomas).length
          ? normalizarIdiomasGuia(data?.idiomas)
          : idiomasDaProp
        : []
      const veiculoNovo = ehMobilidade ? montarVeiculo(data) : null

      let empresaNova = null
      const empId =
        ehAnfitriao && data?.empresa_hospedagem_id != null
          ? String(data.empresa_hospedagem_id).trim()
          : ''
      if (empId) {
        const { data: emp, error: empErr } = await supabase
          .from('empresas')
          .select('id, nome_fantasia, nome_usuario, foto_url, nota_media')
          .eq('id', empId)
          .maybeSingle()
        if (!ativo) return
        if (empErr) console.error('[CartaoVisita] empresa:', empErr.message)
        if (emp?.id) {
          const usernameEmp = String(emp.nome_usuario ?? '')
            .replace(/^@+/, '')
            .trim()
          const nota =
            emp.nota_media != null && Number.isFinite(Number(emp.nota_media))
              ? Number(emp.nota_media)
              : null
          empresaNova = {
            id: String(emp.id),
            nomeFantasia: String(emp.nome_fantasia ?? 'Empresa'),
            username: usernameEmp || null,
            fotoUrl:
              emp.foto_url != null && String(emp.foto_url).trim() ? String(emp.foto_url) : null,
            notaMedia: nota != null && nota > 0 ? nota : null,
          }
        }
      }

      if (!ativo) return
      setIdiomasGuia(idiomas)
      setVeiculo(veiculoNovo)
      setEmpresaHospedagem(empresaNova)
      extrasCartaoCache.set(profileId, {
        at: Date.now(),
        idiomas,
        veiculo: veiculoNovo,
        empresaHospedagem: empresaNova,
      })
      setExtrasProntos(true)
    })()
    return () => {
      ativo = false
    }
  }, [profileId, verificado, ehGuia, ehMobilidade, ehAnfitriao, idiomasDaProp])

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
        turistaPodeAvaliarProfissional,
      }),
    [
      visao,
      verificado,
      visitantePlacaVermelha,
      visitanteCategorias,
      placaVermelha,
      categorias,
      temParceriaFechada,
      turistaPodeAvaliarProfissional,
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

  const mostrarAcoes =
    acoes.mostrarContratar ||
    acoes.mostrarRecomendar ||
    acoes.mostrarRecomendarMobilidade ||
    acoes.mostrarAvaliar

  const botoesAcaoCartao = mostrarAcoes ? (
    <div className="mx-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-2">
      {acoes.mostrarContratar ? (
        <div className="rounded-[0.9rem] bg-white p-0.5">
          <button
            type="button"
            onClick={() => onContratar?.()}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white"
            style={{ backgroundColor: '#00D443' }}
          >
            <Briefcase size={20} className="shrink-0" strokeWidth={2.25} aria-hidden />
            CONTRATAR PROFISSIONAL
          </button>
        </div>
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
          onClick={() => setModo('avaliar')}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white hover:opacity-95"
          style={{ backgroundColor: '#00D443' }}
        >
          <Star size={20} className="shrink-0" fill="currentColor" strokeWidth={1.75} aria-hidden />
          AVALIAR PROFISSIONAL
        </button>
      ) : null}
    </div>
  ) : null

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
    if (!aberto) {
      resetAvaliacao()
      setPastaVeiculoAberta(false)
      setPastaIdiomasAberta(false)
    }
  }, [aberto, resetAvaliacao])

  useEffect(() => {
    if (!aberto) return
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    const anterior = meta.getAttribute('content')
    meta.setAttribute('content', '#ffffff')
    return () => {
      meta.setAttribute('content', anterior || '#0097b2')
    }
  }, [aberto])

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


  if (!aberto) return null

  const headerBtnTop = 'top-[max(0.75rem,env(safe-area-inset-top,0px))]'

  const avatarCartao = (
    <div className="flex justify-center">
      <div className="rounded-2xl bg-white p-[3px]">
        <div className="relative h-28 w-28 overflow-hidden rounded-2xl bg-gray-100">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt="" fill className="object-cover" sizes="112px" />
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div
        className="fixed inset-0 z-[240] flex flex-col bg-white"
        style={{ height: 'var(--app-height, 100dvh)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Cartão de visita"
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-safe pb-2">
          {modo === 'avaliar' ? (
            <>
              <button
                type="button"
                onClick={() => setModo('cartao')}
                className={`absolute left-3 ${headerBtnTop} rounded-full p-1 text-gray-500 transition hover:bg-gray-100`}
                aria-label="Voltar ao cartão de visita"
              >
                <ChevronLeft size={22} strokeWidth={2} aria-hidden />
              </button>
              <h2 className="px-10 pt-2 text-center text-xl font-bold leading-tight text-[#0097b2]">Avaliar Profissional</h2>
            </>
          ) : verificado ? (
            <div className="flex flex-col items-center justify-center gap-0 pt-2 leading-tight">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#00D443]" fill="currentColor" stroke="white" strokeWidth={2} aria-hidden />
                <h2 className="text-xl font-bold tracking-wide text-[#00D443]">VERIFICADO</h2>
              </div>
              <p className="px-4 text-center text-sm leading-tight text-gray-600">
                {mesAnoCadastro ? (
                  <>
                    desde <span className="font-semibold text-gray-800">{mesAnoCadastro}</span>
                  </>
                ) : (
                  'Profissional verificado'
                )}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 pt-2">
              <EscudoVerificacaoPendente className="h-6 w-6" iconSize={20} />
              <h2 className="text-xl font-bold tracking-wide text-[#F44336]">EM ANÁLISE</h2>
            </div>
          )}
          <button
            type="button"
            onClick={fecharPopup}
            className={`absolute right-3 ${headerBtnTop} rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-500`}
            aria-label="Fechar"
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-[#0097b2] px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] text-white sm:px-6 sm:py-6"
          data-modal-scroll-lock-scrollable
        >
            {modo === 'avaliar' ? (
              <div className="flex flex-col items-center">
                <div className="mt-2">{avatarCartao}</div>
                <p className="mt-3 line-clamp-2 text-center text-lg font-bold text-white">{nome || 'Profissional'}</p>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/90">
                  {paisBandeira ? (
                    <span className="shrink-0 text-base leading-none" aria-hidden>
                      {paisBandeira}
                    </span>
                  ) : null}
                  <span>@{uShown || 'usuario'}</span>
                </p>

                {checandoJaAvaliou ? (
                  <p className="mt-8 text-sm text-white/80">Carregando…</p>
                ) : jaAvaliou ? (
                  <p className="mt-8 text-center text-sm text-white/90">Você já avaliou este profissional.</p>
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
                          <p className="mt-2 text-center text-sm text-red-200">{erroAvaliacao}</p>
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
              extrasProntos || !precisaExtras ? (
              <>
                <div className="flex flex-col items-center">
                  <p className="w-full whitespace-normal px-1 text-center text-2xl font-bold leading-snug tracking-wide text-white sm:text-3xl">
                    {rotuloCategoria}
                  </p>
                  <div className="mt-0.5 inline-flex items-baseline justify-center gap-1">
                    <Star className="h-5 w-5 shrink-0 translate-y-[1px] fill-white text-white" aria-hidden />
                    <span className="text-xl font-bold leading-none text-white">
                      {total ? media.toFixed(1).replace('.', ',') : '—'}
                    </span>
                    <span className="text-sm leading-none text-white/90">({total} avaliações)</span>
                  </div>
                  <div className="mt-3">{avatarCartao}</div>
                  <div className="mt-3 flex min-w-0 flex-col items-center gap-0.5">
                    <p className="line-clamp-2 px-1 text-center text-lg font-bold leading-tight text-white sm:text-xl">
                      {nome || 'Profissional'}
                    </p>
                    <p className="flex items-center justify-center gap-1.5 text-sm leading-tight text-white/90 sm:text-base">
                      {paisBandeira ? (
                        <span className="shrink-0 text-base leading-none" aria-hidden>
                          {paisBandeira}
                        </span>
                      ) : null}
                      <span className="truncate">@{uShown || 'usuario'}</span>
                    </p>
                  </div>
                </div>

                {veiculo || (ehGuia && idiomasGuia.length > 0) ? (
                  <div className="mt-5 flex flex-col gap-2">
                    {veiculo ? (
                      <ChevronPasta
                        titulo="Veículo"
                        icone={Car}
                        fundo="branco"
                        corTitulo="#0097b2"
                        aberto={pastaVeiculoAberta}
                        onToggle={() => setPastaVeiculoAberta((v) => !v)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
                            {veiculo.fotos[0] ? (
                              <AvatarImage
                                src={veiculo.fotos[0]}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[#0097b2]">
                                <Car className="h-6 w-6" aria-hidden />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-gray-900">
                              {veiculo.modelo || 'Veículo'}
                            </p>
                            {veiculo.ano != null ? (
                              <p className="mt-0.5 text-xs text-gray-500">{veiculo.ano}</p>
                            ) : null}
                          </div>
                        </div>
                      </ChevronPasta>
                    ) : null}

                    {ehGuia && idiomasGuia.length > 0 ? (
                      <ChevronPasta
                        titulo="Idiomas"
                        icone={Languages}
                        fundo="branco"
                        corTitulo="#0097b2"
                        aberto={pastaIdiomasAberta}
                        onToggle={() => setPastaIdiomasAberta((v) => !v)}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {idiomasGuia.map((cod) => (
                            <span
                              key={cod}
                              className="inline-flex items-center rounded-full bg-[#0097b2]/10 px-2.5 py-1 text-xs font-semibold text-[#0097b2]"
                            >
                              {labelIdiomaGuia(cod)}
                            </span>
                          ))}
                        </div>
                      </ChevronPasta>
                    ) : null}
                  </div>
                ) : null}

                {empresaHospedagem ? (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                      <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                      <span>Empresa de hospedagem</span>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-white/25 bg-white p-2.5 shadow-sm">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-[#0097b2]/20 bg-gray-50">
                        {empresaHospedagem.fotoUrl ? (
                          <AvatarImage
                            src={empresaHospedagem.fotoUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden pr-1">
                        <p className="truncate text-sm font-bold leading-tight text-[#001f3f]">
                          {empresaHospedagem.nomeFantasia}
                        </p>
                        {empresaHospedagem.username ? (
                          <p className="mt-0.5 truncate text-xs leading-tight text-gray-600">
                            @{empresaHospedagem.username}
                          </p>
                        ) : null}
                        {empresaHospedagem.notaMedia != null ? (
                          <p className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold text-amber-500">
                            <span aria-hidden>★</span>
                            {empresaHospedagem.notaMedia.toFixed(1).replace(/\.0$/, '')}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          fecharPopup()
                          router.push(`/empresa/${empresaHospedagem.id}`)
                        }}
                        className="flex h-11 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg bg-[#0097b2] px-1 text-center text-[10px] font-bold leading-tight text-white"
                      >
                        <span>VISITAR</span>
                        <span>PÁGINA</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {modo === 'cartao' ? botoesAcaoCartao : null}
              </>
              ) : (
                <div className="min-h-[12rem]" aria-busy="true" aria-label="Carregando cartão de visita" />
              )
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                {avatarCartao}
                <div className="flex min-w-0 flex-col items-center gap-0.5">
                  <p className="line-clamp-2 max-w-md text-lg font-bold text-white sm:text-xl">{nome || 'Profissional'}</p>
                  <p className="flex items-center justify-center gap-1.5 truncate text-sm text-white/90 sm:text-base">
                    {paisBandeira ? (
                      <span className="shrink-0 text-base leading-none" aria-hidden>
                        {paisBandeira}
                      </span>
                    ) : null}
                    <span className="truncate">@{uShown || 'usuario'}</span>
                  </p>
                </div>
                <p className="max-w-md px-1 text-sm leading-relaxed text-white/85">
                  Novo perfil profissional cadastrado. Usuário aguarda verificação da plataforma.
                </p>
              </div>
            )}
        </div>
      </div>

      {profissionalRecomendacao ? (
        <PopupRecomendarProfissional
          aberto={popupRecomendarAberto}
          onFechar={() => setPopupRecomendarAberto(false)}
          profissional={profissionalRecomendacao}
          origemIndicacao="cartao_visita"
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
