'use client'

import NomeComVerificacao from '@/components/NomeComVerificacao'
import EscudoVerificacaoPendente from '@/components/EscudoVerificacaoPendente'

/**
 * @param {{
 *   nome: string
 *   mostrarCartao?: boolean
 *   profissionalVerificado?: boolean
 *   contaVerificada?: boolean
 *   seloVerificacaoNoNome?: boolean
 *   verificadoTipo?: 'profissional' | 'empresa'
 *   onAbrirCartao?: () => void
 *   compactoCentralizado?: boolean
 * }} props
 * profissionalVerificado: true quando status aprovado (escudo verde); senão escudo vermelho com ?.
 * contaVerificada: selo verde à frente do nome (empresa/turista; profissional usa o selo no @username).
 * seloVerificacaoNoNome: false para profissional (selo fica no cabeçalho).
 */
export default function NomeSocial({
  nome,
  mostrarCartao = false,
  profissionalVerificado = false,
  contaVerificada = false,
  seloVerificacaoNoNome = true,
  verificadoTipo = 'profissional',
  onAbrirCartao,
  compactoCentralizado = false,
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        compactoCentralizado ? 'justify-center text-center' : ''
      }`}
    >
      {mostrarCartao ? (
        <button
          type="button"
          onClick={() => onAbrirCartao?.()}
          className="inline-flex shrink-0 items-center justify-center"
          aria-label={
            profissionalVerificado
              ? 'Abrir cartão de visita — profissional verificado'
              : 'Abrir cartão de visita — perfil em análise'
          }
          title="Cartão de visita"
        >
          <EscudoVerificacaoPendente verificado={profissionalVerificado} />
        </button>
      ) : null}
      <h1
        className={`min-w-0 font-bold text-[#001f3f] ${
          compactoCentralizado ? 'text-center text-lg' : 'text-left text-2xl'
        }`}
      >
        <NomeComVerificacao
          nome={nome}
          verificado={seloVerificacaoNoNome && contaVerificada}
          verificadoTipo={verificadoTipo}
          nomeClassName="truncate"
        />
      </h1>
    </div>
  )
}
