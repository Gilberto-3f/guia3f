'use client'

import { useEffect, useState } from 'react'
import CriarStory from '@/components/CriarStory'
import { supabase } from '@/lib/supabase'

export default function CriarStoryPage() {
  const [autorTipo, setAutorTipo] = useState('turista')

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      const { data } = await supabase.from('usuarios').select('role').eq('id', session.user.id).maybeSingle()
      const r = data?.role
      if (typeof r === 'string' && r) setAutorTipo(r)
    }
    void run()
  }, [])

  return <CriarStory autorTipo={autorTipo} />
}
