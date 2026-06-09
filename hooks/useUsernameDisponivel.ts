'use client'

import { useEffect, useMemo, useState } from 'react'

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

const usernameRegex = /^[a-z0-9._]{3,20}$/

export function useUsernameDisponivel(
  nomeUsuario: string,
  t: (key: string) => string
) {
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')

  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )

  useEffect(() => {
    if (!usernameLimpo) {
      setUsernameStatus('idle')
      setUsernameFeedback('')
      return
    }

    if (!usernameRegex.test(usernameLimpo)) {
      setUsernameStatus('unavailable')
      setUsernameFeedback(t('username.rulesHint'))
      return
    }

    let ativo = true
    setUsernameStatus('checking')
    setUsernameFeedback(t('username.checking'))

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/cadastro/username-disponivel?username=${encodeURIComponent(usernameLimpo)}`
        )
        const json = (await res.json().catch(() => ({}))) as {
          available?: boolean
          reason?: string
        }

        if (!ativo) return

        if (!res.ok || json.reason === 'error') {
          setUsernameStatus('unavailable')
          setUsernameFeedback(t('username.validateError'))
          return
        }

        if (json.available) {
          setUsernameStatus('available')
          setUsernameFeedback(t('username.available'))
        } else {
          setUsernameStatus('unavailable')
          setUsernameFeedback(t('username.unavailable'))
        }
      } catch {
        if (!ativo) return
        setUsernameStatus('unavailable')
        setUsernameFeedback(t('username.validateError'))
      }
    }, 400)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [usernameLimpo, t])

  return { usernameLimpo, usernameStatus, usernameFeedback }
}
