'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Car, Clock, Megaphone } from 'lucide-react'
import { AdminSecaoChevron } from '../shared/AdminSecaoChevron'
import { useConfiguracoes } from '../../hooks/useConfiguracoes'
import { useSharedAdminGate } from '../../context/AdminPermissaoContext'
import { podeAcessar } from '../../utils/permissoes'
import { ConfigApiPagamentos } from './sections/ConfigApiPagamentos'
import { ConfigApiMobilidade } from './sections/ConfigApiMobilidade'
import { ConfigPrazosLimites } from './sections/ConfigPrazosLimites'
import { SecaoCotacoes } from './sections/SecaoCotacoes'
import { ConfigPublicidadeExterna } from './sections/ConfigPublicidadeExterna'
import type { ConfigAPIs, ConfigGeral } from '../../types/admin.types'

function MensagemFeedback({ mensagem }: { mensagem: { tipo: 'sucesso' | 'erro'; texto: string } | null }) {
  if (!mensagem) return null
  return (
    <div
      className={`rounded-xl p-3 text-sm ${
        mensagem.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
      }`}
    >
      {mensagem.texto}
    </div>
  )
}

export function ConfigGeralPastas() {
  const gate = useSharedAdminGate()
  const { apis, geral, loading, salvarAPIs, salvarGeral, podeEditarAPIs, podeEditarGeral, error: hookError } =
    useConfiguracoes()

  const [localApis, setLocalApis] = useState<ConfigAPIs | null>(null)
  const [localGeral, setLocalGeral] = useState<ConfigGeral | null>(null)
  const [salvandoApis, setSalvandoApis] = useState(false)
  const [salvandoPrazos, setSalvandoPrazos] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  const [abertaPagamentos, setAbertaPagamentos] = useState(false)
  const [abertaMobilidade, setAbertaMobilidade] = useState(false)
  const [abertaCotacoes, setAbertaCotacoes] = useState(false)
  const [abertaPrazos, setAbertaPrazos] = useState(false)
  const [abertaPublicidadeExterna, setAbertaPublicidadeExterna] = useState(false)

  useEffect(() => {
    if (apis) setLocalApis({ ...apis })
  }, [apis])

  useEffect(() => {
    if (geral) setLocalGeral({ ...geral })
  }, [geral])

  const podeApis = gate.status === 'ok' && podeAcessar(gate.admin, 'configuracoes.apis')
  const podePrazos = gate.status === 'ok' && podeAcessar(gate.admin, 'configuracoes.geral')
  /** ADM Geral + ADM Financeiro com acesso a Configurações. */
  const podePublicidadeExterna = podeApis || podePrazos
  const podeEditarPublicidade =
    gate.status === 'ok' &&
    (podeEditarAPIs || podeEditarGeral || podeAcessar(gate.admin, 'configuracoes.apis'))

  const salvarApis = async () => {
    if (!localApis) return
    setSalvandoApis(true)
    setMensagem(null)
    try {
      await salvarAPIs(localApis)
      setMensagem({ tipo: 'sucesso', texto: 'APIs salvas com sucesso!' })
      window.setTimeout(() => setMensagem(null), 3000)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar APIs' })
    } finally {
      setSalvandoApis(false)
    }
  }

  const salvarPrazos = async () => {
    if (!localGeral) return
    setSalvandoPrazos(true)
    setMensagem(null)
    try {
      await salvarGeral(localGeral)
      setMensagem({ tipo: 'sucesso', texto: 'Prazos e limites salvos com sucesso!' })
      window.setTimeout(() => setMensagem(null), 3000)
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar prazos e limites' })
    } finally {
      setSalvandoPrazos(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Carregando...
      </div>
    )
  }
  if (hookError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Erro: {hookError.message}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <MensagemFeedback mensagem={mensagem} />

      {podeApis && localApis ? (
        <>
          <AdminSecaoChevron
            titulo="API sistema de pagamentos"
            aberta={abertaPagamentos}
            onToggle={() => setAbertaPagamentos((v) => !v)}
            icone={CreditCard}
            corTitulo="#0097b2"
          >
            <ConfigApiPagamentos localApis={localApis} setLocalApis={setLocalApis} podeEditar={podeEditarAPIs} />
            {podeEditarAPIs ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void salvarApis()}
                  disabled={salvandoApis}
                  className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {salvandoApis ? 'Salvando...' : 'Salvar pagamentos'}
                </button>
              </div>
            ) : null}
          </AdminSecaoChevron>

          <AdminSecaoChevron
            titulo="API mobilidade parceira"
            aberta={abertaMobilidade}
            onToggle={() => setAbertaMobilidade((v) => !v)}
            icone={Car}
            corTitulo="#0097b2"
          >
            <ConfigApiMobilidade localApis={localApis} setLocalApis={setLocalApis} podeEditar={podeEditarAPIs} />
            {podeEditarAPIs ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void salvarApis()}
                  disabled={salvandoApis}
                  className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {salvandoApis ? 'Salvando...' : 'Salvar mobilidade'}
                </button>
              </div>
            ) : null}
          </AdminSecaoChevron>

          <AdminSecaoChevron
            titulo="Cotações Compras CDE"
            aberta={abertaCotacoes}
            onToggle={() => setAbertaCotacoes((v) => !v)}
            icone={CreditCard}
            corTitulo="#0097b2"
          >
            <SecaoCotacoes
              localApis={localApis}
              setLocalApis={setLocalApis}
              podeEditar={podeEditarAPIs}
              onMensagem={setMensagem}
            />
            {podeEditarAPIs ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void salvarApis()}
                  disabled={salvandoApis}
                  className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {salvandoApis ? 'Salvando...' : 'Salvar cotações'}
                </button>
              </div>
            ) : null}
          </AdminSecaoChevron>
        </>
      ) : null}

      {podePrazos && localGeral ? (
        <AdminSecaoChevron
          titulo="Prazos e Limites"
          aberta={abertaPrazos}
          onToggle={() => setAbertaPrazos((v) => !v)}
          icone={Clock}
          corTitulo="#0097b2"
        >
          <ConfigPrazosLimites
            localGeral={localGeral}
            setLocalGeral={setLocalGeral}
            podeEditar={podeEditarGeral}
            salvando={salvandoPrazos}
            onSalvar={() => void salvarPrazos()}
          />
        </AdminSecaoChevron>
      ) : null}

      {podePublicidadeExterna ? (
        <AdminSecaoChevron
          titulo="Publicidade Externa"
          aberta={abertaPublicidadeExterna}
          onToggle={() => setAbertaPublicidadeExterna((v) => !v)}
          icone={Megaphone}
          corTitulo="#0097b2"
          descricao="Cards informativos exibidos no drawer Publicidade das empresas com plano."
        >
          <ConfigPublicidadeExterna
            podeEditar={podeEditarPublicidade}
            onMensagem={setMensagem}
          />
        </AdminSecaoChevron>
      ) : null}

      {!podeApis && !podePrazos ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Você não tem permissão para acessar as configurações gerais.
        </div>
      ) : null}
    </div>
  )
}
