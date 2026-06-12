'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { carregarConteudoDenuncia, tituloDenunciaConteudo, type ConteudoDenunciaPreview } from '@/lib/carregarConteudoDenuncia'
import type { Denuncia, MedidaDenunciaTipo } from '../../types/admin.types'
import ModalAplicarMedidaDenuncia from './ModalAplicarMedidaDenuncia'

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PreviewConteudo({ conteudo }: { conteudo: ConteudoDenunciaPreview }) {
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      {conteudo.texto ? <p className="whitespace-pre-wrap text-sm text-gray-800">{conteudo.texto}</p> : null}
      {conteudo.nota != null ? (
        <p className="mt-2 text-sm font-semibold text-amber-700">Nota: {conteudo.nota}/5</p>
      ) : null}
      {conteudo.meta ? <p className="mt-1 text-xs text-gray-500">{conteudo.meta}</p> : null}
      {conteudo.imagemUrl ? (
        <div className="relative mt-3 aspect-video max-h-64 w-full overflow-hidden rounded-lg">
          <Image src={conteudo.imagemUrl} alt="" fill className="object-contain" unoptimized />
        </div>
      ) : null}
      {conteudo.videoUrl ? (
        <video src={conteudo.videoUrl} controls className="mt-3 max-h-64 w-full rounded-lg" />
      ) : null}
    </div>
  )
}

export default function CardDenuncia({
  denuncia,
  onAssumir,
  onAplicarMedida,
  onArquivar,
}: {
  denuncia: Denuncia
  onAssumir: () => Promise<void>
  onAplicarMedida: (medida: MedidaDenunciaTipo, texto?: string) => Promise<void>
  onArquivar: () => Promise<void>
}) {
  const [expandido, setExpandido] = useState(false)
  const [conteudo, setConteudo] = useState<ConteudoDenunciaPreview | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [modalMedida, setModalMedida] = useState(false)
  const [processando, setProcessando] = useState(false)

  const titulo = tituloDenunciaConteudo(denuncia.conteudo_tipo, denuncia.denunciado_tipo)
  const podeArquivar = Boolean(denuncia.medida_aplicada)

  const toggleVerificar = async () => {
    if (expandido) {
      setExpandido(false)
      return
    }
    setExpandido(true)
    if (!conteudo) {
      setCarregando(true)
      try {
        if (denuncia.status === 'pendente') {
          await onAssumir()
        }
        const preview = await carregarConteudoDenuncia(supabase, {
          conteudoTipo: denuncia.conteudo_tipo ?? null,
          conteudoId: denuncia.conteudo_id ?? null,
          denunciadoTipo: denuncia.denunciado_tipo,
          denunciadoId: denuncia.denunciado_id,
        })
        setConteudo(preview)
      } finally {
        setCarregando(false)
      }
    } else if (denuncia.status === 'pendente') {
      await onAssumir()
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <h3 className="text-base font-bold text-[#0097b2]">{titulo}</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            <p>
              <span className="font-semibold">Denunciante:</span> @{denuncia.denunciante_nome || denuncia.denunciante_email.split('@')[0]}
            </p>
            <p>
              <span className="font-semibold">Denunciado:</span> @{denuncia.denunciado_username || denuncia.denunciado_nome}
            </p>
            <p>
              <span className="font-semibold">Data:</span> {formatarDataHora(denuncia.created_at)}
            </p>
            <p>
              <span className="font-semibold">Motivo:</span> {denuncia.motivo}
              {denuncia.descricao ? ` — ${denuncia.descricao}` : ''}
            </p>
            {denuncia.responsavel_email ? (
              <p className="text-xs text-gray-500">Responsável: {denuncia.responsavel_email}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void toggleVerificar()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0097b2]/30 bg-[#0097b2]/5 py-2.5 text-sm font-bold uppercase tracking-wide text-[#0097b2]"
          >
            Verificar denúncia
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {expandido ? (
          <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
            {carregando ? (
              <p className="text-sm text-gray-500">Carregando conteúdo…</p>
            ) : conteudo ? (
              <PreviewConteudo conteudo={conteudo} />
            ) : (
              <p className="text-sm text-gray-500">Conteúdo não disponível para visualização.</p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={processando}
                onClick={() => setModalMedida(true)}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: '#0097b2' }}
              >
                Aplicar medida
              </button>
              <button
                type="button"
                disabled={!podeArquivar || processando}
                onClick={async () => {
                  setProcessando(true)
                  try {
                    await onArquivar()
                  } finally {
                    setProcessando(false)
                  }
                }}
                className={[
                  'flex-1 rounded-xl py-3 text-sm font-bold',
                  podeArquivar
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400',
                ].join(' ')}
              >
                Arquivar
              </button>
            </div>
            {!podeArquivar ? (
              <p className="mt-2 text-center text-xs text-gray-500">Arquivar disponível após aplicar uma medida.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <ModalAplicarMedidaDenuncia
        aberto={modalMedida}
        onClose={() => setModalMedida(false)}
        onConfirmar={async (medida, texto) => {
          setProcessando(true)
          try {
            await onAplicarMedida(medida, texto)
          } finally {
            setProcessando(false)
          }
        }}
      />
    </>
  )
}
