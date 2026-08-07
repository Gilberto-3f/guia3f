'use client'

import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  registrarRecomendacaoProfissional,
  rotuloCategoriaProfissionalRecomendacao,
  urlProfissionalRecomendacao,
} from '@/lib/recomendarProfissional'
import {
  montarTelefoneComDdi,
  PAISES_TELEFONE_RECOMENDACAO,
  paisTelefonePorId,
} from '@/lib/paisesTelefoneRecomendacao'
import { mensagemWhatsappRecomendacaoProfissional, openWhatsAppChat } from '@/lib/whatsapp-empresa'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profissional: import('@/lib/recomendarProfissional').ProfissionalRecomendacaoInfo
 *   origemIndicacao?: 'cartao_visita' | 'ecossistema'
 * }} props
 */
export default function PopupRecomendarProfissional({
  aberto,
  onFechar,
  profissional,
  origemIndicacao = 'cartao_visita',
}) {
  const [paisId, setPaisId] = useState('br')
  const [paisMenuAberto, setPaisMenuAberto] = useState(false)
  const [contatoLocal, setContatoLocal] = useState('')
  const [emailTurista, setEmailTurista] = useState('')
  const [modoContato, setModoContato] = useState('whatsapp')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  if (!aberto) return null

  const pais = paisTelefonePorId(paisId)

  const resetar = () => {
    setContatoLocal('')
    setEmailTurista('')
    setModoContato('whatsapp')
    setPaisId('br')
    setPaisMenuAberto(false)
    setErro('')
  }

  const fechar = () => {
    if (enviando) return
    resetar()
    onFechar()
  }

  const montarMensagem = (indicadorUsername, recomendacaoId) =>
    mensagemWhatsappRecomendacaoProfissional({
      profissionalNome: String(profissional.nome ?? 'Profissional'),
      profissionalUrl: urlProfissionalRecomendacao(profissional.usuarioId, recomendacaoId),
      indicadorUsername,
      nota: profissional.notaMedia,
      totalAvaliacoes: profissional.totalAvaliacoes,
      categoria: rotuloCategoriaProfissionalRecomendacao(profissional.categorias),
      username: profissional.nomeUsuario,
      paisBandeira: profissional.paisBandeira,
    })

  const enviar = async () => {
    setEnviando(true)
    setErro('')

    try {
      if (modoContato === 'email') {
        const email = emailTurista.trim().toLowerCase()
        if (!email || !email.includes('@')) {
          setErro('Informe um e-mail válido.')
          return
        }

        const { profissionalUsername, recomendacaoId } = await registrarRecomendacaoProfissional(supabase, {
          profissionalIndicadoId: profissional.id,
          emailTurista: email,
          origemIndicacao,
        })

        const mensagem = montarMensagem(profissionalUsername, recomendacaoId)
        const subject = encodeURIComponent(`Recomendação: ${profissional.nome ?? 'Profissional'}`)
        const body = encodeURIComponent(mensagem)
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`

        resetar()
        onFechar()
        return
      }

      const phone = montarTelefoneComDdi(pais.ddi, contatoLocal)
      if (phone.length < 10) {
        setErro('Informe um WhatsApp válido com DDD ou número local.')
        return
      }

      const { profissionalUsername, recomendacaoId } = await registrarRecomendacaoProfissional(supabase, {
        profissionalIndicadoId: profissional.id,
        whatsappTurista: phone,
        origemIndicacao,
      })

      const mensagem = montarMensagem(profissionalUsername, recomendacaoId)
      const ok = openWhatsAppChat(phone, mensagem)
      if (!ok) {
        setErro('Não foi possível abrir o WhatsApp.')
        return
      }

      resetar()
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar recomendação.')
    } finally {
      setEnviando(false)
    }
  }

  const alternarModoContato = () => {
    setModoContato((m) => (m === 'whatsapp' ? 'email' : 'whatsapp'))
    setErro('')
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-recomendar-prof-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar()
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 id="popup-recomendar-prof-titulo" className="text-lg font-extrabold text-[#001f3f]">
            Recomendar profissional
          </h3>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            onClick={fechar}
            aria-label="Fechar"
            disabled={enviando}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-center text-sm text-gray-600">
          Indique <span className="font-semibold">{profissional.nome ?? 'este profissional'}</span> para um turista.
        </p>

        <label
          className="mt-4 block text-xs font-semibold text-gray-700"
          htmlFor={modoContato === 'whatsapp' ? 'contato-turista-recomendar-prof' : 'email-turista-recomendar-prof'}
        >
          {modoContato === 'whatsapp' ? 'WhatsApp do turista' : 'E-mail do turista'}
        </label>

        {modoContato === 'whatsapp' ? (
          <div className="mt-1 flex gap-2">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPaisMenuAberto((v) => !v)}
                className="flex h-[42px] items-center gap-1 rounded-lg bg-[#0097b2] px-2.5 text-sm font-semibold text-white"
                aria-label={`País: ${pais.nome}`}
                aria-expanded={paisMenuAberto}
              >
                <span className="text-base leading-none">{pais.bandeira}</span>
                <span className="text-xs">+{pais.ddi}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </button>
              {paisMenuAberto ? (
                <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {PAISES_TELEFONE_RECOMENDACAO.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                        onClick={() => {
                          setPaisId(p.id)
                          setPaisMenuAberto(false)
                        }}
                      >
                        <span aria-hidden>{p.bandeira}</span>
                        <span className="flex-1 truncate">{p.nome}</span>
                        <span className="text-xs text-gray-500">+{p.ddi}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <input
              id="contato-turista-recomendar-prof"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={pais.placeholder}
              value={contatoLocal}
              onChange={(e) => setContatoLocal(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-[#0097b2] px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-[#0097b2]/40"
            />
          </div>
        ) : (
          <input
            id="email-turista-recomendar-prof"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="turista@email.com"
            value={emailTurista}
            onChange={(e) => setEmailTurista(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[#0097b2] px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-[#0097b2]/40"
          />
        )}

        {erro ? <p className="mt-2 text-center text-sm text-red-600">{erro}</p> : null}

        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviar()}
          className="mt-4 w-full rounded-lg bg-[#00D443] py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>

        <button
          type="button"
          onClick={alternarModoContato}
          className="mt-2 w-full text-center text-xs text-gray-500 underline decoration-gray-400 underline-offset-2 hover:text-gray-700"
        >
          {modoContato === 'whatsapp' ? 'Enviar no e-mail' : 'Enviar no WhatsApp'}
        </button>
      </div>
    </div>
  )
}
