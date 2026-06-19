-- Turista pode consultar suas próprias solicitações (habilita avaliação pós-contratação no cartão de visita)
DROP POLICY IF EXISTS "solicitacao_mobilidade select turista own" ON public.solicitacao_mobilidade;
CREATE POLICY "solicitacao_mobilidade select turista own" ON public.solicitacao_mobilidade FOR SELECT
USING (turista_id = auth.uid ());
