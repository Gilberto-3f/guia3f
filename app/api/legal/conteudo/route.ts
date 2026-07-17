import { NextRequest, NextResponse } from 'next/server'
import { buscarTextoLegal, type CampoLegal } from '@/lib/legalConteudo'

const CAMPOS: CampoLegal[] = ['politicas_privacidade', 'termos_uso', 'regras_ecossistema']

/** Textos institucionais públicos (cadastro sem sessão — RLS de config_geral exige auth). */
export async function GET(req: NextRequest) {
  const campo = String(req.nextUrl.searchParams.get('campo') || '').trim() as CampoLegal
  if (!CAMPOS.includes(campo)) {
    return NextResponse.json({ error: 'campo_invalido' }, { status: 400 })
  }
  try {
    const texto = await buscarTextoLegal(campo)
    return NextResponse.json({ campo, texto })
  } catch {
    return NextResponse.json({ error: 'erro' }, { status: 500 })
  }
}
