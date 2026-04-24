'use client'

import { useState } from 'react'
import Image from 'next/image'
import ModalFotos from '@/components/atividades/ModalFotos'

/**
 * @param {{ fotosUrl: string[] }} props
 */
export default function AbaFotosEmpresa({ fotosUrl }) {
  const urls = Array.isArray(fotosUrl) ? fotosUrl.filter((u) => typeof u === 'string' && u.trim()) : []
  const [modal, setModal] = useState(/** @type {{ aberto: boolean, i: number }} */ ({ aberto: false, i: 0 }))

  if (urls.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhuma foto cadastrada</p>
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4">
        {urls.map((src, idx) => (
          <button
            key={`${src}-${idx}`}
            type="button"
            onClick={() => setModal({ aberto: true, i: idx })}
            className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0097b2] focus:ring-offset-2"
          >
            <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 768px) 33vw, 25vw" />
          </button>
        ))}
      </div>

      <ModalFotos urls={urls} indiceInicial={modal.i} aberto={modal.aberto} onFechar={() => setModal((m) => ({ ...m, aberto: false }))} />
    </div>
  )
}
