-- Marcação de empresa em foto original (turista/profissional).
-- Ocultar na aba Marcações NÃO apaga o alfinete no feed/perfil.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS empresa_marcada_id uuid REFERENCES public.empresas (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marcacao_oculta_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_empresa_marcada_visivel
  ON public.posts (empresa_marcada_id, created_at DESC)
  WHERE empresa_marcada_id IS NOT NULL
    AND deleted_at IS NULL
    AND marcacao_oculta_em IS NULL;

COMMENT ON COLUMN public.posts.empresa_marcada_id IS
  'Empresa marcada na foto original; permanece no feed mesmo se marcacao_oculta_em estiver preenchido.';

COMMENT ON COLUMN public.posts.marcacao_oculta_em IS
  'Quando a empresa oculta a foto da aba Marcações (o alfinete do feed permanece).';

-- Autor não altera a marcação depois de publicar; ocultar só via RPC da empresa.
CREATE OR REPLACE FUNCTION public.trg_posts_marcacao_imutavel ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('guia.ocultar_marcacao', true) = '1' THEN
    NEW.empresa_marcada_id := OLD.empresa_marcada_id;
    RETURN NEW;
  END IF;
  NEW.empresa_marcada_id := OLD.empresa_marcada_id;
  NEW.marcacao_oculta_em := OLD.marcacao_oculta_em;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_marcacao_imutavel ON public.posts;

CREATE TRIGGER trg_posts_marcacao_imutavel
BEFORE UPDATE OF empresa_marcada_id, marcacao_oculta_em ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.trg_posts_marcacao_imutavel ();

CREATE OR REPLACE FUNCTION public.ocultar_marcacao_empresa_post (p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT e.id
  INTO v_emp_id
  FROM public.empresas e
  WHERE e.usuario_id = auth.uid ()
  LIMIT 1;

  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  PERFORM set_config('guia.ocultar_marcacao', '1', true);

  UPDATE public.posts
  SET
    marcacao_oculta_em = NOW()
  WHERE
    id = p_post_id
    AND empresa_marcada_id = v_emp_id
    AND deleted_at IS NULL
    AND marcacao_oculta_em IS NULL;
END;
$$;

COMMENT ON FUNCTION public.ocultar_marcacao_empresa_post (uuid) IS
  'Empresa oculta a foto da aba Marcações; o alfinete permanece no feed e no perfil do autor.';

REVOKE ALL ON FUNCTION public.ocultar_marcacao_empresa_post (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocultar_marcacao_empresa_post (uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_atividade_marcacao_empresa_foto ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_usuario_id uuid;
  v_autor_username text;
BEGIN
  IF NEW.empresa_marcada_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.autor_tipo, '') = 'empresa' THEN
    RETURN NEW;
  END IF;

  SELECT e.usuario_id
  INTO v_empresa_usuario_id
  FROM public.empresas e
  WHERE e.id = NEW.empresa_marcada_id
  LIMIT 1;

  IF v_empresa_usuario_id IS NULL OR v_empresa_usuario_id = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(p.username), ''), 'usuario')
  INTO v_autor_username
  FROM public.perfis_para_busca p
  WHERE p.usuario_id = NEW.autor_id
  LIMIT 1;

  v_autor_username := COALESCE(v_autor_username, 'usuario');

  INSERT INTO public.atividades (
    usuario_id,
    autor_id,
    tipo,
    alvo_id,
    alvo_tipo,
    dados_extras,
    created_at
  )
  VALUES (
    v_empresa_usuario_id,
    NEW.autor_id,
    'marcou_empresa_foto',
    NEW.id,
    'post',
    jsonb_build_object(
      'post_id', NEW.id::text,
      'empresa_id', NEW.empresa_marcada_id::text,
      'autor_id', NEW.autor_id::text,
      'autor_username', v_autor_username,
      'conteudo_url', COALESCE(NEW.conteudo_url, NEW.foto_url)
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_marcacao_empresa_foto () IS
  'Após INSERT de post com empresa marcada, cria atividade Minha Conta para o gestor da empresa.';

DROP TRIGGER IF EXISTS trg_atividades_marcacao_empresa_foto ON public.posts;

CREATE TRIGGER trg_atividades_marcacao_empresa_foto
AFTER INSERT ON public.posts
FOR EACH ROW
WHEN (NEW.empresa_marcada_id IS NOT NULL)
EXECUTE FUNCTION public.trg_atividade_marcacao_empresa_foto ();

-- CREATE OR REPLACE não pode inserir colunas no meio (p.* agora tem campos novos
-- antes de `usuarios`). DROP + CREATE coloca a lista atual no fim.
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

COMMENT ON VIEW public.posts_com_autores IS 'Posts com autor; empresa somente_anfitriao só quando autor_tipo=empresa.';

GRANT SELECT ON public.posts_com_autores TO authenticated;
