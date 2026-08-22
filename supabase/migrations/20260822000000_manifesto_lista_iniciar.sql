-- Fila do manifesto: INICIAR LISTA, check/X do passageiro, concluir no fim da LISTA.

ALTER TABLE public.manifesto_diario
  ADD COLUMN IF NOT EXISTS lista_iniciada_em TIMESTAMPTZ;

COMMENT ON COLUMN public.manifesto_diario.lista_iniciada_em IS
  'Quando o profissional tocou INICIAR LISTA no manifesto do dia.';

ALTER TABLE public.manifesto_passageiros
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS cancelamento_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS solicitacao_id UUID;

ALTER TABLE public.manifesto_passageiros
  DROP CONSTRAINT IF EXISTS manifesto_passageiros_status_check;

ALTER TABLE public.manifesto_passageiros
  ADD CONSTRAINT manifesto_passageiros_status_check
  CHECK (status IN ('pendente', 'recebido', 'cancelado'));

CREATE INDEX IF NOT EXISTS idx_manifesto_passageiros_solicitacao
  ON public.manifesto_passageiros (solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_manifesto_passageiros_status
  ON public.manifesto_passageiros (manifesto_id, status, ordem);

COMMENT ON COLUMN public.manifesto_passageiros.status IS
  'pendente = na fila; recebido = check de receptivo; cancelado = X com justificativa.';
COMMENT ON COLUMN public.manifesto_passageiros.solicitacao_id IS
  'Corrida de mobilidade deste passageiro (mapa da vez / cancelamento / recibo).';
