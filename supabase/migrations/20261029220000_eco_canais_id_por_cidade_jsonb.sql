-- 42883: eco_canais_id_por_cidade(jsonb) does not exist
-- A função original só aceita text; regravar passava empresas.cidade cru
-- (produção pode ser jsonb) e o trigger/backfill de 28/10 estourava.
-- Sem fallback para o bloco padrão (Tríplice).

CREATE OR REPLACE FUNCTION public.eco_canais_id_por_cidade(p_cidade jsonb)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT public.eco_canais_id_por_cidade(public.primeira_cidade_atuacao_eco(p_cidade));
$$;

CREATE OR REPLACE FUNCTION public.regravar_vinculos_eco_canais()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.empresa_ecossistemas;

  INSERT INTO public.empresa_ecossistemas (empresa_id, ecossistema_id)
  SELECT x.empresa_id, x.ecossistema_id
  FROM (
    SELECT e.id AS empresa_id,
      public.eco_canais_id_por_cidade(
        public.primeira_cidade_atuacao_eco(to_jsonb(e.cidade))
      ) AS ecossistema_id
    FROM public.empresas e
  ) x
  WHERE x.ecossistema_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  DELETE FROM public.profissional_ecossistemas;

  INSERT INTO public.profissional_ecossistemas (profissional_id, ecossistema_id)
  SELECT x.profissional_id, x.ecossistema_id
  FROM (
    SELECT p.id AS profissional_id,
      public.eco_canais_id_por_cidade(
        public.primeira_cidade_atuacao_eco(to_jsonb(p.cidade_atuacao))
      ) AS ecossistema_id
    FROM public.profissionais p
  ) x
  WHERE x.ecossistema_id IS NOT NULL
  ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.eco_canais_id_por_cidade(jsonb) IS
  'Sobrecarga: extrai texto (string, array ou jsonb) e resolve o eco de canais. Sem fallback para o padrão.';

REVOKE ALL ON FUNCTION public.regravar_vinculos_eco_canais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regravar_vinculos_eco_canais() TO service_role;

SELECT public.regravar_vinculos_eco_canais();
