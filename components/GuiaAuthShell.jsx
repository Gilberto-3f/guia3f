'use client'

import Logo from '@/components/Logo'

/**
 * Layout padrão: faixa superior #0097b2 com logo + área branca arredondada (sem “margem azul” ao redor do conteúdo).
 * @param {{ children: import('react').ReactNode, footer?: import('react').ReactNode, largeHeaderLogo?: boolean }} props
 */
export default function GuiaAuthShell({ children, footer = null, largeHeaderLogo = false }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0097b2]">
      <header className="shrink-0 bg-[#0097b2]">
        <Logo variant="header" largeHeader={largeHeaderLogo} />
      </header>
      <main className="flex min-h-0 flex-1 flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="mx-auto w-full max-w-md flex-1 px-5 py-6 pb-10 sm:px-6">{children}</div>
        {footer}
      </main>
    </div>
  )
}
