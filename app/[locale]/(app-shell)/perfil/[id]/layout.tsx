import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'

type Props = {
  children: ReactNode
  params: Promise<{ id: string; locale?: string }>
}

async function fetchProfissionalMeta(usuarioId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !usuarioId) return null

  const sb = createClient(url, key)
  const { data } = await sb
    .from('profissionais')
    .select('nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  return data
}

function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return undefined
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params
  const prof = await fetchProfissionalMeta(id)
  if (!prof) return { title: 'Guia 3F' }

  const nome = String(prof.nome_completo ?? 'Profissional')
  const username = prof.nome_usuario
    ? `@${String(prof.nome_usuario).replace(/^@+/, '')}`
    : ''
  const cats = Array.isArray(prof.categorias) ? prof.categorias.map(String).join(' · ') : ''
  const description = [cats, username].filter(Boolean).join(' · ') || 'Profissional no Guia 3F'

  let image =
    prof.foto_perfil_url != null
      ? String(prof.foto_perfil_url)
      : prof.foto_url != null
        ? String(prof.foto_url)
        : undefined
  const origin = siteOrigin()
  if (image && image.startsWith('/') && origin) image = `${origin}${image}`

  const pageUrl = origin ? `${origin}/perfil/${id}` : `/perfil/${id}`

  return {
    title: `${nome} | Guia 3F`,
    description,
    openGraph: {
      title: nome,
      description,
      url: pageUrl,
      siteName: 'Guia 3F',
      type: 'profile',
      locale: 'pt_BR',
      images: image ? [{ url: image, alt: nome }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: nome,
      description,
      images: image ? [image] : [],
    },
  }
}

export default function PerfilIdLayout({ children }: Pick<Props, 'children'>) {
  return children
}
