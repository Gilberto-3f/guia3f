import { redirect } from '@/i18n/navigation'

/** Página legada removida — cadastro fica no Botão Dinâmico. Redirect server-side (sem flash). */
export default async function ComprasParaguaiMenuRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect({ href: '/empresa/menu/botao-dinamico', locale })
}
