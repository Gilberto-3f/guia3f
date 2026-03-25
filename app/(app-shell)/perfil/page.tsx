'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PerfilRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        router.replace('/login')
        return
      }
      router.replace(`/perfil/${session.user.id}`)
    }
    void run()
  }, [router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
      Abrindo perfil…
    </div>
  )
}
