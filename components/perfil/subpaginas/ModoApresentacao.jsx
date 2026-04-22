'use client'

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
  { id: 'gastro', nome: 'Gastronomia', segmentoDb: 'Restaurantes', iconeKey: 'gastro' },
  { id: 'lojas_py', nome: 'Lojas', segmentoDb: 'Lojas', iconeKey: 'lojas_py' },
  { id: 'passeios', nome: 'Passeios', segmentoDb: 'Atrativos', iconeKey: 'passeios' },
  { id: 'hospedagem', nome: 'Hospedagem', segmentoDb: 'Hospedagem', iconeKey: 'hospedagem' },
]

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
    <div className="space-y-5 px-1">
      {modoAtivo && perfilSimulado ? (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <ModoApresentacaoIcon iconeKey={perfilSimulado.iconeKey} className="h-5 w-5 shrink-0 text-amber-800" />
          <p className="min-w-0 truncate text-sm font-medium text-amber-900">Ativo: {perfilSimulado.nome}</p>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Turista</h3>
        <button
          type="button"
          disabled={loadingAtivacao}
          onClick={async () => {
            await ativarModo('turista', { nome: 'Turista', iconeKey: 'turista' })
            irGuia()
          }}
          className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50 disabled:opacity-60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#0097b2]">
            <ModoApresentacaoIcon iconeKey="turista" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-gray-900">Turista</span>
        </button>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Profissionais</h3>
        <ul className="space-y-2">
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
                className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#0097b2]">
                  <ModoApresentacaoIcon iconeKey={p.iconeKey} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{p.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Empresas</h3>
        <ul className="space-y-2">
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
                className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#0097b2]">
                  <ModoApresentacaoIcon iconeKey={e.iconeKey} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{e.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {modoAtivo ? (
        <button
          type="button"
          onClick={() => desativarModo()}
          className="w-full rounded-xl border-2 border-red-200 bg-red-50 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          Sair do modo apresentação
        </button>
      ) : null}
    </div>
  )
}
