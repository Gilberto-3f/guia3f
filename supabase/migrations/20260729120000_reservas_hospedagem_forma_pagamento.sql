-- Preferência de pagamento informada pelo turista na solicitação de reserva.
ALTER TABLE public.reservas_hospedagem
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN ('dinheiro', 'pix', 'cartao_deb_cred')
  );

COMMENT ON COLUMN public.reservas_hospedagem.forma_pagamento IS 'Preferência de pagamento do turista (dinheiro, pix ou cartão déb/créd).';
