import type { EmailLocale } from '@/lib/emailSenhaAlterada'

type MailCopy = {
  subject: string
  text: string
  html: string
}

function copyFor(locale: EmailLocale): MailCopy {
  if (locale === 'en') {
    const text =
      'Your 3F Guia account was deleted. Profile, photos, documents and posts were removed and cannot be restored. Some operational or legal records may remain anonymized, without identifying you.'
    return {
      subject: 'Your account was deleted',
      text,
      html: `<p>${text}</p>`,
    }
  }
  if (locale === 'es') {
    const text =
      'Tu cuenta de 3F Guia fue eliminada. Perfil, fotos, documentos y publicaciones se eliminaron y no se pueden restaurar. Algunos registros operativos o legales pueden permanecer anonimizados, sin identificarte.'
    return {
      subject: 'Tu cuenta fue eliminada',
      text,
      html: `<p>${text}</p>`,
    }
  }
  const text =
    'Sua conta na 3F Guia foi excluída. Perfil, fotos, documentos e publicações foram removidos e não podem ser restaurados. Alguns registros operacionais ou legais podem permanecer anonimizados, sem identificá-lo.'
  return {
    subject: 'Sua conta foi excluída',
    text,
    html: `<p>${text}</p>`,
  }
}

/**
 * Aviso de conta excluída (sem link). Mesmo provedor da troca de senha (Resend).
 */
export async function sendAccountDeletedEmail(opts: {
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
    console.info('[emailContaExcluida] RESEND_API_KEY ausente — e-mail não enviado', {
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
      console.error('[emailContaExcluida] Resend falhou', res.status, body)
      return { sent: false, error: `resend_${res.status}` }
    }

    return { sent: true }
  } catch (err) {
    console.error('[emailContaExcluida]', err)
    return { sent: false, error: 'network' }
  }
}
