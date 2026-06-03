import { PaginaLegalView } from '@/components/legal/PaginaLegalView'
import { buscarTextoLegal } from '@/lib/legalConteudo'

export default async function PoliticasPage() {
  const texto = await buscarTextoLegal('politicas_privacidade')
  return <PaginaLegalView titulo="Políticas de privacidade" texto={texto} />
}
