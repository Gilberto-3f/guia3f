'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

export type DadosComplementoContratacao = {
  nome_completo: string
  data_nascimento: string
  documento: string
}

type Props = {
  aberto: boolean
  onFechar: () => void
  onConfirmar: (dados: DadosComplementoContratacao) => void | Promise<void>
  nomeInicial?: string
  documentoInicial?: string
  enviando?: boolean
  erroServidor?: string
}

/** Popup para validar contratação com dados do manifesto físico (PAX). */
export default function PopupComplementoContratacao({
  aberto,
  onFechar,
  onConfirmar,
  nomeInicial = '',
  documentoInicial = '',
  enviando = false,
  erroServidor = '',
}: Props) {
  useModalScrollLock(aberto)
  const [nome, setNome] = useState(nomeInicial)
  const [dataNascimento, setDataNascimento] = useState('')
  const [documento, setDocumento] = useState(documentoInicial)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setNome(nomeInicial)
    setDocumento(documentoInicial)
    setDataNascimento('')
    setErro('')
  }, [aberto, nomeInicial, documentoInicial])

  if (!aberto) return null

  const confirmar = async () => {
    setErro('')
    if (!nome.trim() || !dataNascimento || !documento.trim()) {
      setErro('Preencha nome completo, data de nascimento e documento.')
      return
    }
    await onConfirmar({
      nome_completo: nome.trim(),
      data_nascimento: dataNascimento,
      documento: documento.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="complemento-contratacao-titulo"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="complemento-contratacao-titulo" className="text-lg font-bold text-gray-900">
              Dados para o manifesto
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Informe seus dados para o profissional preencher a lista de passageiros (aduanas).
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Nome completo</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              autoComplete="name"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Data de nascimento</span>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Documento (RG / passaporte)</span>
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {erro ? <p className="mt-3 text-sm text-rose-600">{erro}</p> : null}
        {!erro && erroServidor ? <p className="mt-3 text-sm text-rose-600">{erroServidor}</p> : null}

        <button
          type="button"
          disabled={enviando}
          onClick={() => void confirmar()}
          className="mt-5 w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
        >
          {enviando ? 'Confirmando...' : 'Confirmar contratação'}
        </button>
      </div>
    </div>
  )
}
