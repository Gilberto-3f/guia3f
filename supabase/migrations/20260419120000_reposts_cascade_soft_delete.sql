-- Reposts: FK com ON DELETE CASCADE (hard delete) + propagação de soft delete aos reposts em cadeia.

-- 1) FK: de SET NULL para CASCADE
ALTER TABLE posts
DROP CONSTRAINT IF EXISTS posts_post_original_id_fkey;

ALTER TABLE posts
ADD CONSTRAINT posts_post_original_id_fkey FOREIGN KEY (post_original_id) REFERENCES posts (id) ON DELETE CASCADE;

-- 2) Limpeza de interações sem verificação de autor (uso interno apenas)
CREATE OR REPLACE FUNCTION limpar_interacoes_post_sem_auth (p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM atividades
  WHERE
    alvo_id = p_post_id
    OR (
      dados_extras ? 'post_id'
      AND (dados_extras->>'post_id')::uuid = p_post_id
    );

  DELETE FROM atividades
  WHERE
    tipo = 'curtiu_comentario'
    AND (
      (
        dados_extras ? 'post_id'
        AND (dados_extras->>'post_id')::uuid = p_post_id
      )
      OR alvo_id IN (
        SELECT
          id
        FROM
          comentarios
        WHERE
          post_id = p_post_id
      )
    );

  DELETE FROM atividades
  WHERE
    alvo_id IN (
      SELECT
        id
      FROM
        comentarios
      WHERE
        post_id = p_post_id
    );

  DELETE FROM curtidas
  WHERE
    post_id = p_post_id
    OR comentario_id IN (
      SELECT
        id
      FROM
        comentarios
      WHERE
        post_id = p_post_id
    );

  DELETE FROM item_salvo
  WHERE
    post_id = p_post_id;

  DELETE FROM comentarios
  WHERE
    post_id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION limpar_interacoes_post_sem_auth (UUID) FROM PUBLIC;

-- 3) Exclusão pelo autor: limpa o post + todos os reposts em cadeia (soft delete)
CREATE OR REPLACE FUNCTION limpar_dados_ao_excluir_post (p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
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
END;
$$;

GRANT EXECUTE ON FUNCTION limpar_dados_ao_excluir_post (UUID) TO authenticated;
