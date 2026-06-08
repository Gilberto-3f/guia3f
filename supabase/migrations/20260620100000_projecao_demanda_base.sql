-- Base de dados para Expectativa e Projeção de Demanda (hospedagem + mobilidade).

-- ---------------------------------------------------------------------------
-- reservas_hospedagem (ocupação mensal — diárias reservadas vs disponíveis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservas_hospedagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL,
  data_checkin DATE NOT NULL,
  data_checkout DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('pendente', 'confirmada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservas_hospedagem_checkout_apos_checkin CHECK (data_checkout > data_checkin)
);

CREATE INDEX IF NOT EXISTS idx_reservas_hospedagem_checkin ON public.reservas_hospedagem (data_checkin);
CREATE INDEX IF NOT EXISTS idx_reservas_hospedagem_empresa ON public.reservas_hospedagem (empresa_id);

ALTER TABLE public.reservas_hospedagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservas_hospedagem insert autenticado" ON public.reservas_hospedagem;
CREATE POLICY "reservas_hospedagem insert autenticado" ON public.reservas_hospedagem FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "reservas_hospedagem select gestor empresa" ON public.reservas_hospedagem;
CREATE POLICY "reservas_hospedagem select gestor empresa" ON public.reservas_hospedagem FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e WHERE e.usuario_id = auth.uid ()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
  )
);

COMMENT ON TABLE public.reservas_hospedagem IS 'Reservas de hospedagem para cálculo de taxa de ocupação mensal.';

-- ---------------------------------------------------------------------------
-- Campos futuros em solicitacao_mobilidade (mapa de calor + agendamentos)
-- ---------------------------------------------------------------------------
ALTER TABLE public.solicitacao_mobilidade
  ADD COLUMN IF NOT EXISTS data_agendada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT NOT NULL DEFAULT 'mobilidade',
  ADD COLUMN IF NOT EXISTS lat_origem DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng_origem DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lat_destino DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng_destino DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS regiao TEXT;

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_agendada ON public.solicitacao_mobilidade (data_agendada);
CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_tipo ON public.solicitacao_mobilidade (tipo_servico);

COMMENT ON COLUMN public.solicitacao_mobilidade.data_agendada IS 'Data futura do atendimento (agendamento antecipado).';
COMMENT ON COLUMN public.solicitacao_mobilidade.tipo_servico IS 'mobilidade | hospedagem — para filtros de histórico.';
