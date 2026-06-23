-- Campos de período/horário por categoria em serviços tabelados (guia e van)

ALTER TABLE public.servicos_tabelados_rotas
  ADD COLUMN IF NOT EXISTS tipo_periodo_guia VARCHAR(20) NULL
    CHECK (tipo_periodo_guia IS NULL OR tipo_periodo_guia IN ('acompanhamento', 'diaria')),
  ADD COLUMN IF NOT EXISTS hora_inicio TIME NULL,
  ADD COLUMN IF NOT EXISTS hora_fim TIME NULL,
  ADD COLUMN IF NOT EXISTS hora_saida TIME NULL,
  ADD COLUMN IF NOT EXISTS hora_retorno TIME NULL;

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_guia_periodo_chk;

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_guia_periodo_chk CHECK (
    categoria <> 'guia'
    OR (
      tipo_periodo_guia IS NOT NULL
      AND hora_inicio IS NOT NULL
      AND hora_fim IS NOT NULL
      AND hora_saida IS NULL
      AND hora_retorno IS NULL
    )
  ) NOT VALID;

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_van_horario_chk;

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_van_horario_chk CHECK (
    categoria <> 'van'
    OR (
      hora_saida IS NOT NULL
      AND hora_retorno IS NOT NULL
      AND tipo_periodo_guia IS NULL
      AND hora_inicio IS NULL
      AND hora_fim IS NULL
    )
  ) NOT VALID;

COMMENT ON COLUMN public.servicos_tabelados_rotas.tipo_periodo_guia IS
  'Guia: acompanhamento (média padrão) ou diária (período combinado) — um por tabela.';
COMMENT ON COLUMN public.servicos_tabelados_rotas.hora_inicio IS 'Guia: início do período (acompanhamento ou diária).';
COMMENT ON COLUMN public.servicos_tabelados_rotas.hora_fim IS 'Guia: fim do período (acompanhamento ou diária).';
COMMENT ON COLUMN public.servicos_tabelados_rotas.hora_saida IS 'Van: horário de saída (ida).';
COMMENT ON COLUMN public.servicos_tabelados_rotas.hora_retorno IS 'Van: horário de retorno (volta).';
