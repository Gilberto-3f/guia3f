'use client'

import Link from 'next/link'

export default function DashboardAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900">Dashboard ADM</h1>
      <p className="mt-2 text-gray-600">Área administrativa do Guia 3F. Módulos em evolução.</p>
      <Link href="/guia" className="mt-6 inline-block text-[#0097b2]">
        Voltar ao app
      </Link>
    </div>
  )
}
