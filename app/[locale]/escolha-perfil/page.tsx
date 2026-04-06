'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

const VERDE = '#00D443'

type PerfilKey = 'turista' | 'profissional' | 'empresa'

function BeneficioLinha({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#001f3f]">
      <span className="font-bold text-[#0097b2] shrink-0">→</span>
      <span>{children}</span>
    </li>
  )
}

export default function EscolhaPerfilPage() {
  const router = useRouter()
  const [aberto, setAberto] = useState<PerfilKey | null>('turista')
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  useEffect(() => {
    let ativo = true
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!ativo) return
      if (!session?.user) {
        router.replace('/login')
        return
      }
      setVerificandoSessao(false)
    }
    void run()
    return () => {
      ativo = false
    }
  }, [router])

  const toggle = (key: PerfilKey) => {
    setAberto((prev) => (prev === key ? null : key))
  }

  if (verificandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0097b2] p-4">
        <p className="text-white">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0097b2] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border-2 border-[#0097b2] p-8 max-w-md w-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" width={150} height={50} alt="Guia 3F" priority />
        </div>

        <h1 className="text-2xl font-bold text-center text-[#0097b2] mb-6">
          Como deseja se cadastrar ?
        </h1>

        <div className="space-y-4">
          {/* Turista */}
          <div>
            <button
              type="button"
              onClick={() => toggle('turista')}
              className={`w-full py-4 rounded-lg text-lg font-bold transition-shadow shadow-md ${
                aberto === 'turista'
                  ? 'bg-[#0097b2] text-white'
                  : 'bg-white text-[#0097b2] border-2 border-[#0097b2] shadow-[0_2px_8px_rgba(0,151,178,0.25)]'
              }`}
            >
              Turista
            </button>
            {aberto === 'turista' ? (
              <div className="mt-4 rounded-lg border border-[#0097b2]/30 bg-white p-4">
                <p className="text-[#0097b2] font-bold mb-2">Seja bem-vindo(a),</p>
                <p className="text-sm text-[#001f3f] leading-relaxed mb-4">
                  em nosso ecossistema você vai encontrar as melhores experiências da Tríplice Fronteira, além de
                  profissionais nativos da região super preparados para lhe auxiliar no que precisar.
                </p>
                <p className="text-sm font-medium text-[#001f3f] mb-2">Aproveite benefícios como:</p>
                <ul className="space-y-2 mb-6">
                  <BeneficioLinha>Mobilidade urbana</BeneficioLinha>
                  <BeneficioLinha>Mobilidade entre as aduanas</BeneficioLinha>
                  <BeneficioLinha>Segurança na tríplice fronteira</BeneficioLinha>
                  <BeneficioLinha>Hospedagem de qualidade</BeneficioLinha>
                  <BeneficioLinha>Ingressos rápidos e com descontos</BeneficioLinha>
                </ul>
                <button
                  type="button"
                  onClick={() => router.push('/cadastro/turista')}
                  className="w-full rounded-full py-3 font-bold text-white hover:bg-[#00b838] transition-colors"
                  style={{ backgroundColor: VERDE }}
                >
                  Cadastrar
                </button>
              </div>
            ) : null}
          </div>

          {/* Profissional */}
          <div>
            <button
              type="button"
              onClick={() => toggle('profissional')}
              className={`w-full py-4 rounded-lg text-lg font-bold transition-shadow ${
                aberto === 'profissional'
                  ? 'bg-[#0097b2] text-white shadow-md'
                  : 'bg-white text-[#0097b2] border-2 border-[#0097b2] shadow-[0_2px_8px_rgba(0,151,178,0.25)]'
              }`}
            >
              Profissional
            </button>
            {aberto === 'profissional' ? (
              <div className="mt-4 rounded-lg border border-[#0097b2]/30 bg-white p-4">
                <p className="text-[#0097b2] font-bold mb-2">Seja bem-vindo(a), profissional!</p>
                <p className="text-sm text-[#001f3f] leading-relaxed mb-4">
                  Faça parte do maior ecossistema de serviços da Tríplice Fronteira e conecte-se com empresas e turistas
                  que buscam experiências autênticas.
                </p>
                <p className="text-sm font-medium text-[#001f3f] mb-2">Aproveite benefícios como:</p>
                <ul className="space-y-2 mb-6">
                  <BeneficioLinha>Visibilidade para seu trabalho</BeneficioLinha>
                  <BeneficioLinha>Receba indicações de outros profissionais</BeneficioLinha>
                  <BeneficioLinha>Sistema de comissões e parcerias</BeneficioLinha>
                  <BeneficioLinha>Agendamento automático de atendimentos</BeneficioLinha>
                  <BeneficioLinha>Canal exclusivo com empresas parceiras</BeneficioLinha>
                </ul>
                <button
                  type="button"
                  onClick={() => router.push('/cadastro/profissional')}
                  className="w-full rounded-full py-3 font-bold text-white hover:bg-[#00b838] transition-colors"
                  style={{ backgroundColor: VERDE }}
                >
                  Cadastrar
                </button>
              </div>
            ) : null}
          </div>

          {/* Empresa */}
          <div>
            <button
              type="button"
              onClick={() => toggle('empresa')}
              className={`w-full py-4 rounded-lg text-lg font-bold transition-shadow ${
                aberto === 'empresa'
                  ? 'bg-[#0097b2] text-white shadow-md'
                  : 'bg-white text-[#0097b2] border-2 border-[#0097b2] shadow-[0_2px_8px_rgba(0,151,178,0.25)]'
              }`}
            >
              Empresa
            </button>
            {aberto === 'empresa' ? (
              <div className="mt-4 rounded-lg border border-[#0097b2]/30 bg-white p-4">
                <p className="text-[#0097b2] font-bold mb-2">Seja bem-vindo(a), empresa!</p>
                <p className="text-sm text-[#001f3f] leading-relaxed mb-4">
                  Conecte seu negócio ao ecossistema que movimenta a Tríplice Fronteira e alcance turistas de todo o mundo
                  que visitam a região.
                </p>
                <p className="text-sm font-medium text-[#001f3f] mb-2">Aproveite benefícios como:</p>
                <ul className="space-y-2 mb-6">
                  <BeneficioLinha>Destaque e canal de vendas no Guia Turístico</BeneficioLinha>
                  <BeneficioLinha>Divulgue ofertas e comissões para profissionais</BeneficioLinha>
                  <BeneficioLinha>Receba avaliações e aumente sua reputação</BeneficioLinha>
                  <BeneficioLinha>Tour 360° para mostrar seu estabelecimento</BeneficioLinha>
                  <BeneficioLinha>Relatórios de mercado e tendências</BeneficioLinha>
                </ul>
                <button
                  type="button"
                  onClick={() => router.push('/cadastro/empresa')}
                  className="w-full rounded-full py-3 font-bold text-white hover:bg-[#00b838] transition-colors"
                  style={{ backgroundColor: VERDE }}
                >
                  Cadastrar
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          <a href="/politicas" className="text-[#0097b2] hover:underline">
            Políticas de Privacidade
          </a>
          <span className="mx-2">|</span>
          <a href="/regras" className="text-[#0097b2] hover:underline">
            Regras do Ecossistema
          </a>
        </div>
      </div>
    </div>
  )
}
