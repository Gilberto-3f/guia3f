-- Empresa / profissional de pré-visualização (modo apresentação ADM): isolado na leitura pública.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS somente_modo_apresentacao BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.empresas.somente_modo_apresentacao IS 'TRUE: linha só para simulação ADM; outros utilizadores não veem (RLS).';

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS somente_modo_apresentacao BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profissionais.somente_modo_apresentacao IS 'TRUE: perfil profissional só para simulação ADM; oculto na leitura pública (RLS).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_um_preview_por_usuario
  ON public.empresas (usuario_id)
  WHERE somente_modo_apresentacao = TRUE;

-- Leitura: todos veem empresas “reais”; previews só o próprio dono (usuario_id).
DROP POLICY IF EXISTS "Usuários autenticados podem ver empresas" ON public.empresas;
CREATE POLICY "Usuários autenticados podem ver empresas" ON public.empresas FOR
SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      COALESCE(somente_modo_apresentacao, FALSE) = FALSE
      OR usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários autenticados podem ver profissionais" ON public.profissionais;
CREATE POLICY "Usuários autenticados podem ver profissionais" ON public.profissionais FOR
SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      COALESCE(somente_modo_apresentacao, FALSE) = FALSE
      OR usuario_id = auth.uid()
    )
  );

-- Não criar canais de comunidade para empresas de preview (evita poluir canais).
CREATE OR REPLACE FUNCTION public.criar_canais_empresa_comunidade ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comunidades TEXT[] := ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao'];
  c TEXT;
BEGIN
  IF COALESCE(NEW.somente_modo_apresentacao, FALSE) THEN
    RETURN NEW;
  END IF;

  FOREACH c IN ARRAY comunidades LOOP
    INSERT INTO public.canais (
      nome,
      tipo_publico,
      categoria,
      pais,
      ordem_tipo,
      ordem_posicao,
      ativo,
      empresa_id,
      comunidade_prof,
      empresa_categoria
    )
    VALUES (
      NEW.nome_fantasia,
      'empresa',
      NULL,
      'geral',
      'rotativo',
      NULL,
      TRUE,
      NEW.id,
      c,
      NEW.categoria
    )
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE
    SET
      nome = EXCLUDED.nome,
      empresa_categoria = EXCLUDED.empresa_categoria,
      ativo = TRUE;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Evita duplicar posts na view quando existir empresa “preview” + empresa real (mesmo usuario_id).
CREATE OR REPLACE VIEW public.posts_com_autores
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
          pr.foto_url
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
          e.foto_url
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
WHERE
  p.deleted_at IS NULL;

COMMENT ON VIEW public.posts_com_autores IS 'Posts não apagados (soft) com autor; ignora empresas/profissionais só de modo apresentação.';

GRANT SELECT ON public.posts_com_autores TO authenticated;
