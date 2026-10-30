-- 42P16: CREATE OR REPLACE VIEW não pode inserir colunas no meio
--   (p.* ganhou empresa_marcada_id / marcacao_oculta_em antes de `usuarios`).
-- 57014: regravar_vinculos_eco_canais fazia DELETE total + lookup plpgsql por linha
--   (trigger de ecossistema_cidades e backfill). Sem fallback para o padrão (Tríplice).

SET lock_timeout = '8s';
SET statement_timeout = '60s';

-- ========== 1) View do feed (marcação de empresa) ==========
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS empresa_marcada_id uuid REFERENCES public.empresas (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marcacao_oculta_em timestamptz;

DROP VIEW IF EXISTS public.posts_com_autores;

CREATE VIEW public.posts_com_autores
WITH
  (security_invoker = TRUE) AS
SELECT
  p.*,
  jsonb_build_object(
    'id',
    u.id,
    'email',
    u.email,
    'role',
    u.role,
    'turistas',
    CASE
      WHEN t.id IS NOT NULL THEN
        jsonb_build_object(
          'nome_completo',
          t.nome_completo,
          'nome_usuario',
          t.nome_usuario,
          'foto_perfil_url',
          t.foto_perfil_url,
          'foto_url',
          t.foto_url
        )
      ELSE NULL
    END,
    'profissionais',
    CASE
      WHEN pr.id IS NOT NULL THEN
        jsonb_build_object(
          'nome_completo',
          pr.nome_completo,
          'nome_usuario',
          pr.nome_usuario,
          'foto_perfil_url',
          pr.foto_perfil_url,
          'foto_url',
          pr.foto_url,
          'docs_verificado',
          pr.docs_verificado,
          'status',
          pr.status
        )
      ELSE NULL
    END,
    'empresas',
    CASE
      WHEN e.id IS NOT NULL THEN
        jsonb_build_object(
          'id',
          e.id,
          'nome_fantasia',
          e.nome_fantasia,
          'nome_usuario',
          e.nome_usuario,
          'foto_url',
          e.foto_url,
          'docs_verificado',
          e.docs_verificado,
          'status',
          e.status,
          'somente_anfitriao',
          e.somente_anfitriao
        )
      ELSE NULL
    END
  ) AS usuarios
FROM
  public.posts p
  INNER JOIN public.usuarios u ON p.autor_id = u.id
  LEFT JOIN public.turistas t ON u.id = t.usuario_id
  LEFT JOIN public.profissionais pr ON u.id = pr.usuario_id
    AND COALESCE(pr.somente_modo_apresentacao, FALSE) = FALSE
  LEFT JOIN public.empresas e ON u.id = e.usuario_id
    AND COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
    AND (
      COALESCE(e.somente_anfitriao, FALSE) = FALSE
      OR COALESCE(p.autor_tipo, '') = 'empresa'
    )
WHERE
  p.deleted_at IS NULL;

COMMENT ON VIEW public.posts_com_autores IS
  'Posts com autor; empresa somente_anfitriao só quando autor_tipo=empresa.';

GRANT SELECT ON public.posts_com_autores TO authenticated;

-- ========== 2) Regravação de canais por cidade (set-based) ==========
CREATE OR REPLACE FUNCTION public.chaves_equivalentes_cidade_eco(p text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE n
    WHEN '' THEN ARRAY[]::text[]
    WHEN 'foz do iguacu' THEN ARRAY['foz do iguacu', 'foz']
    WHEN 'foz' THEN ARRAY['foz do iguacu', 'foz']
    WHEN 'ciudad del este' THEN ARRAY['ciudad del este', 'cidade do leste', 'cde']
    WHEN 'cidade do leste' THEN ARRAY['ciudad del este', 'cidade do leste', 'cde']
    WHEN 'cde' THEN ARRAY['ciudad del este', 'cidade do leste', 'cde']
    WHEN 'puerto iguazu' THEN ARRAY['puerto iguazu']
    ELSE ARRAY[n]
  END
  FROM (SELECT public.normalizar_chave_cidade_eco(p) AS n) s;
$$;

CREATE OR REPLACE FUNCTION public.cidades_eco_equivalentes(a text, b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.chaves_equivalentes_cidade_eco(a)
      && public.chaves_equivalentes_cidade_eco(b);
$$;

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
SET statement_timeout = '30s'
AS $$
BEGIN
  DELETE FROM public.empresa_ecossistemas;

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

  DELETE FROM public.profissional_ecossistemas;

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

COMMENT ON FUNCTION public.eco_canais_id_por_cidade(jsonb) IS
  'Sobrecarga: extrai texto e resolve o eco de canais. Sem fallback para o padrão.';
COMMENT ON FUNCTION public.regravar_vinculos_eco_canais() IS
  'Regrava empresa_ecossistemas e profissional_ecossistemas pela cidade do cadastro (set-based).';

REVOKE ALL ON FUNCTION public.regravar_vinculos_eco_canais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regravar_vinculos_eco_canais() TO service_role;

SELECT public.regravar_vinculos_eco_canais();
