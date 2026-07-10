'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, Briefcase, Star, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import PopupComplementoContratacao, {
  type DadosComplementoContratacao,
} from '@/components/manifesto/PopupComplementoContratacao'
import { precisaDadosPaxManifesto } from '@/lib/recomendacaoContratacaoDestino'
import { categoriaProfissionalParaSlug } from '@/lib/canaisProfissionalSlugs'

const COR = '#0097b2'
const VERDE = '#00D443'

type ProfPopup = {
  nome: string
  username: string
  foto_url: string | null
  categorias: string
  nota_media: number
  total_avaliacoes: number
  placa_vermelha?: boolean
  categorias_raw?: string[]
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

function CardProf({ prof }: { prof: ProfPopup }) {
  const handle = prof.username.startsWith('@') ? prof.username : `@${prof.username}`
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-white" style={{ backgroundColor: COR }}>
      <div className="h-13 w-13 shrink-0 overflow-hidden rounded-lg border-2 border-white/80 bg-white/20">
        <AvatarImage
          src={prof.foto_url}
          alt=""
          width={52}
          height={52}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{prof.nome}</p>
        <p className="truncate text-sm text-white/90">{handle}</p>
        <p className="text-xs text-white/80">{prof.categorias}</p>
        {prof.total_avaliacoes > 0 ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-200">
            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden />
            {prof.nota_media.toFixed(1)} ({prof.total_avaliacoes})
          </p>
        ) : null}
      </div>
    </div>
  )
}

function categoriasDoIndicado(indicado: ProfPopup): string[] {
  if (Array.isArray(indicado.categorias_raw) && indicado.categorias_raw.length) {
    return indicado.categorias_raw
  }
  // Fallback: tenta parsear rótulo formatado ("Taxista · Guia")
  return String(indicado.categorias ?? '')
    .split(/[·,|/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => categoriaProfissionalParaSlug(s))
    .filter(Boolean)
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
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarComplemento, setMostrarComplemento] = useState(false)

  useEffect(() => {
    if (!aberto) {
      setMostrarComplemento(false)
      setErro('')
      setEnviando(false)
    }
  }, [aberto, jaContratado])

  if (!aberto || !indicador || !indicado) return null

  const cats = categoriasDoIndicado(indicado)
  const precisaPax = precisaDadosPaxManifesto(cats, Boolean(indicado.placa_vermelha))

  const redirecionarAposContratacao = (json: {
    redirect?: string | null
    api_url?: string | null
  }) => {
    onContratado?.()
    onFechar()
    if (json.api_url) {
      window.location.assign(String(json.api_url))
      return
    }
    const href = json.redirect ? String(json.redirect) : '/canal'
    router.push(href)
  }

  const executarContratacao = async (dados?: DadosComplementoContratacao) => {
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/contratar-recomendacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recomendacao_id: recomendacaoId,
          profissional_usuario_id: profissionalUsuarioId,
          nome_completo: dados?.nome_completo ?? '',
          data_nascimento: dados?.data_nascimento ?? '',
          documento: dados?.documento ?? '',
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        redirect?: string | null
        api_url?: string | null
      }
      if (!json.ok) {
        setErro(json.error ?? 'Não foi possível contratar.')
        return
      }
      setMostrarComplemento(false)
      redirecionarAposContratacao(json)
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
          <div className="flex min-w-0 items-center gap-2">
            <Briefcase className="h-5 w-5 shrink-0" style={{ color: COR }} aria-hidden />
            <h2 id="popup-contratar-rec-titulo" className="text-lg font-bold" style={{ color: COR }}>
              Indicação Profissional
            </h2>
          </div>
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

        <div className="mt-4">
          <CardProf prof={indicador} />
        </div>

        <p className="my-3 text-center text-sm font-semibold" style={{ color: COR }}>
          Indica o profissional
        </p>

        <CardProf prof={indicado} />

        {jaContratado ? (
          <p className="mt-4 rounded-xl bg-gray-50 px-3 py-3 text-center text-sm text-gray-600">
            Você já aceitou esta indicação. Use o canal de contratação do profissional.
          </p>
        ) : (
          <>
            {erro ? <p className="mt-3 text-sm text-rose-600">{erro}</p> : null}
            <button
              type="button"
              disabled={enviando}
              onClick={() => {
                setErro('')
                if (precisaPax) {
                  setMostrarComplemento(true)
                  return
                }
                void executarContratacao()
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: VERDE }}
            >
              <BadgeCheck className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
              {enviando ? 'Abrindo…' : 'Contratar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
