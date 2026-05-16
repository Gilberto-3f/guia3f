-- Aba Amigos: seguidores de empresas favoritadas veem interações do gestor (usuario_id da empresa).
-- Alinha RLS ao feed (`redecontatos` + `favoritos` alvo_tipo empresa).
-- Bloqueia notificações quando empresa interage com conteúdo de outra empresa.

CREATE OR REPLACE FUNCTION public.usuario_tem_role_empresa (p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND lower(coalesce(u.role::text, '')) = 'empresa'
  );
$$;

CREATE OR REPLACE FUNCTION public.deve_bloquear_atividade_entre_empresas (
  p_autor_conteudo UUID,
  p_interator_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.usuario_tem_role_empresa(p_autor_conteudo)
    AND public.usuario_tem_role_empresa(p_interator_id);
$$;

-- Curtida em post
CREATE OR REPLACE FUNCTION public.trg_atividade_curtida_post ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_post UUID;
BEGIN
  IF NEW.post_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    autor_id INTO v_autor_post
  FROM
    public.posts
  WHERE
    id = NEW.post_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor_post IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_post = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_post, NEW.usuario_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_post,
    NEW.usuario_id,
    'curtiu_post',
    NEW.post_id,
    'post',
    jsonb_build_object('post_id', NEW.post_id, 'curtida_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Curtida em comentário
CREATE OR REPLACE FUNCTION public.trg_atividade_curtida_comentario ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_comentario UUID;
  v_post UUID;
  v_texto TEXT;
BEGIN
  IF NEW.comentario_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    autor_id,
    post_id,
    texto INTO v_autor_comentario,
    v_post,
    v_texto
  FROM
    public.comentarios
  WHERE
    id = NEW.comentario_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor_comentario IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_comentario = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_comentario, NEW.usuario_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_comentario,
    NEW.usuario_id,
    'curtiu_comentario',
    NEW.comentario_id,
    'comentario',
    jsonb_build_object(
      'comentario_id',
      NEW.comentario_id,
      'post_id',
      v_post,
      'curtida_id',
      NEW.id,
      'texto',
      v_texto
    )
  );

  RETURN NEW;
END;
$$;

-- Comentário em post
CREATE OR REPLACE FUNCTION public.trg_atividade_comentario ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_post UUID;
BEGIN
  SELECT
    autor_id INTO v_autor_post
  FROM
    public.posts
  WHERE
    id = NEW.post_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor_post IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_post = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_post, NEW.autor_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_post,
    NEW.autor_id,
    'comentou',
    NEW.post_id,
    'post',
    jsonb_build_object('post_id', NEW.post_id, 'comentario_id', NEW.id, 'texto', NEW.texto)
  );

  RETURN NEW;
END;
$$;

-- Repost de post
CREATE OR REPLACE FUNCTION public.trg_atividade_repost_post ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_original UUID;
BEGIN
  IF NEW.post_original_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.autor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    p.autor_id INTO v_autor_original
  FROM
    public.posts p
  WHERE
    p.id = NEW.post_original_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND OR v_autor_original IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_original = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  IF public.deve_bloquear_atividade_entre_empresas(v_autor_original, NEW.autor_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_original,
    NEW.autor_id,
    'repostou_post',
    NEW.id,
    'post',
    jsonb_build_object('post_id', NEW.id, 'post_original_id', NEW.post_original_id)
  );

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "atividades select amigos" ON public.atividades;

CREATE POLICY "atividades select amigos" ON public.atividades FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        public.redecontatos r
      WHERE
        r.seguidor_id = auth.uid ()
        AND r.seguido_id = atividades.autor_id
    )
    OR EXISTS (
      SELECT
        1
      FROM
        public.favoritos f
        INNER JOIN public.empresas e ON (
          (
            f.alvo_tipo = 'empresa'
            AND e.id = f.alvo_id
          )
          OR (
            f.empresa_id IS NOT NULL
            AND e.id = f.empresa_id
          )
        )
      WHERE
        f.usuario_id = auth.uid ()
        AND e.usuario_id = atividades.autor_id
    )
  );

COMMENT ON POLICY "atividades select amigos" ON public.atividades IS
'Leitura social: seguidos em redecontatos ou empresas favoritadas (favoritos → empresas.usuario_id = autor_id).';
