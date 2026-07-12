'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Hotel, ShoppingBag, Ticket } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import { supabase } from '@/lib/supabase'
import {
  listarAcomodacoesFavoritas,
  listarEmpresasFavoritas,
  type AcomodacaoFavoritaCard,
  type EmpresaFavoritaCard,
} from '@/lib/favoritosTurista'
import { rotuloCategoriaImovelCurto } from '@/lib/hospedagemAcomodacoesCatalogo'

const COR = '#0097b2'

type Pastas = {
  compras: boolean
  tickets: boolean
  hospedagem: boolean
  empresas: boolean
}

export default function FavoritosPage() {
  const router = useRouter()
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<EmpresaFavoritaCard[]>([])
  const [acomodacoes, setAcomodacoes] = useState<AcomodacaoFavoritaCard[]>([])
  const [pastas, setPastas] = useState<Pastas>({
    compras: false,
    tickets: false,
    hospedagem: false,
    empresas: false,
  })

  const toggle = (key: keyof Pastas) => {
    setPastas((p) => ({ ...p, [key]: !p[key] }))
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      setUsuarioId(uid)
      if (!uid) {
        setEmpresas([])
        setAcomodacoes([])
        return
      }
      const [emps, acoms] = await Promise.all([
        listarEmpresasFavoritas(supabase, uid),
        listarAcomodacoesFavoritas(supabase, uid),
      ])
      setEmpresas(emps)
      setAcomodacoes(acoms)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onFocus = () => void carregar()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [carregar])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <header className="shrink-0 border-b border-white/15 bg-[#0097b2] px-4 py-4 pt-safe">
        <h1 className="text-center text-lg font-bold uppercase tracking-wide text-white">Favoritos</h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 pb-24">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Carregando favoritos…</p>
        ) : !usuarioId ? (
          <p className="py-10 text-center text-sm text-gray-500">Faça login para ver seus favoritos.</p>
        ) : (
          <>
            <ChevronPasta
              titulo="Compras Paraguai"
              icone={ShoppingBag}
              corTitulo={COR}
              aberto={pastas.compras}
              onToggle={() => toggle('compras')}
            >
              <p className="text-center text-sm text-gray-500">
                Em breve: produtos salvos em Compras Paraguai.
              </p>
            </ChevronPasta>

            <ChevronPasta
              titulo="Tickets"
              icone={Ticket}
              corTitulo={COR}
              aberto={pastas.tickets}
              onToggle={() => toggle('tickets')}
            >
              <p className="text-center text-sm text-gray-500">
                Em breve: atrativos salvos no botão dinâmico.
              </p>
            </ChevronPasta>

            <ChevronPasta
              titulo="Hospedagem"
              icone={Hotel}
              corTitulo={COR}
              aberto={pastas.hospedagem}
              onToggle={() => toggle('hospedagem')}
            >
              {acomodacoes.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  Nenhuma acomodação salva ainda.
                </p>
              ) : (
                <ul className="space-y-3">
                  {acomodacoes.map((a) => (
                    <li
                      key={a.id}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                    >
                      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">
                        {rotuloCategoriaImovelCurto(a.categoria_imovel) || 'Acomodação'}
                        {a.empresa_nome ? (
                          <span className="font-normal text-gray-500"> · {a.empresa_nome}</span>
                        ) : null}
                      </p>
                      <div className="mt-2 aspect-[4/3] bg-gray-100">
                        {a.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.foto_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="p-3">
                        {a.valor_diaria != null ? (
                          <p className="text-sm font-bold text-[#0097b2]">
                            {a.valor_diaria.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                            <span className="font-normal text-gray-500"> / diária</span>
                          </p>
                        ) : null}
                        {a.empresa_id ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/empresa/${a.empresa_id}`)}
                            className="mt-2 w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                          >
                            Ver empresa
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ChevronPasta>

            <ChevronPasta
              titulo="Páginas de Empresas"
              icone={Building2}
              corTitulo={COR}
              aberto={pastas.empresas}
              onToggle={() => toggle('empresas')}
            >
              {empresas.length === 0 ? (
                <p className="text-center text-sm text-gray-500">Nenhuma página salva ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {empresas.map((e) => {
                    const username = String(e.nome_usuario ?? '')
                      .replace(/^@+/, '')
                      .trim()
                    return (
                      <li key={e.id}>
                        <div className="flex items-center gap-2.5 rounded-xl bg-[#0097b2] p-2.5 shadow-sm">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-white/20">
                            {e.foto_url ? (
                              <AvatarImage
                                src={e.foto_url}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 pr-1">
                            <p className="truncate text-sm font-bold leading-tight text-white">
                              {e.nome_fantasia}
                            </p>
                            {username ? (
                              <p className="truncate text-xs leading-tight text-white/90">
                                @{username}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => router.push(`/empresa/${e.id}`)}
                            className="flex h-11 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg bg-white px-1 text-center text-[10px] font-bold leading-tight text-[#0097b2]"
                          >
                            <span>VISITAR</span>
                            <span>PÁGINA</span>
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ChevronPasta>
          </>
        )}
      </main>
    </div>
  )
}
