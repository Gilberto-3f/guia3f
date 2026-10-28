-- Canais pela cidade do cadastro: região se a cidade pertence a uma; senão eco cidade.
-- Backfill de vínculos + trigger quando o ADM cria/edita região.
-- Sem fallback para o bloco padrão (Tríplice) se a cidade for conhecida.

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS atuacao_escopo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profissionais_atuacao_escopo_check'
  ) THEN
    ALTER TABLE public.profissionais
      ADD CONSTRAINT profissionais_atuacao_escopo_check
      CHECK (atuacao_escopo IS NULL OR atuacao_escopo IN ('cidade', 'regiao'));
  END IF;
END $$;

COMMENT ON COLUMN public.profissionais.atuacao_escopo IS
  'Mobilidade (Guia/Taxista/Van/Motorista de app): cidade vs região. Só matching, não canais.';

CREATE OR REPLACE FUNCTION public.normalizar_chave_cidade_eco(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    lower(trim(both FROM translate(
      coalesce(p, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ))),
    '\s+', ' ', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.cidades_eco_equivalentes(a text, b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  na text := public.normalizar_chave_cidade_eco(a);
  nb text := public.normalizar_chave_cidade_eco(b);
BEGIN
  IF na = '' OR nb = '' THEN
    RETURN false;
  END IF;
  IF na = nb THEN
    RETURN true;
  END IF;
  IF na IN ('foz do iguacu', 'foz') AND nb IN ('foz do iguacu', 'foz') THEN
    RETURN true;
  END IF;
  IF na IN ('ciudad del este', 'cidade do leste', 'cde')
     AND nb IN ('ciudad del este', 'cidade do leste', 'cde') THEN
    RETURN true;
  END IF;
  IF na IN ('puerto iguazu') AND nb IN ('puerto iguazu') THEN
    RETURN true;
  END IF;
  IF na = 'londrina' AND nb = 'londrina' THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.eco_canais_id_por_cidade(p_cidade text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT e.id
  FROM public.ecossistemas e
  INNER JOIN public.ecossistema_cidades c ON c.ecossistema_id = e.id
  WHERE public.cidades_eco_equivalentes(c.cidade_chave, p_cidade)
     OR public.cidades_eco_equivalentes(c.cidade_label, p_cidade)
  ORDER BY CASE WHEN e.tipo = 'regiao' THEN 0 ELSE 1 END, e.ordem ASC
  LIMIT 1;
$$;

-- cidade_atuacao no banco pode ser jsonb (produção) ou text[] (migration antiga).
CREATE OR REPLACE FUNCTION public.primeira_cidade_atuacao_eco(p jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR p = 'null'::jsonb THEN NULL
    WHEN jsonb_typeof(p) = 'array' THEN NULLIF(btrim(p->>0), '')
    WHEN jsonb_typeof(p) = 'string' THEN NULLIF(btrim(p#>>'{}'), '')
    ELSE NULLIF(btrim(p#>>'{}'), '')
  END;
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
    SELECT e.id AS empresa_id, public.eco_canais_id_por_cidade(e.cidade) AS ecossistema_id
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

CREATE OR REPLACE FUNCTION public.trg_regravar_vinculos_eco_canais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.regravar_vinculos_eco_canais();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecossistema_cidades_regrava_vinculos ON public.ecossistema_cidades;
CREATE TRIGGER trg_ecossistema_cidades_regrava_vinculos
AFTER INSERT OR UPDATE OR DELETE ON public.ecossistema_cidades
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_regravar_vinculos_eco_canais();

REVOKE ALL ON FUNCTION public.regravar_vinculos_eco_canais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regravar_vinculos_eco_canais() TO service_role;
REVOKE ALL ON FUNCTION public.trg_regravar_vinculos_eco_canais() FROM PUBLIC;

SELECT public.regravar_vinculos_eco_canais();

COMMENT ON FUNCTION public.eco_canais_id_por_cidade(text) IS
  'Eco de canais: região que contém a cidade, senão eco cidade. Sem fallback para o padrão.';
COMMENT ON FUNCTION public.regravar_vinculos_eco_canais() IS
  'Regrava empresa_ecossistemas e profissional_ecossistemas pela cidade do cadastro.';
