-- Solicitações de reserva de hospedagem (turista → empresa confirma depois)

ALTER TABLE public.reservas_hospedagem
  ADD COLUMN IF NOT EXISTS turista_usuario_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS noites INTEGER;

CREATE INDEX IF NOT EXISTS idx_reservas_hospedagem_turista ON public.reservas_hospedagem (turista_usuario_id);

DROP POLICY IF EXISTS "reservas_hospedagem select turista" ON public.reservas_hospedagem;
CREATE POLICY "reservas_hospedagem select turista" ON public.reservas_hospedagem FOR SELECT
USING (turista_usuario_id = auth.uid ());

COMMENT ON COLUMN public.reservas_hospedagem.turista_usuario_id IS 'Turista que solicitou a reserva.';
COMMENT ON COLUMN public.reservas_hospedagem.valor_estimado IS 'Valor estimado (diária × noites) no momento da solicitação.';
COMMENT ON COLUMN public.reservas_hospedagem.noites IS 'Quantidade de diárias solicitadas.';
