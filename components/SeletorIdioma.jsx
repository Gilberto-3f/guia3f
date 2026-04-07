'use client'

import { useEffect, useRef, useState } from 'react'
import { setCookie } from 'cookies-next'
import { ChevronDown } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useLocale } from 'next-intl'

const opcoesIdioma = [
  { value: 'pt', bandeira: '🇧🇷', rotulo: 'Português' },
  { value: 'en', bandeira: '🇺🇸', rotulo: 'English' },
  { value: 'es', bandeira: '🇪🇸', rotulo: 'Español' },
]

/**
 * Seletor de idioma (pt / en / es) para páginas de auth. Persiste em cookie NEXT_LOCALE.
 */
export default function SeletorIdioma() {
  const router = useRouter()
  const locale = useLocale()
  const [menuAberto, setMenuAberto] = useState(false)
  const ref = useRef(null)

  const idiomaAtual = opcoesIdioma.find((o) => o.value === locale) ?? opcoesIdioma[0]

  useEffect(() => {
    const fechar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setMenuAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  const mudarIdioma = (value) => {
    setCookie('NEXT_LOCALE', value, { path: '/' })
    setMenuAberto(false)
    router.refresh()
  }

  const labelAcessivel =
    locale === 'pt' ? 'Idioma' : locale === 'es' ? 'Idioma' : 'Language'

  return (
    <div ref={ref} className="relative mb-6 flex justify-center">
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[#001f3f] outline-none"
        aria-expanded={menuAberto}
        aria-haspopup="listbox"
        aria-label={labelAcessivel}
        onClick={() => setMenuAberto((v) => !v)}
      >
        <span className="text-xl" aria-hidden>
          {idiomaAtual.bandeira}
        </span>
        <span className="text-sm">{idiomaAtual.rotulo}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {menuAberto ? (
        <ul
          className="absolute left-1/2 top-full z-10 mt-1 min-w-[10rem] -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-1 shadow-md"
          role="listbox"
        >
          {opcoesIdioma.map((op) => (
            <li key={op.value} role="option" aria-selected={locale === op.value}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#001f3f] hover:bg-gray-50"
                onClick={() => mudarIdioma(op.value)}
              >
                <span aria-hidden>{op.bandeira}</span>
                {op.rotulo}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
