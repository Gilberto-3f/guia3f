'use client'

type CampoUsernameCadastroProps = {
  id: string
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  feedback: string
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
      <p className="mt-1 text-xs text-[#001f3f]">{feedback}</p>
    </div>
  )
}
