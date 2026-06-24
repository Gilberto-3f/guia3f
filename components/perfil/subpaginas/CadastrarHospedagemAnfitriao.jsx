'use client'

import { useState } from 'react'
import CampoUsernameCadastro from '@/components/cadastro/CampoUsernameCadastro'
import CampoWhatsappCadastro from '@/components/cadastro/CampoWhatsappCadastro'
import { useUsernameDisponivel } from '@/hooks/useUsernameDisponivel'
import { digitsWhatsapp } from '@/lib/whatsapp-empresa'

const CIDADES = ['Foz do Iguaçu', 'Ciudad del Este', 'Puerto Iguazú']

const ERROS_API = {
  invalid_fields: 'Preencha todos os campos obrigatórios corretamente.',
  not_professional: 'Apenas profissionais podem cadastrar hospedagem.',
  not_anfitriao: 'Esta opção é exclusiva para profissionais da categoria Anfitrião.',
  already_registered: 'Você já possui um negócio de hospedagem cadastrado.',
  username_taken: 'Este nome de usuário já está em uso.',
  unauthorized: 'Faça login para continuar.',
}

/**
 * @param {{ onConcluido?: () => void, onAlternarHospedagem?: () => void }} props
 */
export default function CadastrarHospedagemAnfitriao({ onConcluido, onAlternarHospedagem }) {
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cidade, setCidade] = useState(CIDADES[0])
  const [endereco, setEndereco] = useState('')
  const [bairro, setBairro] = useState('')
  const [descricaoCurta, setDescricaoCurta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const { usernameLimpo, usernameStatus, usernameFeedback } = useUsernameDisponivel(nomeUsuario, (key) => {
    const map = {
      'username.checking': 'Verificando…',
      'username.available': 'Disponível',
      'username.unavailable': 'Indisponível',
      'username.rulesHint': 'Use 3–20 caracteres: letras minúsculas, números, ponto ou _',
    }
    return map[key] ?? key
  })

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm'

  const podeEnviar =
    nomeFantasia.trim().length >= 2 &&
    usernameStatus === 'available' &&
    digitsWhatsapp(whatsapp).length >= 10 &&
    endereco.trim().length >= 3 &&
    cidade.trim().length > 0 &&
    !enviando

  const enviar = async (e) => {
    e.preventDefault()
    if (!podeEnviar) return
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/profissional/hospedagem-anfitriao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeFantasia: nomeFantasia.trim(),
          nomeUsuario: usernameLimpo,
          cidade: cidade.trim(),
          endereco: endereco.trim(),
          bairro: bairro.trim(),
          whatsapp: digitsWhatsapp(whatsapp),
          descricaoCurta: descricaoCurta.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = data?.error != null ? String(data.error) : 'server_error'
        setErro(ERROS_API[code] ?? 'Não foi possível cadastrar. Tente novamente.')
        return
      }
      window.dispatchEvent(new Event('anfitriao-modo-refresh'))
      window.dispatchEvent(new Event('empresa-gate-refresh'))
      window.dispatchEvent(new Event('perfil-atualizado'))
      onAlternarHospedagem?.()
      onConcluido?.()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 px-1 pb-6">
      <p className="text-sm text-gray-600">
        Cadastre seu negócio de hospedagem vinculado ao perfil de Anfitrião. Após a aprovação do administrador, você
        poderá alternar entre os modos Anfitrião e Hospedagem no menu.
      </p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Nome fantasia *</span>
        <input
          type="text"
          value={nomeFantasia}
          onChange={(e) => setNomeFantasia(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          placeholder="Ex.: Pousada das Cataratas"
          required
        />
      </label>

      <CampoUsernameCadastro
        id="nomeUsuarioHospedagem"
        label="Nome de usuário *"
        value={nomeUsuario}
        onChange={setNomeUsuario}
        placeholder="sua_pousada"
        feedback={usernameFeedback}
        status={usernameStatus}
        inputClassName={inputCls}
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Cidade *</span>
        <select
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        >
          {CIDADES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Endereço *</span>
        <input
          type="text"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          placeholder="Rua e número"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Bairro</span>
        <input
          type="text"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
        />
      </label>

      <CampoWhatsappCadastro id="whatsappHospedagem" label="WhatsApp *" onChange={setWhatsapp} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Descrição curta</span>
        <textarea
          value={descricaoCurta}
          onChange={(e) => setDescricaoCurta(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
          placeholder="Apresente seu negócio em poucas linhas"
        />
      </label>

      {erro ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      <button
        type="submit"
        disabled={!podeEnviar}
        className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
      >
        {enviando ? 'Cadastrando…' : 'CADASTRAR HOSPEDAGEM'}
      </button>
    </form>
  )
}
