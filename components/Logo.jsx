'use client'

import Image from 'next/image'

export default function Logo() {
  return (
    <div className="flex justify-center py-4 bg-white border-b border-gray-100">
      <Image
        src="/logo.png"
        alt="Guia 3F"
        width={150}
        height={50}
        className="h-auto w-auto object-contain"
        priority
      />
    </div>
  )
}
