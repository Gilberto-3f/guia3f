export type EmailLocale = 'pt' | 'en' | 'es'

type MailCopy = {
  subject: string
  text: string
  html: string
}

function copyFor(locale: EmailLocale): MailCopy {
  if (locale === 'en') {
    const text =
      'Your 3F Guia password was changed. If this was not you, use “Forgot password” on the login screen or contact support.'
    return {
      subject: 'Your password was changed',
      text,
      html: `<p>${text}</p>`,
    }
  }
  if (locale === 'es') {
    const text =
      'Tu contraseña de 3F Guia fue cambiada. Si no fuiste tú, usa “Olvidé la contraseña” en la pantalla de inicio de sesión o contacta al soporte.'
    return {
      subject: 'Tu contraseña fue cambiada',
      text,
      html: `<p>${text}</p>`,
    }
  }
  const text =
    'Sua senha na 3F Guia foi alterada. Se não foi você, use “Esqueci a senha” na tela de login ou fale com o suporte.'
  return {
    subject: 'Sua senha foi alterada',
    text,
    html: `<p>${text}</p>`,
  }
}

export function normalizeEmailLocale(raw: unknown): EmailLocale {
  const v = String(raw ?? 'pt').toLowerCase()
  if (v === 'en' || v === 'es') return v
  return 'pt'
}

/**
 * Aviso de senha alterada (sem link). Usa Resend se `RESEND_API_KEY` estiver definida.
 * Sem chave: registra no log e retorna `sent: false` (não reverte a troca).
 */
export async function sendPasswordChangedEmail(opts: {
  to: string
  locale: EmailLocale
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    '3F Guia <onboarding@resend.dev>'

  const copy = copyFor(opts.locale)

  if (!apiKey) {
    console.info('[emailSenhaAlterada] RESEND_API_KEY ausente — e-mail não enviado', {
      to: opts.to,
      locale: opts.locale,
      subject: copy.subject,
    })
    return { sent: false, skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: copy.subject,
        text: copy.text,
        html: copy.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[emailSenhaAlterada] Resend falhou', res.status, body)
      return { sent: false, error: `resend_${res.status}` }
    }

    return { sent: true }
  } catch (err) {
    console.error('[emailSenhaAlterada]', err)
    return { sent: false, error: 'network' }
  }
}
