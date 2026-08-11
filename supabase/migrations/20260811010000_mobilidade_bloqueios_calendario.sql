-- Calendário de mobilidade (guia/van/taxista): datas bloqueadas (opt-out),
-- espelhando hospedagem_bloqueios_calendario. Dias sem bloqueio = disponíveis.

CREATE TABLE IF NOT EXISTS public.mobilidade_bloqueios_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  data DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mobilidade_bloqueios_prof_data_uq UNIQUE (profissional_id, data)
);

CREATE INDEX IF NOT EXISTS idx_mobilidade_bloqueios_prof_data
  ON public.mobilidade_bloqueios_calendario (profissional_id, data);

COMMENT ON TABLE public.mobilidade_bloqueios_calendario IS
  'Datas em que o profissional de mobilidade não atende (pré-agendamento). Demais dias ficam livres.';

ALTER TABLE public.mobilidade_bloqueios_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional lê próprios bloqueios mobilidade" ON public.mobilidade_bloqueios_calendario;
CREATE POLICY "Profissional lê próprios bloqueios mobilidade"
  ON public.mobilidade_bloqueios_calendario
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.id = profissional_id
        AND p.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Profissional gerencia próprios bloqueios mobilidade" ON public.mobilidade_bloqueios_calendario;
CREATE POLICY "Profissional gerencia próprios bloqueios mobilidade"
  ON public.mobilidade_bloqueios_calendario
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.id = profissional_id
        AND p.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.id = profissional_id
        AND p.usuario_id = auth.uid()
    )
  );

-- Leitura pública autenticada (Ecossistema vê agenda do parceiro)
DROP POLICY IF EXISTS "Autenticados leem bloqueios mobilidade" ON public.mobilidade_bloqueios_calendario;
CREATE POLICY "Autenticados leem bloqueios mobilidade"
  ON public.mobilidade_bloqueios_calendario
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, DELETE ON public.mobilidade_bloqueios_calendario TO authenticated;
GRANT ALL ON public.mobilidade_bloqueios_calendario TO service_role;
