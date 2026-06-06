'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  montarEnderecoEmpresa,
  registrarRecomendacaoEmpresa,
  urlEmpresaRecomendacao,
  type EmpresaRecomendacaoInfo,
} from '@/lib/recomendarEmpresa'
import { digitsWhatsapp, mensagemWhatsappRecomendacao, openWhatsAppChat } from '@/lib/whatsapp-empresa'

type Props = {
  aberto: boolean
  onFechar: () => void
  empresa: EmpresaRecomendacaoInfo
  segmentoGuiaSlug?: string | null
}

export default function PopupRecomendar({ aberto, onFechar, empresa, segmentoGuiaSlug }: Props) {
  const [whatsappTurista, setWhatsappTurista] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  if (!aberto) return null

  const fechar = () => {
    if (enviando) return
    setErro('')
    setWhatsappTurista('')
    onFechar()
  }

  const enviar = async () => {
    const phone = digitsWhatsapp(whatsappTurista)
    if (phone.length < 10) {
      setErro('Informe um WhatsApp válido com DDD.')
      return
    }

    setEnviando(true)
    setErro('')

    try {
      const { profissionalUsername } = await registrarRecomendacaoEmpresa(supabase, {
        empresaId: empresa.id,
        segmentoGuiaSlug,
        categoriaEmpresa: empresa.categoria,
      })

      const empresaUrl = urlEmpresaRecomendacao(empresa.id)
      const mensagem = mensagemWhatsappRecomendacao({
        empresaNome: String(empresa.nome_fantasia ?? 'Atrativo'),
        empresaUrl,
        profissionalUsername,
        nota: empresa.nota_media,
        totalAvaliacoes: empresa.total_avaliacoes,
        categoria: empresa.categoria,
        endereco: montarEnderecoEmpresa(empresa),
        username: empresa.nome_usuario,
      })

      const ok = openWhatsAppChat(phone, mensagem)
      if (!ok) {
        setErro('Não foi possível abrir o WhatsApp.')
        return
      }

      setWhatsappTurista('')
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar recomendação.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-recomendar-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar()
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="popup-recomendar-titulo" className="text-lg font-extrabold text-[#001f3f]">
              Recomendar atrativo
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Envie o link do guia para o WhatsApp do turista que você está atendendo.
            </p>
          </div>
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

        <label className="mt-4 block text-xs font-semibold text-gray-700" htmlFor="whatsapp-turista-recomendar">
          WhatsApp do turista
        </label>
        <input
          id="whatsapp-turista-recomendar"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(45) 99999-9999"
          value={whatsappTurista}
          onChange={(e) => setWhatsappTurista(e.target.value)}
          className="mt-1 w-full rounded-lg bg-[#0097b2] px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:ring-2 focus:ring-[#0097b2]/40"
        />

        {erro ? <p className="mt-2 text-center text-sm text-red-600">{erro}</p> : null}

        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviar()}
          className="mt-4 w-full rounded-lg bg-[#00D443] py-2.5 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
