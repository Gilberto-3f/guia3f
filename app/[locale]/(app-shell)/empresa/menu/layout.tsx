'use client'

import type { ReactNode } from 'react'
import { DashboardEmpresaProvider } from '@/app/[locale]/(app-shell)/dashboard/empresa/context/DashboardEmpresaContext'

/**
 * Um único fetch de empresa para todas as páginas do menu —
 * evita flash da UI genérica do Botão Dinâmico (Gate + Config cada um buscava de novo).
 */
export default function EmpresaMenuLayout({ children }: { children: ReactNode }) {
  return <DashboardEmpresaProvider>{children}</DashboardEmpresaProvider>
}
