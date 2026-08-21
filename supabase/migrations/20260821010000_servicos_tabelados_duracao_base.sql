-- Base futura das rotas tabeladas: duração (taxi), ida-volta (van), horas (guia).
-- Não altera regra de encerrar atendimento.

ALTER TABLE public.servicos_tabelados_rotas
  ADD COLUMN IF NOT EXISTS duracao_estimada_min INTEGER NULL
    CHECK (duracao_estimada_min IS NULL OR duracao_estimada_min > 0),
  ADD COLUMN IF NOT EXISTS usar_eta_mapbox BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS ida_volta BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS duracao_horas NUMERIC(5, 2) NULL
    CHECK (duracao_horas IS NULL OR duracao_horas > 0);

COMMENT ON COLUMN public.servicos_tabelados_rotas.duracao_estimada_min IS
  'Taxista: duração estimada do deslocamento (minutos). Não trava Finalizar.';
COMMENT ON COLUMN public.servicos_tabelados_rotas.usar_eta_mapbox IS
  'Taxista: usar ETA Mapbox (ruas) no atendimento. Default efetivo: true.';
COMMENT ON COLUMN public.servicos_tabelados_rotas.ida_volta IS
  'Van: true = ida e volta (hora_saida + hora_retorno). false = somente ida.';
COMMENT ON COLUMN public.servicos_tabelados_rotas.duracao_horas IS
  'Guia: duração em horas quando tipo_periodo_guia = horas.';

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_rotas_tipo_periodo_guia_check;

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_guia_periodo_chk;

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_rotas_tipo_periodo_guia_check CHECK (
    tipo_periodo_guia IS NULL
    OR tipo_periodo_guia IN ('acompanhamento', 'diaria', 'horas')
  );

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_guia_periodo_chk CHECK (
    categoria <> 'guia'
    OR (
      hora_saida IS NULL
      AND hora_retorno IS NULL
      AND (
        (
          tipo_periodo_guia IN ('acompanhamento', 'diaria')
          AND hora_inicio IS NOT NULL
          AND hora_fim IS NOT NULL
        )
        OR (
          tipo_periodo_guia = 'horas'
          AND duracao_horas IS NOT NULL
        )
      )
    )
  ) NOT VALID;

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_van_horario_chk;

-- Vans antigas (antes dos horários) podem ficar sem hora_saida.
-- Novas: app exige saída; se ida e volta, exige retorno.
ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_van_horario_chk CHECK (
    categoria <> 'van'
    OR (
      tipo_periodo_guia IS NULL
      AND hora_inicio IS NULL
      AND hora_fim IS NULL
      AND (
        hora_saida IS NULL
        OR COALESCE(ida_volta, TRUE) = FALSE
        OR hora_retorno IS NOT NULL
      )
    )
  ) NOT VALID;

UPDATE public.servicos_tabelados_rotas
SET ida_volta = TRUE
WHERE categoria = 'van'
  AND ida_volta IS NULL
  AND hora_saida IS NOT NULL;

UPDATE public.servicos_tabelados_rotas
SET usar_eta_mapbox = TRUE
WHERE categoria = 'taxista'
  AND usar_eta_mapbox IS NULL;
