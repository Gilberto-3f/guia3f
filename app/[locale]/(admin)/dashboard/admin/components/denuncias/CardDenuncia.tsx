'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { carregarConteudoDenuncia, tituloDenunciaConteudo, type ConteudoDenunciaPreview } from '@/lib/carregarConteudoDenuncia'
import type { Denuncia, DenunciaGravidade, MedidaDenunciaTipo } from '../../types/admin.types'
import {
  NIVEIS_GRAVIDADE_DENUNCIA,
  LABEL_GRAVIDADE,
  formatarMotivoDenuncia,
  labelStatusDenunciaCard,
  classeStatusDenunciaCard,
} from '../../utils/denunciaUi'
import ModalAplicarMedidaDenuncia from './ModalAplicarMedidaDenuncia'
import ModalExpandirPublicacaoDenuncia from './ModalExpandirPublicacaoDenuncia'

const COR_ARQUIVAR = '#00D443'

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
  onGravidadeChange,
}: {
  denuncia: Denuncia
  onAssumir: () => Promise<void>
  onAplicarMedida: (medida: MedidaDenunciaTipo, texto?: string) => Promise<void>
  onArquivar: () => Promise<void>
  onGravidadeChange: (gravidade: DenunciaGravidade) => Promise<void>
}) {
  const [expandido, setExpandido] = useState(false)
  const [conteudo, setConteudo] = useState<ConteudoDenunciaPreview | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [modalMedida, setModalMedida] = useState(false)
  const [modalPublicacao, setModalPublicacao] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [gravidadeLocal, setGravidadeLocal] = useState<DenunciaGravidade | null>(denuncia.gravidade)

  useEffect(() => {
    setGravidadeLocal(denuncia.gravidade)
  }, [denuncia.gravidade, denuncia.id])

  const titulo = tituloDenunciaConteudo(denuncia.conteudo_tipo, denuncia.denunciado_tipo)
  const podeArquivar = Boolean(denuncia.medida_aplicada)
  const motivoExibicao = formatarMotivoDenuncia(denuncia.motivo, denuncia.descricao)
  const postId = denuncia.conteudo_tipo === 'post' && denuncia.conteudo_id ? denuncia.conteudo_id : null

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

  const selecionarGravidade = async (g: DenunciaGravidade) => {
    setGravidadeLocal(g)
    setProcessando(true)
    try {
      await onGravidadeChange(g)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-base font-bold text-[#0097b2]">{titulo}</h3>
                <span className={`text-xs font-bold uppercase ${classeStatusDenunciaCard(denuncia.status)}`}>
                  {labelStatusDenunciaCard(denuncia.status)}
                </span>
              </div>
              {denuncia.denunciado_tipo === 'profissional' && denuncia.denunciado_categoria ? (
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#001f3f]">
                  {denuncia.denunciado_categoria}
                </p>
              ) : null}
            </div>
            {gravidadeLocal ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-900">
                {LABEL_GRAVIDADE[gravidadeLocal]}
              </span>
            ) : null}
          </div>

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
              <span className="font-semibold">Motivo:</span> {motivoExibicao}
            </p>
            {denuncia.responsavel_email ? (
              <p className="text-xs text-gray-500">Responsável: {denuncia.responsavel_email}</p>
            ) : null}
          </div>

          {postId ? (
            <button
              type="button"
              onClick={() => setModalPublicacao(true)}
              className="mt-3 text-sm font-semibold text-[#0097b2] hover:underline"
            >
              Expandir Publicação
            </button>
          ) : null}

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

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Nível da denúncia</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {NIVEIS_GRAVIDADE_DENUNCIA.map((n) => {
                  const active = gravidadeLocal === n.id
                  return (
                    <button
                      key={n.id}
                      type="button"
                      disabled={processando}
                      onClick={() => void selecionarGravidade(n.id)}
                      className={[
                        'rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition',
                        active
                          ? 'bg-[#0097b2] text-white shadow-sm'
                          : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {n.label}
                    </button>
                  )
                })}
              </div>
            </div>

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
                  'flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50',
                  podeArquivar ? '' : 'cursor-not-allowed opacity-40',
                ].join(' ')}
                style={{ backgroundColor: podeArquivar ? COR_ARQUIVAR : '#d1d5db' }}
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

      <ModalExpandirPublicacaoDenuncia
        aberto={modalPublicacao}
        postId={postId}
        onClose={() => setModalPublicacao(false)}
      />
    </>
  )
}
