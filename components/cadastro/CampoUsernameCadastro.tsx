'use client'

import type { UsernameStatus } from '@/hooks/useUsernameDisponivel'

type CampoUsernameCadastroProps = {
  id: string
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  feedback: string
  status: UsernameStatus
  inputClassName: string
  required?: boolean
}

export default function CampoUsernameCadastro({
  id,
  label,
  value,
  onChange,
  placeholder,
  feedback,
  status,
  inputClassName,
  required = true,
}: CampoUsernameCadastroProps) {
  const handleChange = (raw: string) => {
    const limpo = raw
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
      .slice(0, 20)
    onChange(limpo)
  }

  const feedbackCls =
    status === 'available'
      ? 'font-bold text-[#4ade80]'
      : status === 'unavailable'
        ? 'font-bold text-[#0097b2]'
        : status === 'checking'
          ? 'text-gray-500'
          : 'text-[#001f3f]/80'

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#001f3f]">
        {label}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-white"
          aria-hidden
        >
          @
        </span>
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClassName} pl-8`}
          autoComplete="username"
          spellCheck={false}
        />
      </div>
      {feedback ? (
        <p className={`mt-1 flex items-center gap-1.5 text-xs ${feedbackCls}`}>
          {status === 'available' ? (
            <span className="text-base leading-none text-[#4ade80]" aria-hidden>
              ✅
            </span>
          ) : null}
          {status === 'unavailable' && feedback !== '' ? (
            <span className="text-sm font-bold leading-none text-red-600" aria-hidden>
              ✕
            </span>
          ) : null}
          <span>{feedback}</span>
        </p>
      ) : null}
    </div>
  )
}
