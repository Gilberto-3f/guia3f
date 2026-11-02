-- Postgres 21000 / PostgREST "DELETE requires a WHERE clause":
-- regravar_vinculos_eco_canais apagava empresa_ecossistemas /
-- profissional_ecossistemas sem filtro.
-- 23505 ecossistema_cidades: o trigger AFTER INSERT/DELETE reexecutava o wipe
-- no meio do replace das cidades (PATCH ADM).
-- 57014 / REST 504-522 / Auth 504 / Realtime queue_timeout: o trigger
-- reescrevia todos os vínculos 2–3 vezes por save e saturava o pool.
--
-- Não executar SELECT regravar_vinculos_eco_canais() aqui.

DROP TRIGGER IF EXISTS trg_ecossistema_cidades_regrava_vinculos ON public.ecossistema_cidades;
DROP FUNCTION IF EXISTS public.trg_regravar_vinculos_eco_canais();

CREATE OR REPLACE FUNCTION public.regravar_vinculos_eco_canais()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
BEGIN
  WITH emp AS (
    SELECT
      e.id,
      public.chaves_equivalentes_cidade_eco(
        public.primeira_cidade_atuacao_eco(to_jsonb(e.cidade))
      ) AS chaves
    FROM public.empresas e
  ),
  cids AS (
    SELECT
      c.ecossistema_id,
      public.chaves_equivalentes_cidade_eco(c.cidade_chave)
        || public.chaves_equivalentes_cidade_eco(c.cidade_label) AS chaves
    FROM public.ecossistema_cidades c
  ),
  desejado AS (
    SELECT DISTINCT ON (emp.id) emp.id AS empresa_id, eco.id AS ecossistema_id
    FROM emp
    INNER JOIN cids ON emp.chaves && cids.chaves
    INNER JOIN public.ecossistemas eco ON eco.id = cids.ecossistema_id
    WHERE cardinality(emp.chaves) > 0
    ORDER BY
      emp.id,
      CASE WHEN eco.tipo = 'regiao' THEN 0 ELSE 1 END,
      eco.ordem ASC
  ),
  apagados AS (
    DELETE FROM public.empresa_ecossistemas ee
    WHERE NOT EXISTS (
      SELECT 1
      FROM desejado d
      WHERE d.empresa_id = ee.empresa_id
        AND d.ecossistema_id = ee.ecossistema_id
    )
    RETURNING ee.empresa_id
  )
  INSERT INTO public.empresa_ecossistemas (empresa_id, ecossistema_id)
  SELECT d.empresa_id, d.ecossistema_id
  FROM desejado d
  ON CONFLICT DO NOTHING;

  WITH prof AS (
    SELECT
      p.id,
      public.chaves_equivalentes_cidade_eco(
        public.primeira_cidade_atuacao_eco(to_jsonb(p.cidade_atuacao))
      ) AS chaves
    FROM public.profissionais p
  ),
  cids AS (
    SELECT
      c.ecossistema_id,
      public.chaves_equivalentes_cidade_eco(c.cidade_chave)
        || public.chaves_equivalentes_cidade_eco(c.cidade_label) AS chaves
    FROM public.ecossistema_cidades c
  ),
  desejado AS (
    SELECT DISTINCT ON (prof.id) prof.id AS profissional_id, eco.id AS ecossistema_id
    FROM prof
    INNER JOIN cids ON prof.chaves && cids.chaves
    INNER JOIN public.ecossistemas eco ON eco.id = cids.ecossistema_id
    WHERE cardinality(prof.chaves) > 0
    ORDER BY
      prof.id,
      CASE WHEN eco.tipo = 'regiao' THEN 0 ELSE 1 END,
      eco.ordem ASC
  ),
  apagados AS (
    DELETE FROM public.profissional_ecossistemas pe
    WHERE NOT EXISTS (
      SELECT 1
      FROM desejado d
      WHERE d.profissional_id = pe.profissional_id
        AND d.ecossistema_id = pe.ecossistema_id
    )
    RETURNING pe.profissional_id
  )
  INSERT INTO public.profissional_ecossistemas (profissional_id, ecossistema_id)
  SELECT d.profissional_id, d.ecossistema_id
  FROM desejado d
  ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.regravar_vinculos_eco_canais() IS
  'Regrava vínculos pela cidade do cadastro, só o que mudou. Chamada pelo ADM após criar/editar cidades do bloco. Sem trigger em ecossistema_cidades.';

REVOKE ALL ON FUNCTION public.regravar_vinculos_eco_canais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regravar_vinculos_eco_canais() TO service_role;
