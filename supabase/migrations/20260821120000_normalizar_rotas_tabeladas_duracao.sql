-- Normaliza duração/ida-volta/horas nas rotas tabeladas.
-- Idempotente: pode rodar mesmo se 20260821010000 / 11000 falharam ou reverteram.
--
-- O que aconteceu:
-- 1) Check antigo da van exigia hora_saida + hora_retorno.
-- 2) Vans de junho (ex.: CDE → Foz) não têm horário.
-- 3) UPDATE ida_volta = true nessas linhas violou o check (23514).
-- 4) O SQL Editor reverteu a transação inteira → colunas sumiram (42703).

ALTER TABLE public.servicos_tabelados_rotas
  ADD COLUMN IF NOT EXISTS duracao_estimada_min INTEGER NULL;

ALTER TABLE public.servicos_tabelados_rotas
  ADD COLUMN IF NOT EXISTS usar_eta_mapbox BOOLEAN NULL;

ALTER TABLE public.servicos_tabelados_rotas
  ADD COLUMN IF NOT EXISTS ida_volta BOOLEAN NULL;

ALTER TABLE public.servicos_tabelados_rotas
  ADD COLUMN IF NOT EXISTS duracao_horas NUMERIC(5, 2) NULL;

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_rotas_duracao_estimada_min_check;

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_rotas_duracao_estimada_min_check CHECK (
    duracao_estimada_min IS NULL OR duracao_estimada_min > 0
  );

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_rotas_duracao_horas_check;

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_rotas_duracao_horas_check CHECK (
    duracao_horas IS NULL OR duracao_horas > 0
  );

-- Check inline antigo de tipo_periodo_guia (só acompanhamento/diaria).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'servicos_tabelados_rotas'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%tipo_periodo_guia%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.servicos_tabelados_rotas DROP CONSTRAINT IF EXISTS %I',
      r.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.servicos_tabelados_rotas
  ADD CONSTRAINT servicos_tabelados_rotas_tipo_periodo_guia_check CHECK (
    tipo_periodo_guia IS NULL
    OR tipo_periodo_guia IN ('acompanhamento', 'diaria', 'horas')
  );

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_guia_periodo_chk;

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
        OR tipo_periodo_guia IS NULL
      )
    )
  ) NOT VALID;

ALTER TABLE public.servicos_tabelados_rotas
  DROP CONSTRAINT IF EXISTS servicos_tabelados_van_horario_chk;

-- Van legado sem horário: válido. Ida e volta só exige retorno se já houver saída.
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

COMMENT ON COLUMN public.servicos_tabelados_rotas.duracao_estimada_min IS
  'Taxista: duração estimada do deslocamento (minutos). Não trava Finalizar.';
COMMENT ON COLUMN public.servicos_tabelados_rotas.usar_eta_mapbox IS
  'Taxista: usar ETA Mapbox (ruas) no atendimento. Default efetivo: true.';
COMMENT ON COLUMN public.servicos_tabelados_rotas.ida_volta IS
  'Van: true = ida e volta. false = somente ida. null = legado (tratar como ida e volta).';
COMMENT ON COLUMN public.servicos_tabelados_rotas.duracao_horas IS
  'Guia: duração em horas quando tipo_periodo_guia = horas.';

UPDATE public.servicos_tabelados_rotas
SET ida_volta = TRUE
WHERE categoria = 'van'
  AND ida_volta IS NULL
  AND hora_saida IS NOT NULL;

UPDATE public.servicos_tabelados_rotas
SET usar_eta_mapbox = TRUE
WHERE categoria = 'taxista'
  AND usar_eta_mapbox IS NULL;
