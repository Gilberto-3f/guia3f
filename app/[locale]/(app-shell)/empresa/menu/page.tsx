'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MenuEmpresaPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/empresa/menu/publicidade')
  }, [router])

  return null
}

