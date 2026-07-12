'use client'

import { useState } from 'react'
import { PopupTextoLegal, type CampoLegalPopup } from './PopupTextoLegal'

export function LinksAceitePoliticas({
  intro,
  privacyLabel,
  andLabel,
  termsLabel,
}: {
  intro: string
  privacyLabel: string
  andLabel: string
  termsLabel: string
}) {
  const [popup, setPopup] = useState<CampoLegalPopup | null>(null)

  return (
    <>
      <span>
        {intro}{' '}
        <button
          type="button"
          onClick={() => setPopup('politicas_privacidade')}
          className="underline hover:text-[#0097b2]"
        >
          {privacyLabel}
        </button>{' '}
        {andLabel}{' '}
        <button
          type="button"
          onClick={() => setPopup('termos_uso')}
          className="underline hover:text-[#0097b2]"
        >
          {termsLabel}
        </button>
        .
      </span>
      {popup ? <PopupTextoLegal campo={popup} onClose={() => setPopup(null)} /> : null}
    </>
  )
}
