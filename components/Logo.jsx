'use client'

import Image from 'next/image'

/**
 * @param {{ variant?: 'default' | 'header' }} props
 * - default: barra branca (uso embutido em telas com fundo claro)
 * - header: só a logo, para cabeçalho sobre fundo #0097b2
 */
export default function Logo({ variant = 'default' }) {
  const img = (
    <Image
      src="/logo.png"
      alt="Guia 3F"
      width={150}
      height={50}
      className="h-auto max-h-12 w-auto object-contain sm:max-h-14"
      priority
    />
  )

  if (variant === 'header') {
    return <div className="flex justify-center px-4 py-5 sm:py-6">{img}</div>
  }

  return <div className="flex justify-center border-b border-gray-100 bg-white py-4">{img}</div>
}
