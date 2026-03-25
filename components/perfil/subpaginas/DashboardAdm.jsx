'use client'

import Link from 'next/link'

export default function DashboardAdm() {
  return (
    <div className="space-y-4 px-1">
      <p className="text-sm text-gray-600">Painel administrativo completo na web.</p>
      <Link
        href="/dashboard/admin"
        className="block w-full rounded-xl bg-[#0097b2] py-3 text-center text-sm font-semibold text-white"
        onClick={() => {}}
      >
        Abrir Dashboard ADM
      </Link>
    </div>
  )
}
