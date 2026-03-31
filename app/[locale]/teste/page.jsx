'use client'

import { supabase } from '@/lib/supabase'

export default function PaginaTeste() {
  const testarConexao = async () => {
    console.log('🔄 Testando conexão com Supabase...')
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ Erro no Supabase:', error)
      alert('❌ Erro: ' + error.message)
    } else {
      console.log('✅ Dados recebidos:', data)
      alert('✅ Conectado! Usuários encontrados: ' + (data?.length || 0))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">
          🔌 Teste Supabase
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Clique no botão abaixo para testar a conexão com o banco de dados.
        </p>
        <button
          onClick={testarConexao}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Testar Conexão
        </button>
        <p className="text-xs text-gray-400 text-center mt-6">
          Esperado: "✅ Conectado! Usuários encontrados: 0"
        </p>
      </div>
    </div>
  )
}