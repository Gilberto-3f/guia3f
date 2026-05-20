'use client'

import { ChevronRight } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'

const profissionais = [
  { id: 'guia', nome: 'Guia de Turismo', categoriaDb: 'Guia', iconeKey: 'guia' },
  { id: 'taxista', nome: 'Taxista', categoriaDb: 'Taxista', iconeKey: 'taxista' },
  { id: 'van', nome: 'Motorista agenciado (Van)', categoriaDb: 'Van', iconeKey: 'van' },
  { id: 'motorista_app', nome: 'Motorista de app', categoriaDb: 'Motorista de App', iconeKey: 'motorista_app' },
  { id: 'anfitriao', nome: 'Anfitrião', categoriaDb: 'Anfitriao', iconeKey: 'anfitriao' },
]

const empresas = [
  { id: 'gastro', nome: 'Gastronomia', segmentoDb: 'gastronomia', iconeKey: 'gastro' },
  { id: 'lojas_py', nome: 'Lojas', segmentoDb: 'lojas', iconeKey: 'lojas_py' },
  { id: 'passeios', nome: 'Passeios', segmentoDb: 'passeios', iconeKey: 'passeios' },
  { id: 'hospedagem', nome: 'Hospedagem', segmentoDb: 'hospedagem', iconeKey: 'hospedagem' },
]

const itemBtnCls =
  'flex w-full min-w-0 items-center gap-2.5 py-2 text-left text-gray-900 transition hover:bg-gray-50 disabled:opacity-60'

/**
 * Tela de escolha do modo apresentação (ADM GERAL).
 */
export default function ModoApresentacao() {
  const router = useRouter()
  const { ativarModo, desativarModo, modoAtivo, perfilSimulado, loadingAtivacao } = useModoApresentacao()

  const irGuia = () => {
    router.push('/guia')
  }

  return (
    <div className="space-y-4 px-0">
      {modoAtivo && perfilSimulado ? (
        <div className="flex min-w-0 items-center gap-2 py-1">
          <ModoApresentacaoIcon iconeKey={perfilSimulado.iconeKey} className="h-5 w-5 shrink-0 text-amber-800" />
          <p className="min-w-0 truncate text-sm font-medium text-amber-900">Ativo: {perfilSimulado.nome}</p>
        </div>
      ) : null}

      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Turista</h3>
        <button
          type="button"
          disabled={loadingAtivacao}
          onClick={async () => {
            await ativarModo('turista', { nome: 'Turista', iconeKey: 'turista' })
            irGuia()
          }}
          className={itemBtnCls}
        >
          <ModoApresentacaoIcon iconeKey="turista" className="h-5 w-5 shrink-0 text-current" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">Turista</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-current opacity-40" strokeWidth={2} aria-hidden />
        </button>
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Profissionais</h3>
        <ul className="divide-y divide-gray-100">
          {profissionais.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={loadingAtivacao}
                onClick={async () => {
                  await ativarModo('profissional', {
                    nome: p.nome,
                    iconeKey: p.iconeKey,
                    categoria: p.id,
                    categoriaDb: p.categoriaDb,
                  })
                  irGuia()
                }}
                className={itemBtnCls}
              >
                <ModoApresentacaoIcon iconeKey={p.iconeKey} className="h-5 w-5 shrink-0 text-current" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nome}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-current opacity-40" strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Empresas</h3>
        <ul className="divide-y divide-gray-100">
          {empresas.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={loadingAtivacao}
                onClick={async () => {
                  await ativarModo('empresa', {
                    nome: e.nome,
                    iconeKey: e.iconeKey,
                    segmento: e.id,
                    segmentoDb: e.segmentoDb,
                  })
                  irGuia()
                }}
                className={itemBtnCls}
              >
                <ModoApresentacaoIcon iconeKey={e.iconeKey} className="h-5 w-5 shrink-0 text-current" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nome}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-current opacity-40" strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {modoAtivo ? (
        <button
          type="button"
          onClick={() => desativarModo()}
          className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          Sair do modo apresentação
        </button>
      ) : null}
    </div>
  )
}
