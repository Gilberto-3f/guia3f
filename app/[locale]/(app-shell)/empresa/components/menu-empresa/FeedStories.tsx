'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { CalendarClock, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import AgendarPublicacoes from './AgendarPublicacoes'

function BotaoAcao({
  href,
  icon: Icon,
  titulo,
  descricao,
}: {
  href: string
  icon: typeof ImageIcon
  titulo: string
  descricao: string
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition hover:border-[#0097b2]/40 hover:bg-[#0097b2]/5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0097b2]/10 text-[#0097b2]">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-bold text-[#001f3f]">{titulo}</span>
        <span className="mt-0.5 block text-xs text-gray-600">{descricao}</span>
      </span>
    </Link>
  )
}

export default function FeedStories() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const { dados } = useDashboardEmpresa()
  const { featureLiberada } = useEmpresaServicosPlano(dados?.plano, dados?.id)
  const mostrarPlanejador = featureLiberada('planejador_publicacoes')

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!ativo) return
      setUsuarioId(uid)
      if (!uid) {
        setEmpresaId(null)
        return
      }
      const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
      if (!ativo) return
      setEmpresaId(emp?.id != null ? String(emp.id) : null)
    }
    void boot()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    void fetch('/api/publicacoes-agendadas/processar', { method: 'POST' })
  }, [])

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-gray-600">
        Crie conteúdo para o feed e stories da sua empresa, ou programe publicações para datas futuras.
      </p>

      <div className="space-y-3">
        <BotaoAcao
          href="/feed/criar"
          icon={ImageIcon}
          titulo="Publicar no Feed"
          descricao="Foto com legenda ou post somente de texto."
        />
        <BotaoAcao
          href="/feed/story/criar"
          icon={Sparkles}
          titulo="Publicar Story"
          descricao="Escolha um arquivo na galeria e edite antes de publicar."
        />
      </div>

      {mostrarPlanejador ? <AgendarPublicacoes usuarioId={usuarioId} empresaId={empresaId} /> : null}

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 text-xs text-gray-500">
        <p className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
          <span>
            Publicações agendadas são publicadas automaticamente no feed ou nos stories na data e horário
            definidos (até 1 mês de antecedência).
          </span>
        </p>
        <p className="mt-2 flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
          <span>Posts de texto, fotos e stories seguem as mesmas regras das páginas de criação do app.</span>
        </p>
      </div>
    </div>
  )
}
