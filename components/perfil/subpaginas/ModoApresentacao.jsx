'use client'

import { useRouter } from '@/i18n/navigation'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

const profissionais = [
  { id: 'guia', nome: 'Guia de Turismo', categoriaDb: 'Guia', icone: '🧭' },
  { id: 'taxista', nome: 'Taxista', categoriaDb: 'Taxista', icone: '🚕' },
  { id: 'van', nome: 'Motorista agenciado (Van)', categoriaDb: 'Van', icone: '🚐' },
  { id: 'motorista_app', nome: 'Motorista de app', categoriaDb: 'Motorista de App', icone: '📱' },
  { id: 'anfitriao', nome: 'Anfitrião', categoriaDb: 'Anfitriao', icone: '🏠' },
]

const empresas = [
  { id: 'gastro', nome: 'Gastronomia', segmentoDb: 'Restaurantes', icone: '🍽️' },
  { id: 'lojas_py', nome: 'Lojas / Compras Paraguai', segmentoDb: 'Compras Paraguai', icone: '🛍️' },
  { id: 'passeios', nome: 'Passeios', segmentoDb: 'Atrativos', icone: '🎯' },
  { id: 'hospedagem', nome: 'Hospedagem', segmentoDb: 'Hospedagem', icone: '🛏️' },
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
    <div className="space-y-6 px-1">
      <div>
        <p className="text-sm leading-relaxed text-gray-600">
          Simule a interface como outro tipo de perfil. O seu utilizador continua administrador na base de dados; não são criadas
          contas fictícias. Interações que alteram dados estão bloqueadas.
        </p>
        {modoAtivo && perfilSimulado ? (
          <p className="mt-2 text-sm font-medium text-amber-800">
            Modo ativo: {perfilSimulado.icone} {perfilSimulado.nome}
          </p>
        ) : null}
      </div>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Turista</h3>
        <button
          type="button"
          disabled={loadingAtivacao}
          onClick={async () => {
            await ativarModo('turista', { nome: 'Turista', icone: '👤' })
            irGuia()
          }}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50 disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              👤
            </span>
            <span className="font-medium text-gray-900">Turista</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-[#0097b2]">Visualizar como turista</span>
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
                    icone: p.icone,
                    categoria: p.id,
                    categoriaDb: p.categoriaDb,
                  })
                  irGuia()
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {p.icone}
                  </span>
                  <span className="min-w-0 font-medium text-gray-900">{p.nome}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-[#0097b2]">Visualizar como {p.nome}</span>
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
                    icone: e.icone,
                    segmento: e.id,
                    segmentoDb: e.segmentoDb,
                  })
                  irGuia()
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#0097b2]/50 hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {e.icone}
                  </span>
                  <span className="min-w-0 font-medium text-gray-900">{e.nome}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-[#0097b2]">Visualizar como {e.nome}</span>
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
