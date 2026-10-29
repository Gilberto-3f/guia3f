'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { AppSplashCapa } from '@/components/AppSplash'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.replace('/guia')
      } else {
        router.replace('/login')
      }
    }

    checkUser()
  }, [router])

  return <AppSplashCapa />
}
