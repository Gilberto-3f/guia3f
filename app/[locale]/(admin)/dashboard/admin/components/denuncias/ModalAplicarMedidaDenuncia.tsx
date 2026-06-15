'use client'

import { useState } from 'react'
import { Ban, CircleOff, MessageSquare, Trash2, UserX, X } from 'lucide-react'
import type { MedidaDenunciaTipo } from '../../types/admin.types'

const COR_LOGO = '#0097b2'
const COR_ARQUIVAR = '#00D443'

const OPCOES: { id: MedidaDenunciaTipo; label: string; Icon: typeof MessageSquare }[] = [
  {
    id: 'improcedente',
    label: 'Denúncia Improcedente',
    Icon: CircleOff,
  },
  {
    id: 'mensagem',
    label: 'Enviar Mensagem',
    Icon: MessageSquare,
  },
  {
    id: 'excluir_conteudo',
    label: 'Excluir Publicação',
    Icon: Trash2,
  },
  {
    id: 'bloqueio',
    label: 'Bloquear Conta do Usuário',
    Icon: Ban,
  },
  {
    id: 'excluir_cadastro',
    label: 'Excluir Cadastro',
    Icon: UserX,
  },
]

export default function ModalAplicarMedidaDenuncia({
  aberto,
  onClose,
  onConfirmar,
}: {
  aberto: boolean
  onClose: () => void
  onConfirmar: (medida: MedidaDenunciaTipo, texto?: string) => Promise<void>
}) {
  const [medida, setMedida] = useState<MedidaDenunciaTipo | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!aberto) return null

  const precisaTexto = medida === 'mensagem' || medida === 'excluir_conteudo'

  const confirmar = async () => {
    if (!medida) return
    if (precisaTexto && !texto.trim()) return
    setEnviando(true)
    try {
      await onConfirmar(medida, texto.trim() || undefined)
      setMedida(null)
      setTexto('')
      onClose()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={() => !enviando && onClose()} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">Aplicar medida</h2>
          <button type="button" onClick={onClose} disabled={enviando} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm font-medium" style={{ color: COR_LOGO }}>
          Selecione a medida a ser aplicada nesta denúncia.
        </p>

        <div className="mt-4 space-y-3">
          {OPCOES.map((o) => {
            const Icon = o.Icon
            const active = medida === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setMedida(o.id)}
                className={[
                  'flex w-full items-center gap-3 rounded-xl p-3 text-left text-white transition',
                  active ? 'ring-2 ring-offset-2' : 'opacity-95 hover:opacity-100',
                ].join(' ')}
                style={{
                  backgroundColor: COR_LOGO,
                  ...(active ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${COR_LOGO}` } : {}),
                }}
              >
                <Icon className="h-5 w-5 shrink-0 text-white" aria-hidden />
                <span className="text-sm font-bold">{o.label}</span>
              </button>
            )
          })}
        </div>

        {precisaTexto ? (
          <div className="mt-4">
            <label className="text-sm font-semibold" style={{ color: COR_LOGO }}>
              {medida === 'mensagem' ? 'Mensagem ao usuário' : 'Motivo da exclusão (notificação)'}
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, 500))}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900"
                placeholder="Escreva o texto…"
              />
            </label>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!medida || enviando || (precisaTexto && !texto.trim())}
          onClick={() => void confirmar()}
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: COR_ARQUIVAR }}
        >
          {enviando ? 'Aplicando…' : medida === 'improcedente' ? 'Classificar e arquivar' : 'Confirmar medida'}
        </button>
      </div>
    </div>
  )
}
