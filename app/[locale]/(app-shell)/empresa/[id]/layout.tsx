import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'

type Props = {
  children: ReactNode
  params: Promise<{ id: string; locale?: string }>
}

async function fetchEmpresaMeta(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !id) return null

  const sb = createClient(url, key)
  const { data } = await sb
    .from('empresas')
    .select(
      'nome_fantasia, nome_usuario, nota_media, total_avaliacoes, categoria, endereco, bairro, cidade, foto_url',
    )
    .eq('id', id)
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
  const emp = await fetchEmpresaMeta(id)
  if (!emp) return { title: 'Guia 3F' }

  const nome = String(emp.nome_fantasia ?? 'Empresa')
  const notaNum = emp.nota_media != null && Number.isFinite(Number(emp.nota_media)) ? Number(emp.nota_media) : null
  const totalAv =
    emp.total_avaliacoes != null && Number.isFinite(Number(emp.total_avaliacoes))
      ? Number(emp.total_avaliacoes)
      : null
  const categoria = emp.categoria != null ? String(emp.categoria) : ''
  const endereco = [emp.endereco, emp.bairro, emp.cidade].filter(Boolean).map(String).join(', ')
  const username = emp.nome_usuario ? `@${String(emp.nome_usuario).replace(/^@+/, '')}` : ''

  const rating = notaNum != null ? `${notaNum.toFixed(1)}★${totalAv ? ` (${totalAv})` : ''}` : ''
  const description = [rating, categoria, username, endereco].filter(Boolean).join(' · ')

  let image = emp.foto_url ? String(emp.foto_url) : undefined
  const origin = siteOrigin()
  if (image && image.startsWith('/') && origin) image = `${origin}${image}`

  const pageUrl = origin ? `${origin}/empresa/${id}?ref=recomendacao` : `/empresa/${id}?ref=recomendacao`

  return {
    title: `${nome} | Guia 3F`,
    description,
    openGraph: {
      title: nome,
      description,
      url: pageUrl,
      siteName: 'Guia 3F',
      type: 'website',
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

export default function EmpresaLayout({ children }: Pick<Props, 'children'>) {
  return children
}
