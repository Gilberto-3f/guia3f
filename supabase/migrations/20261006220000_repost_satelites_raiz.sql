-- Reposts: satélites apontam sempre para a raiz (sem cadeia R1→R2).
-- Unique: 1 satélite vivo por autor + raiz. Sincroniza texto. Decrementa ao excluir satélite.

CREATE OR REPLACE FUNCTION public.resolver_post_raiz (p_post_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur UUID := p_post_id;
  nxt UUID;
  n INT := 0;
BEGIN
  IF p_post_id IS NULL THEN
    RETURN NULL;
  END IF;
  LOOP
    SELECT post_original_id INTO nxt
    FROM posts
    WHERE id = cur;
    IF NOT FOUND THEN
      RETURN cur;
    END IF;
    IF nxt IS NULL THEN
      RETURN cur;
    END IF;
    IF nxt = cur THEN
      RETURN cur;
    END IF;
    cur := nxt;
    n := n + 1;
    IF n > 20 THEN
      RETURN cur;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolver_post_raiz (UUID) TO authenticated;

-- Encadeados passam a referenciar a raiz.
UPDATE posts p
SET
  post_original_id = public.resolver_post_raiz (p.id)
WHERE
  p.post_original_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND public.resolver_post_raiz (p.id) IS DISTINCT FROM p.id
  AND public.resolver_post_raiz (p.id) IS DISTINCT FROM p.post_original_id;

-- Extras do mesmo autor na mesma raiz: mantém o mais recente.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
  WITH ranked AS (
    SELECT
      id,
      post_original_id,
      ROW_NUMBER() OVER (
        PARTITION BY
          autor_id,
          post_original_id
        ORDER BY
          created_at DESC
      ) AS rn
    FROM
      posts
    WHERE
      post_original_id IS NOT NULL
      AND deleted_at IS NULL
  )
  SELECT
    id,
    post_original_id
  FROM
    ranked
  WHERE
    rn > 1
  LOOP
    PERFORM public.limpar_interacoes_post_sem_auth (r.id);
    PERFORM public.decrementar_reposts (r.post_original_id);
    UPDATE posts
    SET
      deleted_at = COALESCE(deleted_at, NOW())
    WHERE
      id = r.id
      AND deleted_at IS NULL;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_um_repost_vivo_por_autor
ON public.posts (autor_id, post_original_id)
WHERE
  post_original_id IS NOT NULL
  AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.sincronizar_texto_reposts (p_post_id UUID, p_texto TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      posts
    WHERE
      id = p_post_id
      AND autor_id = auth.uid ()
      AND post_original_id IS NULL
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE posts
  SET
    texto = p_texto
  WHERE
    deleted_at IS NULL
    AND id IN (
      WITH RECURSIVE tree AS (
        SELECT
          p.id
        FROM
          posts p
        WHERE
          p.post_original_id = p_post_id
          AND p.deleted_at IS NULL
        UNION ALL
        SELECT
          p.id
        FROM
          posts p
          INNER JOIN tree t ON p.post_original_id = t.id
        WHERE
          p.deleted_at IS NULL
      )
      SELECT
        tree.id
      FROM
        tree
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_texto_reposts (UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.limpar_dados_ao_excluir_post (p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_parent UUID;
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      posts
    WHERE
      id = p_post_id
      AND autor_id = auth.uid ()
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT
    post_original_id INTO v_parent
  FROM
    posts
  WHERE
    id = p_post_id;

  PERFORM limpar_interacoes_post_sem_auth (p_post_id);

  FOR r IN
  WITH RECURSIVE tree AS (
    SELECT
      p.id,
      p.post_original_id,
      1 AS depth
    FROM
      posts p
    WHERE
      p.post_original_id = p_post_id
      AND p.deleted_at IS NULL
    UNION ALL
    SELECT
      p.id,
      p.post_original_id,
      t.depth + 1
    FROM
      posts p
      INNER JOIN tree t ON p.post_original_id = t.id
    WHERE
      p.deleted_at IS NULL
  )
  SELECT
    tree.id,
    tree.post_original_id,
    tree.depth
  FROM
    tree
  ORDER BY
    tree.depth DESC
  LOOP
    PERFORM limpar_interacoes_post_sem_auth (r.id);
    PERFORM decrementar_reposts (r.post_original_id);
    UPDATE posts
    SET
      deleted_at = COALESCE(deleted_at, NOW())
    WHERE
      id = r.id
      AND deleted_at IS NULL;
  END LOOP;

  IF v_parent IS NOT NULL THEN
    PERFORM decrementar_reposts (v_parent);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.limpar_dados_ao_excluir_post (UUID) TO authenticated;
