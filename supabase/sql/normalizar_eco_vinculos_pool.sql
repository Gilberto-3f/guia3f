-- Cole no SQL Editor do Supabase (produção). Rode o arquivo inteiro.
-- Idempotente. NÃO chama regravar_vinculos_eco_canais() no final.
--
-- Logs 01/11 23:16–23:20:
--   REST 504/522 em anuncios, ecossistemas, degustacoes, RPCs de presença
--   Auth 504 refresh_token / 500 context canceled
--   Realtime: connection pool queue_timeout 12s
--   Postgres 57014 statement timeout + 08006 connection lost
-- Causa: trg_ecossistema_cidades_regrava_vinculos (FOR EACH STATEMENT)
-- chamava regravar_vinculos_eco_canais, que fazia DELETE total das tabelas
-- de vínculo a cada INSERT/UPDATE/DELETE em ecossistema_cidades — em paralelo
-- com o RPC do PATCH ADM. O wipe segura o pool; o resto (home, auth, realtime)
-- é sintoma.

-- 1) Soltar queries presas nessa função
SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state <> 'idle'
  AND query ILIKE '%regravar_vinculos%';

-- 2) Remover o trigger que satura o pool
DROP TRIGGER IF EXISTS trg_ecossistema_cidades_regrava_vinculos ON public.ecossistema_cidades;
DROP FUNCTION IF EXISTS public.trg_regravar_vinculos_eco_canais();

-- 3) Regravar só o que mudou (DELETE com WHERE; chaves calculadas uma vez)
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
