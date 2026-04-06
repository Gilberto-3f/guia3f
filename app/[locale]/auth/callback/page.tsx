'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { getPostAuthRedirectPath } from '@/lib/postAuthRedirect'

export default function AuthCallbackPage() {
  const router = useRouter()
  const tCommon = useTranslations('Common')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let ativo = true

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            if (ativo) {
              setMensagem(error.message)
              router.replace('/login')
            }
            return
          }
        }

        let {
          data: { session },
        } = await supabase.auth.getSession()
        if (!ativo) return

        if (!session?.user && (url.hash.includes('access_token') || url.hash.includes('refresh_token'))) {
          await new Promise((r) => setTimeout(r, 100))
          ;({
            data: { session },
          } = await supabase.auth.getSession())
        }

        if (session?.user?.id) {
          const path = await getPostAuthRedirectPath(supabase, session.user.id)
          router.replace(path)
          return
        }

        router.replace('/login')
      } catch {
        if (ativo) router.replace('/login')
      }
    }

    void run()
    return () => {
      ativo = false
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0097b2] p-6 text-white">
      <p>{mensagem || tCommon('loading')}</p>
    </div>
  )
}
