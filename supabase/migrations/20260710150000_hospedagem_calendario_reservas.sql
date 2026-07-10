-- Etapa 2: vínculo reserva↔ acomodação, bloqueios de calendário, pós check-out

ALTER TABLE public.reservas_hospedagem
  ADD COLUMN IF NOT EXISTS acomodacao_id UUID REFERENCES public.hospedagem_acomodacoes (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_hospedes INTEGER CHECK (numero_hospedes IS NULL OR numero_hospedes >= 1),
  ADD COLUMN IF NOT EXISTS pos_checkout_status TEXT
    CHECK (
      pos_checkout_status IS NULL
      OR pos_checkout_status IN ('disponivel', 'ocupado')
    );

CREATE INDEX IF NOT EXISTS idx_reservas_hospedagem_acomodacao
  ON public.reservas_hospedagem (acomodacao_id)
  WHERE acomodacao_id IS NOT NULL;

COMMENT ON COLUMN public.reservas_hospedagem.acomodacao_id IS 'Acomodação escolhida na reserva (etapa 2).';
COMMENT ON COLUMN public.reservas_hospedagem.numero_hospedes IS 'Quantidade de hóspedes informada no drawer 3.';
COMMENT ON COLUMN public.reservas_hospedagem.pos_checkout_status IS
  'Resposta do anfitrião no check-out: disponível ou ocupado.';

-- Ampliar formas de pagamento (crédito/débito separados + legado)
ALTER TABLE public.reservas_hospedagem
  DROP CONSTRAINT IF EXISTS reservas_hospedagem_forma_pagamento_check;

ALTER TABLE public.reservas_hospedagem
  ADD CONSTRAINT reservas_hospedagem_forma_pagamento_check
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN (
      'dinheiro',
      'pix',
      'cartao_deb_cred',
      'cartao_credito',
      'cartao_debito'
    )
  );

-- Bloqueios manuais de calendário (outros canais)
CREATE TABLE IF NOT EXISTS public.hospedagem_bloqueios_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  acomodacao_id UUID NOT NULL REFERENCES public.hospedagem_acomodacoes (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hospedagem_bloqueios_periodo CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_hospedagem_bloqueios_acomodacao
  ON public.hospedagem_bloqueios_calendario (acomodacao_id, data_inicio, data_fim);

ALTER TABLE public.hospedagem_bloqueios_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura bloqueios hospedagem" ON public.hospedagem_bloqueios_calendario;
CREATE POLICY "Leitura bloqueios hospedagem"
  ON public.hospedagem_bloqueios_calendario
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Dono gerencia bloqueios" ON public.hospedagem_bloqueios_calendario;
CREATE POLICY "Dono gerencia bloqueios"
  ON public.hospedagem_bloqueios_calendario
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );
