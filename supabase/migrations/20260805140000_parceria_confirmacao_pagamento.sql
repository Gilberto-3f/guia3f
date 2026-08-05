-- Confirmação bilateral de pagamento/recebimento em parcerias (sem timeout).
ALTER TABLE public.parcerias_profissionais
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recebimento_confirmado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recebimento_confirmado_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS liquidado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.parcerias_profissionais.pagamento_confirmado_em IS
  'Quem deve pagar (indicado) confirmou o pagamento. Sem timeout — fica pendente até as duas partes.';
COMMENT ON COLUMN public.parcerias_profissionais.recebimento_confirmado_em IS
  'Quem recebe (indicador) confirmou o recebimento.';
COMMENT ON COLUMN public.parcerias_profissionais.liquidado_em IS
  'Preenchido quando pagamento e recebimento foram confirmados.';
