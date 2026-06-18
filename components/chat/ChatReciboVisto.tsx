'use client'

/** Recibo "Visto" abaixo da última mensagem lida pelo outro participante. */
export default function ChatReciboVisto({ visivel }: { visivel: boolean }) {
  if (!visivel) return null
  return <div className="mt-0.5 text-right text-[10px] font-medium text-[#0097b2]">Visto</div>
}
