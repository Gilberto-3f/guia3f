'use client'

import { useState } from 'react'
import Link from 'next/link'
import GridFotos from '@/components/atividades/GridFotos'
import ModalFotos from '@/components/atividades/ModalFotos'

/**
 * @param {{
 *   usernameAtor: string
 *   urls: string[]
 *   usuarioAtorId: string
 *   totalCurtidas?: number
 * }} props
 */
export default function AtividadeCurtidas({ usernameAtor, urls, usuarioAtorId, totalCurtidas }) {
  const [modal, setModal] = useState({ aberto: false, i: 0 })
  const n = totalCurtidas ?? urls.length
  if (n === 0) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-800">
        <span className="mr-1" aria-hidden>
          👤
        </span>
        <Link href={`/perfil/${usuarioAtorId}`} className="font-medium text-[#0097b2]">
          @{usernameAtor}
        </Link>{' '}
        curtiu {n === 1 ? '1 foto' : `${n} fotos`}
      </p>
      <div className="mt-3">
        <GridFotos
          urls={urls}
          max={10}
          onClickFoto={(i) => setModal({ aberto: true, i })}
        />
      </div>
      <button
        type="button"
        onClick={() => setModal({ aberto: true, i: 0 })}
        className="mt-3 text-sm font-medium text-[#0097b2]"
      >
        {n === 1 ? 'VER FOTO' : `VER TODAS AS ${n} FOTOS`}
      </button>
      <ModalFotos urls={urls} indiceInicial={modal.i} aberto={modal.aberto} onFechar={() => setModal((m) => ({ ...m, aberto: false }))} />
    </div>
  )
}
