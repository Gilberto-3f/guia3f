'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, Flag, MoreVertical, Pencil } from 'lucide-react'

/**
 * Menu da mensagem (estilo MenuPost — fundo azul logo, texto branco).
 * @param {{
 *   salvo?: boolean
 *   podeEditar?: boolean
 *   onEditar?: () => void
 *   onSalvar?: () => void
 *   onDenunciar?: () => void
 *   alinhadoDireita?: boolean
 * }} props
 */
export default function MenuMensagemCanal({
  salvo = false,
  podeEditar = false,
  onEditar,
  onSalvar,
  onDenunciar,
  alinhadoDireita = true,
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    const fechar = (e) => {
      if (ref.current && !ref.current.contains(/** @type {Node} */ (e.target))) setAberto(false)
    }
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [])

  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-white transition-colors hover:bg-[#007a8f]'

  return (
    <div className="relative shrink-0 self-center" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setAberto((v) => !v)
        }}
        className={`rounded-full p-1 text-gray-500 hover:bg-gray-100 max-md:opacity-100 ${
          aberto ? 'bg-gray-100 opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label="Opções da mensagem"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {aberto ? (
        <div
          className={`absolute top-full z-50 mt-1 w-52 min-w-[11rem] overflow-hidden rounded-lg bg-[#0097b2] py-1 text-white shadow-lg ${
            alinhadoDireita ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {podeEditar ? (
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                onEditar?.()
              }}
              className={itemClass}
            >
              <Pencil size={16} className="text-white" aria-hidden />
              <span>Editar</span>
            </button>
          ) : null}
          {onSalvar ? (
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                onSalvar()
              }}
              className={itemClass}
            >
              <Bookmark size={16} className={`text-white ${salvo ? 'fill-white' : ''}`} aria-hidden />
              <span>{salvo ? 'Remover dos salvos' : 'Salvar'}</span>
            </button>
          ) : null}
          {onDenunciar ? (
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                onDenunciar()
              }}
              className={itemClass}
            >
              <Flag size={16} className="text-white" aria-hidden />
              <span>Denunciar</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
