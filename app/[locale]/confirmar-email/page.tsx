'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const AZUL = '#0097b2'
const VERDE = '#00D443'

function ConfirmarEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') ?? ''

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [reenviando, setReenviando] = useState(false)

  const codigo = digits.join('')

  const focusIndex = useCallback((i: number) => {
    inputsRef.current[i]?.focus()
    inputsRef.current[i]?.select()
  }, [])

  useEffect(() => {
    if (emailParam) focusIndex(0)
  }, [emailParam, focusIndex])

  const handleChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1)
    setErro('')
    setDigits((prev) => {
      const next = [...prev]
      next[index] = v
      return next
    })
    if (v && index < 5) focusIndex(index + 1)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) focusIndex(index - 1)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    setErro('')
    focusIndex(Math.min(text.length, 5))
  }

  const verificar = async () => {
    if (!emailParam.trim()) {
      setErro('E-mail não informado. Volte ao cadastro ou ao login.')
      return
    }
    if (codigo.length !== 6) {
      setErro('Digite o código de 6 dígitos.')
      return
    }
    setErro('')
    setCarregando(true)
    try {
      const email = emailParam.trim().toLowerCase()
      let { error } = await supabase.auth.verifyOtp({
        email,
        token: codigo,
        type: 'signup',
      })
      if (error) {
        const segundo = await supabase.auth.verifyOtp({
          email,
          token: codigo,
          type: 'email',
        })
        error = segundo.error
      }
      if (error) {
        setErro(error.message)
        return
      }
      router.push('/guia')
    } catch {
      setErro('Não foi possível verificar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const reenviar = async () => {
    if (!emailParam.trim()) {
      setErro('E-mail não informado.')
      return
    }
    setErro('')
    setReenviando(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailParam.trim().toLowerCase(),
      })
      if (error) {
        setErro(error.message)
        return
      }
      setDigits(['', '', '', '', '', ''])
      focusIndex(0)
    } catch {
      setErro('Não foi possível reenviar o código.')
    } finally {
      setReenviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0097b2] flex flex-col items-center justify-center p-4">
      <div className="mb-6 flex justify-center">
        <Image src="/logo.png" alt="Guia 3F" width={150} height={50} priority className="h-auto w-auto object-contain" />
      </div>

      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl border-2 border-[#0097b2] p-8 w-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
          <h1 className="mb-4 text-center text-lg font-bold text-[#0097b2] md:text-xl">
            Ficha de Cadastro TURISTA
          </h1>

          <p className="mb-2 text-sm italic text-[#001f3f]">Verifique seu E-mail:</p>
          <input
            type="text"
            readOnly
            value={emailParam || '—'}
            className="mb-4 w-full rounded-lg bg-[#0097b2] px-4 py-3 text-sm text-white outline-none"
            aria-label="E-mail para verificação"
          />

          <p className="mb-4 text-sm italic text-[#001f3f]">insira o código e confirmação com 6 digitos</p>

          {!emailParam ? (
            <p className="mb-4 text-center text-sm text-red-600">
              Abra este link a partir do e-mail de confirmação ou informe o e-mail na URL (?email=).
            </p>
          ) : null}

          <div className="mb-6 flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-12 w-10 rounded-lg border-2 border-[#0097b2] bg-white text-center text-lg font-semibold text-[#001f3f] outline-none sm:h-14 sm:w-12"
                aria-label={`Dígito ${i + 1}`}
              />
            ))}
          </div>

          {erro ? <p className="mb-4 text-center text-sm text-red-600">{erro}</p> : null}

          <button
            type="button"
            onClick={verificar}
            disabled={carregando || digits.some((d) => !d)}
            className="mb-4 w-full rounded-full py-3.5 font-bold text-white transition-colors disabled:opacity-60 hover:bg-[#00b838]"
            style={{ backgroundColor: VERDE }}
          >
            {carregando ? 'Verificando...' : 'CONFIRMAR'}
          </button>

          <p className="mb-2 text-center text-sm italic text-[#001f3f]">Não chegou?</p>
          <button
            type="button"
            onClick={reenviar}
            disabled={reenviando || !emailParam}
            className="mb-6 w-full rounded-full bg-[#0097b2] py-3 font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-95"
          >
            {reenviando ? 'Enviando...' : 'Reinviar'}
          </button>

          <p className="mb-6 text-center text-sm italic leading-relaxed text-[#001f3f]">
            Após a confirmação o app estará disponível para uso e seu cadastro será enviado para analise, após a
            aprovação inumeros benefícios estarão liberados para você aproveitar!
          </p>

          <div className="flex justify-center border-t border-gray-100 pt-6">
            <Image
              src="/logo.png"
              alt="Guia 3F"
              width={120}
              height={40}
              className="h-8 w-auto opacity-90"
              style={{ filter: 'brightness(0) saturate(100%) invert(48%) sepia(69%) saturate(500%) hue-rotate(145deg)' }}
            />
          </div>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm font-medium italic text-[#0097b2] hover:underline">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmarEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: AZUL }}>
          <p className="text-white">Carregando...</p>
        </div>
      }
    >
      <ConfirmarEmailForm />
    </Suspense>
  )
}
