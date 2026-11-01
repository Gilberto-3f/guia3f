-- Postgres 21000 "DELETE requires a WHERE clause": regravar_vinculos_eco_canais
-- apagava empresa_ecossistemas / profissional_ecossistemas sem filtro.
-- 23505 ecossistema_cidades: o trigger AFTER INSERT/DELETE reexecutava o wipe
-- no meio do replace delete+insert das cidades (PATCH ADM).
-- 57014 / Auth 504 / Realtime pool: o trigger reescrevia todos os vínculos
-- 2–3 vezes por save do eco e saturava o banco.

DROP TRIGGER IF EXISTS trg_ecossistema_cidades_regrava_vinculos ON public.ecossistema_cidades;

CREATE OR REPLACE FUNCTION public.regravar_vinculos_eco_canais()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
BEGIN
  DELETE FROM public.empresa_ecossistemas WHERE true;

  INSERT INTO public.empresa_ecossistemas (empresa_id, ecossistema_id)
  SELECT DISTINCT ON (emp.id) emp.id, eco.id
  FROM (
    SELECT
      e.id,
      public.primeira_cidade_atuacao_eco(to_jsonb(e.cidade)) AS cidade
    FROM public.empresas e
  ) emp
  INNER JOIN public.ecossistema_cidades c
    ON (
      public.chaves_equivalentes_cidade_eco(c.cidade_chave)
        && public.chaves_equivalentes_cidade_eco(emp.cidade)
      OR public.chaves_equivalentes_cidade_eco(c.cidade_label)
        && public.chaves_equivalentes_cidade_eco(emp.cidade)
    )
  INNER JOIN public.ecossistemas eco ON eco.id = c.ecossistema_id
  WHERE emp.cidade IS NOT NULL
  ORDER BY
    emp.id,
    CASE WHEN eco.tipo = 'regiao' THEN 0 ELSE 1 END,
    eco.ordem ASC
  ON CONFLICT DO NOTHING;

  DELETE FROM public.profissional_ecossistemas WHERE true;

  INSERT INTO public.profissional_ecossistemas (profissional_id, ecossistema_id)
  SELECT DISTINCT ON (prof.id) prof.id, eco.id
  FROM (
    SELECT
      p.id,
      public.primeira_cidade_atuacao_eco(to_jsonb(p.cidade_atuacao)) AS cidade
    FROM public.profissionais p
  ) prof
  INNER JOIN public.ecossistema_cidades c
    ON (
      public.chaves_equivalentes_cidade_eco(c.cidade_chave)
        && public.chaves_equivalentes_cidade_eco(prof.cidade)
      OR public.chaves_equivalentes_cidade_eco(c.cidade_label)
        && public.chaves_equivalentes_cidade_eco(prof.cidade)
    )
  INNER JOIN public.ecossistemas eco ON eco.id = c.ecossistema_id
  WHERE prof.cidade IS NOT NULL
  ORDER BY
    prof.id,
    CASE WHEN eco.tipo = 'regiao' THEN 0 ELSE 1 END,
    eco.ordem ASC
  ON CONFLICT DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.regravar_vinculos_eco_canais() IS
  'Regrava vínculos pela cidade do cadastro. Chamada só pelo ADM após criar/editar bloco (sem trigger em ecossistema_cidades).';

REVOKE ALL ON FUNCTION public.regravar_vinculos_eco_canais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regravar_vinculos_eco_canais() TO service_role;
