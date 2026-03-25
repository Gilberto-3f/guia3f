import Link from 'next/link'

export default function RecuperarSenhaPage() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0097b2' }}>
      <div className="mx-auto max-w-md rounded-xl border-2 bg-white p-8" style={{ borderColor: '#0097b2' }}>
        <h1 className="text-lg font-bold text-gray-900">Recuperar senha</h1>
        <p className="mt-2 text-sm text-gray-600">Em breve você poderá redefinir a senha por e-mail.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium" style={{ color: '#0097b2' }}>
          Voltar para o login
        </Link>
      </div>
    </div>
  )
}
