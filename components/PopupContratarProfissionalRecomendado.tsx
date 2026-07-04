'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, Star, X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import PopupComplementoContratacao, {
  type DadosComplementoContratacao,
} from '@/components/manifesto/PopupComplementoContratacao'

type ProfPopup = {
  nome: string
  username: string
  foto_url: string | null
  categorias: string
  nota_media: number
  total_avaliacoes: number
}

type Props = {
  aberto: boolean
  onFechar: () => void
  recomendacaoId: string
  profissionalUsuarioId: string
  indicador: ProfPopup | null
  indicado: ProfPopup | null
  jaContratado?: boolean
  onContratado?: () => void
}

function CardProf({ prof, destaque }: { prof: ProfPopup; destaque?: boolean }) {
  const handle = prof.username.startsWith('@') ? prof.username : `@${prof.username}`
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${destaque ? 'border-[#0097b2]/30 bg-[#0097b2]/5' : 'border-gray-200 bg-white'}`}
    >
      <AvatarImage
        src={prof.foto_url}
        alt=""
        width={52}
        height={52}
        className="h-13 w-13 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900">{prof.nome}</p>
        <p className="truncate text-sm text-[#0097b2]">{handle}</p>
        <p className="text-xs text-gray-500">{prof.categorias}</p>
        {prof.total_avaliacoes > 0 ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {prof.nota_media.toFixed(1)} ({prof.total_avaliacoes})
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function PopupContratarProfissionalRecomendado({
  aberto,
  onFechar,
  recomendacaoId,
  profissionalUsuarioId,
  indicador,
  indicado,
  jaContratado = false,
  onContratado,
}: Props) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(jaContratado)
  const [mostrarComplemento, setMostrarComplemento] = useState(false)

  useEffect(() => {
    if (!aberto) {
      setMostrarComplemento(false)
      setErro('')
      setEnviando(false)
    }
    setSucesso(jaContratado)
  }, [aberto, jaContratado])

  if (!aberto || !indicador || !indicado) return null

  const executarContratacao = async (dados: DadosComplementoContratacao) => {
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/contratar-recomendacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recomendacao_id: recomendacaoId,
          profissional_usuario_id: profissionalUsuarioId,
          nome_completo: dados.nome_completo,
          data_nascimento: dados.data_nascimento,
          documento: dados.documento,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        setErro(json.error ?? 'Não foi possível contratar.')
        return
      }
      setMostrarComplemento(false)
      setSucesso(true)
      onContratado?.()
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setEnviando(false)
    }
  }

  if (mostrarComplemento) {
    return (
      <PopupComplementoContratacao
        aberto
        onFechar={() => {
          if (enviando) return
          setMostrarComplemento(false)
        }}
        enviando={enviando}
        erroServidor={erro}
        onConfirmar={executarContratacao}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-[270] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-contratar-rec-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onFechar()
      }}
    >
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2">
            <h2 id="popup-contratar-rec-titulo" className="text-lg font-bold text-[#001f3f]">
              Indicação profissional
            </h2>
            <button
              type="button"
              onClick={onFechar}
              disabled={enviando}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <CardProf prof={indicador} />

          <p className="my-3 text-center text-sm font-medium text-gray-700">
            profissional recomenda o trabalho de outro colega:
          </p>

          <CardProf prof={indicado} destaque />

          {sucesso ? (
            <p className="mt-4 rounded-xl bg-[#00D443]/10 px-3 py-3 text-center text-sm font-semibold text-[#15803d]">
              Contratação registrada! Parceria formada e turista incluído no manifesto do profissional.
            </p>
          ) : (
            <>
              {erro ? <p className="mt-3 text-sm text-rose-600">{erro}</p> : null}
              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  setErro('')
                  setMostrarComplemento(true)
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83a] disabled:opacity-60"
              >
                <BadgeCheck className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
                Contratar
              </button>
            </>
          )}
        </div>
      </div>
  )
}
