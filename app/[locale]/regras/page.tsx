import { PaginaLegalView } from '@/components/legal/PaginaLegalView'
import { buscarTextoLegal } from '@/lib/legalConteudo'

export default async function RegrasPage() {
  const texto = await buscarTextoLegal('regras_ecossistema')
  return <PaginaLegalView titulo="Regras do ecossistema" texto={texto} />
}
